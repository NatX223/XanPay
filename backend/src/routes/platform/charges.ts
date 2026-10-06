import { Router } from 'express';
import { db } from '../../firebaseAdmin';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { chargeRateLimiter, platformManagementRateLimiter } from '../../middleware/rateLimit';
import { requirePlatformAuth, type PlatformAuthedRequest } from '../../middleware/platformAuth';
import { BillingKeyError, resolveBillingKey } from '../../lib/billingKey';
import type { ChargeDoc } from '../../types';

const router = Router();

async function getOwnedPlatformId(uid: string): Promise<string | null> {
  const snap = await db.collection('platforms').where('ownerUid', '==', uid).limit(1).get();
  return snap.empty ? null : snap.docs[0]!.id;
}

/**
 * Recent charges across every card this platform has charged — powers the developer dashboard's request
 * log. Requires a composite index: collection group `charges`, fields platformId ASC + timestamp DESC
 * (see /firestore.indexes.json).
 */
router.get('/', platformManagementRateLimiter, requireAuth, async (req, res) => {
  const { uid } = req as AuthedRequest;
  const platformId = await getOwnedPlatformId(uid);
  if (!platformId) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const snap = await db
    .collectionGroup('charges')
    .where('platformId', '==', platformId)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  const charges = snap.docs.map((d) => {
    const data = d.data() as ChargeDoc;
    return {
      id: d.id,
      amount: data.amount,
      reason: data.reason,
      routeId: data.routeId ?? null,
      status: data.status,
      txId: data.txId,
      keyId: data.keyId,
      timestamp: data.timestamp.toDate().toISOString(),
    };
  });
  res.json({ charges });
});

/**
 * API-key-authed charge history for a single billingKey, cursor-paginated by chargeId — what an SDK
 * consumer calls server-to-server (unlike GET / above, which is Firebase-ID-token-authed for the
 * dashboard and unfiltered). Scoped to charges *this platform* made against the card, since the same
 * card's `charges` subcollection can hold entries from other platforms it's also linked to.
 */
router.get('/by-key', chargeRateLimiter, requirePlatformAuth('charges:read'), async (req, res) => {
  const { platform } = req as PlatformAuthedRequest;
  const billingKey = typeof req.query.billingKey === 'string' ? req.query.billingKey : undefined;
  if (!billingKey) {
    res.status(400).json({ error: 'billingKey query parameter is required' });
    return;
  }

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

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const startAfterId = typeof req.query.startAfter === 'string' ? req.query.startAfter : undefined;

  const cardChargesRef = db.collection('cards').doc(cardId).collection('charges');
  let query = cardChargesRef
    .where('platformId', '==', platform.platformId)
    .orderBy('timestamp', 'desc')
    .limit(limit);

  if (startAfterId) {
    const cursorSnap = await cardChargesRef.doc(startAfterId).get();
    if (cursorSnap.exists) query = query.startAfter(cursorSnap);
  }

  const snap = await query.get();
  const charges = snap.docs.map((d) => {
    const data = d.data() as ChargeDoc;
    return {
      chargeId: d.id,
      amount: data.amount,
      reason: data.reason,
      routeId: data.routeId ?? null,
      status: data.status,
      txId: data.txId,
      timestamp: data.timestamp.toDate().toISOString(),
    };
  });

  res.json({ charges, hasMore: charges.length === limit });
});

export default router;
