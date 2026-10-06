import { Router } from 'express';
import { db } from '../../firebaseAdmin';
import { platformManagementRateLimiter } from '../../middleware/rateLimit';
import type { PlatformDoc } from '../../types';

const router = Router();
router.use(platformManagementRateLimiter);

/**
 * Unauthenticated — the connect-modal iframe needs a platform's display name before the user has signed
 * in. Only ever returns the name; never merchantWalletAddress, ownerUid, or totals.
 */
router.get('/:id', async (req, res) => {
  const snap = await db.collection('platforms').doc(req.params.id).get();
  if (!snap.exists) {
    res.status(404).json({ error: 'Platform not found' });
    return;
  }
  const { name } = snap.data() as PlatformDoc;
  res.json({ id: snap.id, name });
});

export default router;
