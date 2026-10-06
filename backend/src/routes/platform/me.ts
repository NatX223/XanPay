import { Router } from 'express';
import { db } from '../../firebaseAdmin';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { platformManagementRateLimiter } from '../../middleware/rateLimit';
import { toApiDoc, type PlatformDoc } from '../../types';

const router = Router();
router.use(platformManagementRateLimiter);
router.use(requireAuth);

/** The signed-in developer's own platform, if they've completed registration — lets the frontend skip onboarding on return visits. */
router.get('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const snap = await db.collection('platforms').where('ownerUid', '==', uid).limit(1).get();
  if (snap.empty) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }
  const doc = snap.docs[0]!;
  res.json(toApiDoc(doc.id, doc.data() as PlatformDoc));
});

export default router;
