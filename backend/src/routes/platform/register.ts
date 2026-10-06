import { Router } from 'express';
import { createCircleWallet } from '../../circle';
import { createPlatform, issueApiKey } from '../../lib/apiKeys';
import { db } from '../../firebaseAdmin';
import { platformManagementRateLimiter } from '../../middleware/rateLimit';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';

const router = Router();
router.use(platformManagementRateLimiter);
router.use(requireAuth);

/** Self-serve platform signup for the developer onboarding flow — one platform per Firebase account. */
router.post('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const existing = await db.collection('platforms').where('ownerUid', '==', uid).limit(1).get();
  if (!existing.empty) {
    res.status(409).json({ error: 'A platform is already registered for this account' });
    return;
  }

  const wallet = await createCircleWallet(`platform:${uid}`, `${name.trim()} — merchant wallet`);
  const { platformId } = await createPlatform({
    name: name.trim(),
    merchantWalletAddress: wallet.address,
    ownerUid: uid,
  });
  const key = await issueApiKey(platformId, { name: 'Default key' });

  res.status(201).json({
    platformId,
    // Shown once — only sha256(apiKey) is ever stored, so this can't be recovered later.
    apiKey: key.apiKey,
    name: name.trim(),
    merchantWalletAddress: wallet.address,
  });
});

export default router;
