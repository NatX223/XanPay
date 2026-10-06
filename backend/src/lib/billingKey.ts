import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebaseAdmin';
import type { BillingKeyDoc } from '../types';

const PREFIX = 'xanpay_bk_';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export interface BillingKeyPayload {
  cardId: string;
  platformId: string;
}

function getEncryptionKey(): Buffer {
  const secret = process.env.BILLING_KEY_SECRET;
  if (!secret || secret.length !== 64) {
    throw new Error('BILLING_KEY_SECRET must be set to a 32-byte hex string (64 hex chars)');
  }
  return Buffer.from(secret, 'hex');
}

/** SHA-256 hash of a billingKey — the Firestore doc id for billingKeys/{hash}. The plaintext key is never stored. */
export function hashBillingKey(billingKey: string): string {
  return createHash('sha256').update(billingKey).digest('hex');
}

/**
 * Encrypts {cardId, platformId} with AES-256-GCM into an opaque, platform-scoped token that platforms
 * store and pass on every charge instead of the raw cardId. A random IV is generated per key.
 */
export function generateBillingKey(payload: BillingKeyPayload): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64url');
}

/**
 * Decrypts a billingKey back into {cardId, platformId}. Throws if the key is malformed or its GCM auth
 * tag fails to verify — callers must treat that as tampering (401), never fall through to charge logic.
 */
export function decryptBillingKey(billingKey: string): BillingKeyPayload {
  if (!billingKey.startsWith(PREFIX)) throw new Error('Invalid billing key');

  const raw = Buffer.from(billingKey.slice(PREFIX.length), 'base64url');
  if (raw.length <= IV_LENGTH + AUTH_TAG_LENGTH) throw new Error('Invalid billing key');

  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');

  return JSON.parse(decrypted) as BillingKeyPayload;
}

/** Records a newly issued billingKey's hash for revocation lookups. Never stores the plaintext key. */
export async function recordBillingKey(billingKey: string, payload: BillingKeyPayload): Promise<void> {
  const hash = hashBillingKey(billingKey);
  const doc: Omit<BillingKeyDoc, 'createdAt'> = { ...payload, active: true };
  await db.collection('billingKeys').doc(hash).set({ ...doc, createdAt: FieldValue.serverTimestamp() });
}

/**
 * Looks up a billingKey's active state by hash. Returns false if it was never recorded or has been
 * revoked — the charge endpoint must refuse to settle in either case.
 */
export async function isBillingKeyActive(billingKey: string): Promise<boolean> {
  const snap = await db.collection('billingKeys').doc(hashBillingKey(billingKey)).get();
  if (!snap.exists) return false;
  return (snap.data() as BillingKeyDoc).active === true;
}

/** Revokes a billingKey by hash so the charge endpoint refuses it going forward. Idempotent. */
export async function revokeBillingKey(billingKey: string): Promise<void> {
  await db.collection('billingKeys').doc(hashBillingKey(billingKey)).set({ active: false }, { merge: true });
}

/** Thrown by resolveBillingKey with the same HTTP status the caller should return. */
export class BillingKeyError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Shared billingKey verification: decrypts it, checks it belongs to `platformId`, and checks it hasn't
 * been revoked. Every route that accepts a billingKey (charge, balance, disconnect, charge history)
 * needs exactly this check, so it lives here once rather than being copy-pasted per route.
 */
export async function resolveBillingKey(billingKey: string, platformId: string): Promise<{ cardId: string }> {
  let payload: BillingKeyPayload;
  try {
    payload = decryptBillingKey(billingKey);
  } catch {
    throw new BillingKeyError(401, 'Invalid billing key');
  }
  if (payload.platformId !== platformId) {
    throw new BillingKeyError(401, 'Billing key does not belong to this platform');
  }
  if (!(await isBillingKeyActive(billingKey))) {
    throw new BillingKeyError(401, 'Billing key has been revoked');
  }
  return { cardId: payload.cardId };
}
