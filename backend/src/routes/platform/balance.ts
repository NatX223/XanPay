import { Router } from 'express';
import { db } from '../../firebaseAdmin';
import { chargeRateLimiter } from '../../middleware/rateLimit';
import { requirePlatformAuth, type PlatformAuthedRequest } from '../../middleware/platformAuth';
import { BillingKeyError, resolveBillingKey } from '../../lib/billingKey';
import type { CardDoc } from '../../types';

const router = Router();
router.use(chargeRateLimiter);
router.use(requirePlatformAuth('charges:read'));

/** Lets a platform check a linked card's spendable Gateway balance before attempting a charge. */
router.get('/', async (req, res) => {
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

  const cardSnap = await db.collection('cards').doc(cardId).get();
  if (!cardSnap.exists) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }
  const card = cardSnap.data() as CardDoc;

  res.json({ available: card.gatewayBalance ?? 0, currency: 'USDC' });
});

export default router;
