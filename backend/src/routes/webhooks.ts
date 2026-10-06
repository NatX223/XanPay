import { Router, type Request } from 'express';
import { db } from '../firebaseAdmin';
import { sweepCardToGateway } from '../lib/gatewaySweep';
import { verifyCircleWebhookSignature } from '../lib/circleWebhookSignature';
import type { CardDoc } from '../types';

const router = Router();

interface CircleNotificationEnvelope {
  subscriptionId?: string;
  notificationId?: string;
  notificationType?: string;
  notification?: {
    walletId?: string;
    amounts?: string[];
    state?: string;
    transactionType?: string;
    [key: string]: unknown;
  };
}

/** Accepts a few spellings since Circle's notification `state` values aren't confirmed to match the `TransactionState` enum used elsewhere in the SDK exactly. */
const INBOUND_SUCCESS_STATES = new Set(['COMPLETE', 'COMPLETED', 'CONFIRMED']);

/**
 * Circle Developer-Controlled Wallets webhook — fires on wallet activity, including an inbound-
 * transaction notification when USDC lands in a card's on-chain wallet. Public and unauthenticated
 * (Circle can't carry our Firebase/API-key auth), so it's protected by verifying Circle's own
 * signature instead (lib/circleWebhookSignature.ts) rather than any bearer token.
 *
 * Deliberately treated as a *trigger*, not a source of truth: rather than crediting whatever amount
 * the payload claims, this looks up the affected card by walletId and re-runs the same sweep used by
 * `GET /cards/:id/balance` (lib/gatewaySweep.ts), which re-derives the swept amount from Circle's own
 * live wallet balance. That makes this handler safe against a forged or duplicated delivery — worst
 * case it re-checks a balance and finds nothing new to sweep — without needing separate idempotency
 * bookkeeping keyed on notificationId.
 *
 * This is the proactive path; `GET /cards/:id/balance`'s inline sweep remains as a fallback for
 * whenever the subscription isn't set up yet, or a delivery is dropped.
 */
router.post('/circle', async (req, res) => {
  const signature = req.headers['x-circle-signature'];
  const keyId = req.headers['x-circle-key-id'];
  if (typeof signature !== 'string' || typeof keyId !== 'string') {
    res.status(401).json({ error: 'Missing webhook signature headers' });
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody || !(await verifyCircleWebhookSignature(rawBody, signature, keyId))) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  const body = req.body as CircleNotificationEnvelope;

  // Circle sends a no-op verification payload when a subscription is first created — just ack it.
  if (body.notificationType === 'ping' || !body.notification) {
    res.status(200).json({ ok: true });
    return;
  }

  // Ack immediately — the sweep this may trigger involves on-chain confirmations that can take far
  // longer than a webhook delivery should block on, and Circle retries deliveries that time out.
  res.status(200).json({ ok: true });

  const { walletId, state, transactionType, amounts } = body.notification;
  const isInbound = transactionType?.toUpperCase() === 'INBOUND';
  const isSettled = typeof state === 'string' && INBOUND_SUCCESS_STATES.has(state.toUpperCase());
  const amountStr = amounts?.[0];

  if (!walletId || !isInbound || !isSettled || !amountStr) return;

  const parsedAmount = parseFloat(amountStr);
  if (isNaN(parsedAmount) || parsedAmount <= 0.1) {
    return; // Quietly drop execution for small amounts or invalid strings
  }

  try {
    const snap = await db.collection('cards').where('circleWalletId', '==', walletId).limit(1).get();
    if (snap.empty) return;
    const cardDoc = snap.docs[0]!;
    await sweepCardToGateway(cardDoc.id, cardDoc.data() as CardDoc);
  } catch (err) {
    console.error(`Webhook-triggered sweep failed for wallet ${walletId}:`, err);
  }
});

export default router;
