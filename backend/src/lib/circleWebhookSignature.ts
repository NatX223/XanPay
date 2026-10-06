import { createPublicKey, createVerify, type KeyObject } from 'node:crypto';
import { circle } from '../circle';

/** Circle rotates signing keys occasionally but reuses a key id across many notifications — cache per id instead of re-fetching on every webhook. */
const keyCache = new Map<string, KeyObject>();

/**
 * Fetches (and caches) the public key for the signing key id Circle sends in `X-Circle-Key-Id`.
 * Circle's API returns the key as base64(DER SPKI) — *not* PEM — so it has to be imported with an
 * explicit `format`/`type` rather than handed to `verify()` as a string.
 * See https://developers.circle.com/api-reference/verify-webhook-signatures.
 */
async function getPublicKey(keyId: string): Promise<KeyObject> {
  const cached = keyCache.get(keyId);
  if (cached) return cached;

  const response = await circle.getNotificationSignature(keyId);
  const data = response.data;
  if (!data?.publicKey) {
    throw new Error(`Circle returned no public key for signature key id ${keyId}`);
  }
  const publicKey = createPublicKey({ key: Buffer.from(data.publicKey, 'base64'), format: 'der', type: 'spki' });
  keyCache.set(keyId, publicKey);
  return publicKey;
}

/**
 * Verifies a Circle webhook's `X-Circle-Signature` header against the raw request body.
 * Circle signs with `ECDSA_SHA_256` over the exact bytes of the request body — see app.ts's `verify`
 * hook on `express.json()`, which is what makes those raw bytes available here; re-serializing the
 * parsed JSON before verifying breaks this, since key order/whitespace aren't guaranteed to
 * round-trip identically (this is Circle's own documented warning, not a guess).
 *
 * Fails closed: any error (unknown key id, malformed signature, mismatch) returns false, and the
 * caller must reject the request rather than process it.
 */
export async function verifyCircleWebhookSignature(rawBody: Buffer, signatureBase64: string, keyId: string): Promise<boolean> {
  try {
    const publicKey = await getPublicKey(keyId);
    const verifier = createVerify('SHA256');
    verifier.update(rawBody);
    verifier.end();
    return verifier.verify(publicKey, signatureBase64, 'base64');
  } catch (err) {
    console.error('Circle webhook signature verification failed:', err);
    return false;
  }
}
