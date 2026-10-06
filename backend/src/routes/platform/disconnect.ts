import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../firebaseAdmin';
import { chargeRateLimiter } from '../../middleware/rateLimit';
import { requirePlatformAuth, type PlatformAuthedRequest } from '../../middleware/platformAuth';
import { BillingKeyError, resolveBillingKey, revokeBillingKey } from '../../lib/billingKey';

const router = Router();
router.use(chargeRateLimiter);
router.use(requirePlatformAuth('link:exchange'));

/**
 * Reverses POST /platform/link/approve: revokes the billingKey (charge/balance/history all refuse it
 * going forward) and removes this platform from the card's approved-platforms list. Call this when a
 * user removes a linked XanCard from the platform's own settings UI.
 */
router.post('/', async (req, res) => {
  const { platform } = req as PlatformAuthedRequest;
  const { billingKey } = req.body as { billingKey?: string };
  if (!billingKey) {
    res.status(400).json({ error: 'billingKey is required' });
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

  await Promise.all([
    revokeBillingKey(billingKey),
    db.collection('cards').doc(cardId).update({ 'rules.platforms': FieldValue.arrayRemove(platform.platformId) }),
  ]);

  res.json({ success: true });
});

export default router;
