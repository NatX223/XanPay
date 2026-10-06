import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../../firebaseAdmin';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { requirePlatformAuth, type PlatformAuthedRequest } from '../../middleware/platformAuth';
import { chargeRateLimiter, platformManagementRateLimiter } from '../../middleware/rateLimit';
import { generateBillingKey, recordBillingKey } from '../../lib/billingKey';
import type { CardDoc, LinkTokenDoc } from '../../types';

const router = Router();

const LINK_TOKEN_TTL_MS = 10 * 60_000;

class LinkError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * User-authenticated (Firebase ID token) — called from inside the connect-modal iframe once a signed-in
 * user picks a card to approve. Adds the platform to the card's approved list and mints a short-lived,
 * single-use linkToken. The card's raw id is never returned here, only the opaque token.
 */
router.post('/approve', platformManagementRateLimiter, requireAuth, async (req, res) => {
  const { uid } = req as AuthedRequest;
  const { cardId, platformId } = req.body as { cardId?: string; platformId?: string };
  if (!cardId || !platformId) {
    res.status(400).json({ error: 'cardId and platformId are required' });
    return;
  }

  const cardRef = db.collection('cards').doc(cardId);
  const cardSnap = await cardRef.get();
  if (!cardSnap.exists || (cardSnap.data() as CardDoc).userId !== uid) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  const platformSnap = await db.collection('platforms').doc(platformId).get();
  if (!platformSnap.exists) {
    res.status(404).json({ error: 'Platform not found' });
    return;
  }

  await cardRef.update({ 'rules.platforms': FieldValue.arrayUnion(platformId) });

  const linkToken = randomUUID();
  const linkTokenDoc: Omit<LinkTokenDoc, 'createdAt'> = {
    cardId,
    platformId,
    used: false,
    expiresAt: Timestamp.fromMillis(Date.now() + LINK_TOKEN_TTL_MS),
  };
  await db.collection('linkTokens').doc(linkToken).set({ ...linkTokenDoc, createdAt: FieldValue.serverTimestamp() });

  res.status(201).json({ linkToken });
});

/**
 * Platform-authenticated (API key) — exchanges a single-use linkToken for an encrypted billingKey. This
 * is the only place a platform's own request ever touches a cardId, and even here it's immediately sealed
 * inside the billingKey rather than returned in the clear. The used-check and used:true write happen
 * inside one transaction so two concurrent exchanges of the same token can't both succeed.
 */
router.post('/exchange', chargeRateLimiter, requirePlatformAuth('link:exchange'), async (req, res) => {
  const { platform } = req as PlatformAuthedRequest;
  const { linkToken } = req.body as { linkToken?: string };
  if (!linkToken) {
    res.status(400).json({ error: 'linkToken is required' });
    return;
  }

  const tokenRef = db.collection('linkTokens').doc(linkToken);

  let payload: { cardId: string; platformId: string };
  try {
    payload = await db.runTransaction(async (tx) => {
      const snap = await tx.get(tokenRef);
      if (!snap.exists) throw new LinkError(404, 'Link token not found');

      const token = snap.data() as LinkTokenDoc;
      if (token.platformId !== platform.platformId) {
        throw new LinkError(401, 'Link token does not belong to this platform');
      }
      if (token.used) throw new LinkError(410, 'Link token has already been used');
      if (token.expiresAt.toMillis() <= Date.now()) throw new LinkError(400, 'Link token has expired');

      tx.update(tokenRef, { used: true });
      return { cardId: token.cardId, platformId: token.platformId };
    });
  } catch (err) {
    if (err instanceof LinkError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }

  const billingKey = generateBillingKey(payload);
  await recordBillingKey(billingKey, payload);

  res.status(201).json({ billingKey });
});

export default router;
