import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { createCircleWallet, listWalletActivity } from '../circle';
import { db } from '../firebaseAdmin';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { toApiDoc, type CardDoc, type UserDoc } from '../types';

const router = Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const { name, email } = req.body as { name?: string; email?: string };
  if (!name?.trim() || !email?.trim()) {
    res.status(400).json({ error: 'name and email are required' });
    return;
  }

  const ref = db.collection('users').doc(uid);
  const existing = await ref.get();
  if (existing.exists) {
    res.status(200).json(toApiDoc(uid, existing.data() as UserDoc));
    return;
  }

  const wallet = await createCircleWallet(uid, `${name.trim()} — general wallet`);
  const data: Omit<UserDoc, 'createdAt'> = {
    name: name.trim(),
    email: email.trim(),
    circleWalletId: wallet.walletId,
    walletAddress: wallet.address,
  };
  await ref.set({ ...data, createdAt: FieldValue.serverTimestamp() });

  const snap = await ref.get();
  res.status(201).json(toApiDoc(uid, snap.data() as UserDoc));
});

router.get('/me', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) {
    res.status(404).json({ error: 'User profile not found' });
    return;
  }
  res.json(toApiDoc(uid, snap.data() as UserDoc));
});

/** All of a user's activity — spent/received across every card wallet they own. */
router.get('/me/activity', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const cardsSnap = await db.collection('cards').where('userId', '==', uid).get();
  const walletIds = cardsSnap.docs.map((d) => (d.data() as CardDoc).circleWalletId);
  const transactions = await listWalletActivity(walletIds);
  res.json({ transactions });
});

export default router;
