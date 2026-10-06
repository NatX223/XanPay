import { Router } from 'express';
import { db } from '../../firebaseAdmin';
import { ALL_SCOPES, MAX_ACTIVE_KEYS_PER_PLATFORM, issueApiKey, revokeApiKey, type Scope } from '../../lib/apiKeys';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { platformManagementRateLimiter } from '../../middleware/rateLimit';
import type { ApiKeyDoc } from '../../types';

const router = Router();
router.use(platformManagementRateLimiter);
router.use(requireAuth);

async function getOwnedPlatformId(uid: string): Promise<string | null> {
  const snap = await db.collection('platforms').where('ownerUid', '==', uid).limit(1).get();
  return snap.empty ? null : snap.docs[0]!.id;
}

/** Never includes `hash` — the plaintext secret is unrecoverable and its hash has no legitimate use client-side. */
function toKeySummary(id: string, data: ApiKeyDoc) {
  return {
    id,
    name: data.name,
    last4: data.last4,
    scopes: data.scopes,
    createdAt: data.createdAt.toDate().toISOString(),
    lastUsedAt: data.lastUsedAt ? data.lastUsedAt.toDate().toISOString() : null,
    revoked: data.revokedAt !== null,
  };
}

function isValidScopeList(scopes: unknown): scopes is Scope[] {
  return (
    Array.isArray(scopes) &&
    scopes.length > 0 &&
    scopes.every((s) => (ALL_SCOPES as readonly string[]).includes(s))
  );
}

router.get('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const platformId = await getOwnedPlatformId(uid);
  if (!platformId) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }
  const snap = await db.collection('platforms').doc(platformId).collection('apiKeys').orderBy('createdAt', 'desc').get();
  res.json({ keys: snap.docs.map((d) => toKeySummary(d.id, d.data() as ApiKeyDoc)) });
});

router.post('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const platformId = await getOwnedPlatformId(uid);
  if (!platformId) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }

  const { name, scopes } = req.body as { name?: string; scopes?: unknown };
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (scopes !== undefined && !isValidScopeList(scopes)) {
    res.status(400).json({ error: `scopes must be a non-empty subset of: ${ALL_SCOPES.join(', ')}` });
    return;
  }

  const activeKeysSnap = await db
    .collection('platforms')
    .doc(platformId)
    .collection('apiKeys')
    .where('revokedAt', '==', null)
    .get();
  if (activeKeysSnap.size >= MAX_ACTIVE_KEYS_PER_PLATFORM) {
    res.status(400).json({ error: `Maximum of ${MAX_ACTIVE_KEYS_PER_PLATFORM} active API keys per platform` });
    return;
  }

  const key = await issueApiKey(platformId, { name: name.trim(), scopes: scopes as Scope[] | undefined });
  res.status(201).json({ id: key.id, apiKey: key.apiKey, name: key.name, last4: key.last4, scopes: key.scopes });
});

router.delete('/:id', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const platformId = await getOwnedPlatformId(uid);
  if (!platformId) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }
  const ok = await revokeApiKey(platformId, req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }
  res.status(204).send();
});

/** Rotates a key: revokes it immediately (auth stops working right away) and issues a fresh secret with the same name/scopes. */
router.post('/:id/roll', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const platformId = await getOwnedPlatformId(uid);
  if (!platformId) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }

  const keyRef = db.collection('platforms').doc(platformId).collection('apiKeys').doc(req.params.id);
  const snap = await keyRef.get();
  if (!snap.exists) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }
  const data = snap.data() as ApiKeyDoc;
  if (data.revokedAt) {
    res.status(400).json({ error: 'Cannot roll a revoked key — create a new one instead' });
    return;
  }

  await revokeApiKey(platformId, req.params.id);
  const key = await issueApiKey(platformId, { name: data.name, scopes: data.scopes as Scope[] });
  res.status(201).json({ id: key.id, apiKey: key.apiKey, name: key.name, last4: key.last4, scopes: key.scopes });
});

export default router;
