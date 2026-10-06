import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { listWalletActivity } from '../circle';
import { db } from '../firebaseAdmin';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { toApiDoc, type CardDoc, type GroupDoc } from '../types';

const router = Router();
router.use(requireAuth);

async function getOwnedGroup(uid: string, groupId: string) {
  const ref = db.collection('groups').doc(groupId);
  const snap = await ref.get();
  if (!snap.exists || (snap.data() as GroupDoc).userId !== uid) return null;
  return { ref, data: snap.data() as GroupDoc };
}

router.post('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const { name, accent, glyph } = req.body as { name?: string; accent?: string; glyph?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const data: Omit<GroupDoc, 'createdAt'> = {
    userId: uid,
    name: name.trim(),
    accent: accent ?? '#2775CA',
    glyph: glyph ?? '◆',
  };
  const ref = await db.collection('groups').add({ ...data, createdAt: FieldValue.serverTimestamp() });
  const snap = await ref.get();
  res.status(201).json(toApiDoc(ref.id, snap.data() as GroupDoc));
});

router.get('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const snap = await db.collection('groups').where('userId', '==', uid).get();
  res.json(snap.docs.map((d) => toApiDoc(d.id, d.data() as GroupDoc)));
});

router.patch('/:id', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const owned = await getOwnedGroup(uid, req.params.id);
  if (!owned) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const { name, accent, glyph } = req.body as Partial<Pick<GroupDoc, 'name' | 'accent' | 'glyph'>>;
  const patch: Partial<GroupDoc> = {};
  if (name !== undefined) patch.name = name;
  if (accent !== undefined) patch.accent = accent;
  if (glyph !== undefined) patch.glyph = glyph;

  await owned.ref.update(patch);
  res.json(toApiDoc(req.params.id, { ...owned.data, ...patch }));
});

/** Deleting a group cascades to its cards — otherwise they'd keep a dangling groupId and vanish from every grouped view. */
router.delete('/:id', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const owned = await getOwnedGroup(uid, req.params.id);
  if (!owned) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }
  const cardsSnap = await db.collection('cards').where('groupId', '==', req.params.id).get();
  const batch = db.batch();
  cardsSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(owned.ref);
  await batch.commit();
  res.status(204).send();
});

/** Activity across every card in this group, sourced live from Circle. */
router.get('/:id/activity', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const owned = await getOwnedGroup(uid, req.params.id);
  if (!owned) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }
  const cardsSnap = await db.collection('cards').where('groupId', '==', req.params.id).get();
  const walletIds = cardsSnap.docs.map((d) => (d.data() as CardDoc).circleWalletId);
  const transactions = await listWalletActivity(walletIds);
  res.json({ transactions });
});

export default router;
