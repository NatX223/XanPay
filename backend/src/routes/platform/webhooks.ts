import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../firebaseAdmin';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { platformManagementRateLimiter } from '../../middleware/rateLimit';
import { generateWebhookSecret } from '../../lib/webhooks';
import type { PlatformDoc } from '../../types';

const router = Router();
router.use(platformManagementRateLimiter);
router.use(requireAuth);

async function getOwnedPlatformDoc(uid: string) {
  const snap = await db.collection('platforms').where('ownerUid', '==', uid).limit(1).get();
  return snap.empty ? null : snap.docs[0]!;
}

router.get('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const platformDoc = await getOwnedPlatformDoc(uid);
  if (!platformDoc) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }
  const { webhookUrl, webhookSecret } = platformDoc.data() as PlatformDoc;
  res.json({ url: webhookUrl ?? null, webhookSecret: webhookSecret ?? null });
});

/** Sets (or replaces) the platform's webhook endpoint and (re)issues its HMAC signing secret. */
router.put('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const platformDoc = await getOwnedPlatformDoc(uid);
  if (!platformDoc) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }

  const { url } = req.body as { url?: string };
  if (!url || !url.startsWith('https://')) {
    res.status(400).json({ error: 'url is required and must be an https:// URL' });
    return;
  }

  const webhookSecret = generateWebhookSecret();
  await platformDoc.ref.update({ webhookUrl: url, webhookSecret });
  res.json({ url, webhookSecret });
});

router.delete('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const platformDoc = await getOwnedPlatformDoc(uid);
  if (!platformDoc) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }

  await platformDoc.ref.update({ webhookUrl: FieldValue.delete(), webhookSecret: FieldValue.delete() });
  res.status(204).send();
});

export default router;
