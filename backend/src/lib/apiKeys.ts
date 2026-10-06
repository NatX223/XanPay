import { createHash, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebaseAdmin';
import type { ApiKeyDoc, PlatformDoc } from '../types';

/** Every capability an API key can be granted. Keep in sync with what requirePlatformAuth actually enforces. */
export const ALL_SCOPES = ['charges:write', 'charges:read', 'link:exchange'] as const;
export type Scope = (typeof ALL_SCOPES)[number];

export const MAX_ACTIVE_KEYS_PER_PLATFORM = 10;

export function hashApiKey(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export interface IssuedApiKey {
  id: string;
  /** Plaintext — only returned here, at issuance. Never persisted or retrievable again. */
  apiKey: string;
  name: string;
  last4: string;
  scopes: Scope[];
}

/** Creates a platform (an org/project — the thing a merchant wallet and cards' approved-platform list refer to). */
export async function createPlatform(data: {
  name: string;
  merchantWalletAddress: string;
  ownerUid?: string;
}): Promise<{ platformId: string }> {
  const platformRef = db.collection('platforms').doc();
  const platformData: Omit<PlatformDoc, 'createdAt'> = {
    name: data.name.trim(),
    merchantWalletAddress: data.merchantWalletAddress,
    ...(data.ownerUid ? { ownerUid: data.ownerUid } : {}),
  };
  await platformRef.set({ ...platformData, createdAt: FieldValue.serverTimestamp() });
  return { platformId: platformRef.id };
}

/** Issues a new API key for a platform. Writes the key doc and its hash-lookup index atomically. */
export async function issueApiKey(
  platformId: string,
  data: { name: string; scopes?: Scope[] },
): Promise<IssuedApiKey> {
  const secret = `sk_xan_${randomBytes(24).toString('hex')}`;
  const hash = hashApiKey(secret);
  const last4 = secret.slice(-4);
  const scopes = data.scopes?.length ? data.scopes : [...ALL_SCOPES];
  const name = data.name.trim();

  const keyRef = db.collection('platforms').doc(platformId).collection('apiKeys').doc();
  const indexRef = db.collection('apiKeyIndex').doc(hash);

  const keyDoc: Omit<ApiKeyDoc, 'createdAt'> = { name, last4, hash, scopes, lastUsedAt: null, revokedAt: null };

  const batch = db.batch();
  batch.set(keyRef, { ...keyDoc, createdAt: FieldValue.serverTimestamp() });
  batch.set(indexRef, { platformId, keyId: keyRef.id, scopes });
  await batch.commit();

  return { id: keyRef.id, apiKey: secret, name, last4, scopes };
}

/** Revokes a key immediately: deletes its auth index (so it stops working right away) and marks it revoked for the audit trail. Idempotent. */
export async function revokeApiKey(platformId: string, keyId: string): Promise<boolean> {
  const keyRef = db.collection('platforms').doc(platformId).collection('apiKeys').doc(keyId);
  const snap = await keyRef.get();
  if (!snap.exists) return false;

  const data = snap.data() as ApiKeyDoc;
  const batch = db.batch();
  if (!data.revokedAt) {
    batch.update(keyRef, { revokedAt: FieldValue.serverTimestamp() });
  }
  batch.delete(db.collection('apiKeyIndex').doc(data.hash));
  await batch.commit();
  return true;
}
