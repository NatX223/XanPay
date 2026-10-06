import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../firebaseAdmin';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { platformManagementRateLimiter } from '../../middleware/rateLimit';
import type { RouteDoc } from '../../types';

const router = Router();
router.use(platformManagementRateLimiter);
router.use(requireAuth);

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const MAX_ROUTES_PER_PLATFORM = 50;

async function getOwnedPlatformId(uid: string): Promise<string | null> {
  const snap = await db.collection('platforms').where('ownerUid', '==', uid).limit(1).get();
  return snap.empty ? null : snap.docs[0]!.id;
}

function toRouteSummary(id: string, data: RouteDoc) {
  return {
    id,
    path: data.path,
    method: data.method,
    price: data.price,
    status: data.status,
    calls: data.calls,
    revenue: data.revenue,
    createdAt: data.createdAt.toDate().toISOString(),
    updatedAt: data.updatedAt.toDate().toISOString(),
  };
}

router.get('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const platformId = await getOwnedPlatformId(uid);
  if (!platformId) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }
  const snap = await db.collection('platforms').doc(platformId).collection('routes').orderBy('createdAt', 'desc').get();
  res.json({ routes: snap.docs.map((d) => toRouteSummary(d.id, d.data() as RouteDoc)) });
});

router.post('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const platformId = await getOwnedPlatformId(uid);
  if (!platformId) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }

  const { path, method, price } = req.body as { path?: string; method?: string; price?: number };
  const trimmedPath = path?.trim();
  if (!trimmedPath || !trimmedPath.startsWith('/')) {
    res.status(400).json({ error: 'path is required and must start with /' });
    return;
  }
  const normalizedMethod = method?.trim().toUpperCase();
  if (!normalizedMethod || !HTTP_METHODS.includes(normalizedMethod)) {
    res.status(400).json({ error: `method must be one of: ${HTTP_METHODS.join(', ')}` });
    return;
  }
  if (typeof price !== 'number' || !(price > 0)) {
    res.status(400).json({ error: 'price (a positive number, in USDC) is required' });
    return;
  }

  const routesCol = db.collection('platforms').doc(platformId).collection('routes');

  const [duplicateSnap, countSnap] = await Promise.all([
    routesCol.where('path', '==', trimmedPath).where('method', '==', normalizedMethod).limit(1).get(),
    routesCol.count().get(),
  ]);
  if (!duplicateSnap.empty) {
    res.status(409).json({ error: 'A route with this path and method already exists' });
    return;
  }
  if (countSnap.data().count >= MAX_ROUTES_PER_PLATFORM) {
    res.status(400).json({ error: `Maximum of ${MAX_ROUTES_PER_PLATFORM} routes per platform` });
    return;
  }

  const data: Omit<RouteDoc, 'createdAt' | 'updatedAt'> = {
    path: trimmedPath,
    method: normalizedMethod,
    price,
    status: 'live',
    calls: 0,
    revenue: 0,
  };
  const now = FieldValue.serverTimestamp();
  const ref = await routesCol.add({ ...data, createdAt: now, updatedAt: now });
  const snap = await ref.get();
  res.status(201).json(toRouteSummary(ref.id, snap.data() as RouteDoc));
});

router.patch('/:id', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const platformId = await getOwnedPlatformId(uid);
  if (!platformId) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }

  const ref = db.collection('platforms').doc(platformId).collection('routes').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: 'Route not found' });
    return;
  }

  const { price, status } = req.body as { price?: number; status?: string };
  const patch: Partial<Pick<RouteDoc, 'price' | 'status'>> = {};
  if (price !== undefined) {
    if (typeof price !== 'number' || !(price > 0)) {
      res.status(400).json({ error: 'price must be a positive number' });
      return;
    }
    patch.price = price;
  }
  if (status !== undefined) {
    if (status !== 'live' && status !== 'paused') {
      res.status(400).json({ error: "status must be 'live' or 'paused'" });
      return;
    }
    patch.status = status;
  }

  await ref.update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
  const updated = await ref.get();
  res.json(toRouteSummary(ref.id, updated.data() as RouteDoc));
});

router.delete('/:id', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const platformId = await getOwnedPlatformId(uid);
  if (!platformId) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }
  const ref = db.collection('platforms').doc(platformId).collection('routes').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: 'Route not found' });
    return;
  }
  await ref.delete();
  res.status(204).send();
});

export default router;
