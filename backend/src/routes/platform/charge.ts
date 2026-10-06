import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { submitGatewayCharge } from '../../lib/gatewayClient';
import { db } from '../../firebaseAdmin';
import { chargeRateLimiter } from '../../middleware/rateLimit';
import { requirePlatformAuth, type PlatformAuthedRequest } from '../../middleware/platformAuth';
import { BillingKeyError, resolveBillingKey } from '../../lib/billingKey';
import { evaluateChargeRules, type ChargeAlert } from '../../lib/cardRules';
import { dispatchWebhookEvent } from '../../lib/webhooks';
import type { CardDoc, RouteDoc } from '../../types';

const router = Router();
router.use(chargeRateLimiter);
router.use(requirePlatformAuth('charges:write'));

class ChargeError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** YYYY-MM-DD in UTC — the doc id for platforms/{id}/dailyStats/{day}. */
function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

router.post('/', async (req, res) => {
  const { platform } = req as PlatformAuthedRequest;
  const { billingKey, amount, reason, routeId } = req.body as {
    billingKey?: string;
    amount?: number;
    reason?: string;
    routeId?: string;
  };

  if (!billingKey || typeof amount !== 'number' || !(amount > 0) || !reason?.trim()) {
    res.status(400).json({ error: 'billingKey, amount (a positive number), and reason are required' });
    return;
  }

  // The billingKey is the only thing that ever names a cardId to a platform, and it's encrypted —
  // resolveBillingKey decrypts it rather than trusting a cardId supplied directly in the request body,
  // confirms it belongs to this platform, and checks it hasn't been revoked.
  let cardId: string;
  try {
    ({ cardId } = await resolveBillingKey(billingKey, platform.platformId));
  } catch (err) {
    if (err instanceof BillingKeyError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }

  let route: (RouteDoc & { id: string }) | null = null;
  if (routeId !== undefined) {
    const routeSnap = await db.collection('platforms').doc(platform.platformId).collection('routes').doc(routeId).get();
    if (!routeSnap.exists) {
      res.status(400).json({ error: 'Unknown route' });
      return;
    }
    route = { id: routeSnap.id, ...(routeSnap.data() as RouteDoc) };
    if (route.status !== 'live') {
      res.status(400).json({ error: 'Route is paused' });
      return;
    }
    if (amount !== route.price) {
      res.status(400).json({ error: `amount must equal the route's configured price (${route.price})` });
      return;
    }
  }

  const cardRef = db.collection('cards').doc(cardId);

  // Reserve the funds atomically before calling out to Gateway — checking the balance and decrementing
  // it in separate steps would let two concurrent charges both pass the check and overdraw the card.
  // Rule enforcement (frozen/paused, platform allowlist, per-charge/daily/monthly/velocity limits) lives
  // in cardRules.ts and runs inside this same transaction, so its spend counters get the same
  // race-safety guarantee as the balance decrement.
  let card: CardDoc;
  let alerts: ChargeAlert[];
  try {
    ({ card, alerts } = await db.runTransaction(async (tx) => {
      const cardSnap = await tx.get(cardRef);
      if (!cardSnap.exists) throw new ChargeError(404, 'Card not found');
      const c = cardSnap.data() as CardDoc;

      const decision = evaluateChargeRules(c, platform.platformId, amount, new Date());
      if (!decision.allowed) throw new ChargeError(decision.status, decision.reason);

      const gatewayBalance = c.gatewayBalance ?? 0;
      if (gatewayBalance < amount) throw new ChargeError(402, 'Insufficient gateway balance');

      tx.update(cardRef, { gatewayBalance: FieldValue.increment(-amount), ...decision.cardUpdates });
      return { card: c, alerts: decision.alerts };
    }));
  } catch (err) {
    if (err instanceof ChargeError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }

  let txId: string;
  try {
    ({ txId } = await submitGatewayCharge(
      { circleWalletId: card.circleWalletId, walletAddress: card.walletAddress },
      platform.merchantWalletAddress,
      amount,
    ));
  } catch (err) {
    // Settlement failed after funds were reserved — refund the balance and the daily/monthly counters
    // evaluateChargeRules already credited, so a failed charge doesn't count against the card's limits.
    // (recentChargeTimestamps is left as-is: it self-corrects once the 1s velocity window passes.)
    await cardRef.update({
      gatewayBalance: FieldValue.increment(amount),
      'spend.dailySpent': FieldValue.increment(-amount),
      'spend.monthlySpent': FieldValue.increment(-amount),
    });
    res.status(502).json({ error: err instanceof Error ? err.message : 'Settlement failed — your card was not charged' });
    return;
  }

  const chargeRef = cardRef.collection('charges').doc();
  const platformRef = db.collection('platforms').doc(platform.platformId);
  const dailyStatsRef = platformRef.collection('dailyStats').doc(utcDayKey(new Date()));

  const batch = db.batch();
  batch.set(chargeRef, {
    platformId: platform.platformId,
    keyId: platform.keyId,
    routeId: route?.id ?? null,
    amount,
    reason: reason.trim(),
    txId,
    timestamp: FieldValue.serverTimestamp(),
    status: 'pending',
  });
  batch.set(dailyStatsRef, { settledUsdc: FieldValue.increment(amount), chargeCount: FieldValue.increment(1) }, { merge: true });
  batch.update(platformRef, { totalSettledUsdc: FieldValue.increment(amount), totalChargeCount: FieldValue.increment(1) });
  if (route) {
    batch.update(platformRef.collection('routes').doc(route.id), {
      calls: FieldValue.increment(1),
      revenue: FieldValue.increment(amount),
    });
  }
  await batch.commit();

  const chargeTimestamp = new Date().toISOString();

  // Fire-and-forget — never let a slow/unreachable developer webhook endpoint delay this response.
  void dispatchWebhookEvent(platform.platformId, 'charge.settled', {
    chargeId: chargeRef.id,
    txId,
    amount,
    reason: reason.trim(),
    routeId: route?.id ?? null,
    timestamp: chargeTimestamp,
  });
  for (const alert of alerts) {
    void dispatchWebhookEvent(platform.platformId, 'card.spend_threshold', {
      alertType: alert.type,
      limit: alert.limit,
      spent: alert.spent,
      timestamp: chargeTimestamp,
    });
  }

  res.status(201).json({
    success: true,
    chargeId: chargeRef.id,
    txId,
    amount,
    timestamp: chargeTimestamp,
  });
});

export default router;
