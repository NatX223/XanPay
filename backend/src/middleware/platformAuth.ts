import { createHash } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebaseAdmin';
import type { ApiKeyIndexDoc, PlatformDoc } from '../types';
import type { Scope } from '../lib/apiKeys';

// P defaults to `any` (rather than the usual ParamsDictionary) so this cleanly
// intersects with a route's own, more specific `Request<{ id: string }, ...>` type.
export type PlatformAuthedRequest<P = any> = Request<P> & {
  platform: { platformId: string; keyId: string; merchantWalletAddress: string };
};

/**
 * API keys are stored hashed (sha256) with a lookup index at apiKeyIndex/{hash} → {platformId, keyId, scopes} —
 * auth is a single point read, never a plaintext-key query. Revoking a key deletes its index doc, so a
 * revoked key fails auth on its very next request with no caching lag. Each route declares the scope it
 * requires; a key missing that scope is rejected even though it's otherwise valid.
 */
export function requirePlatformAuth(requiredScope: Scope): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing bearer token' });
      return;
    }

    const apiKey = header.slice('Bearer '.length);
    const hash = createHash('sha256').update(apiKey).digest('hex');
    const indexSnap = await db.collection('apiKeyIndex').doc(hash).get();
    if (!indexSnap.exists) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
    const { platformId, keyId, scopes } = indexSnap.data() as ApiKeyIndexDoc;

    if (!scopes.includes(requiredScope)) {
      res.status(403).json({ error: `This API key is missing the required scope: ${requiredScope}` });
      return;
    }

    const platformSnap = await db.collection('platforms').doc(platformId).get();
    if (!platformSnap.exists) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
    const { merchantWalletAddress } = platformSnap.data() as PlatformDoc;

    (req as PlatformAuthedRequest).platform = { platformId, keyId, merchantWalletAddress };

    // Best-effort audit trail — never let telemetry block or fail the actual request.
    db.collection('platforms').doc(platformId).collection('apiKeys').doc(keyId)
      .update({ lastUsedAt: FieldValue.serverTimestamp() })
      .catch(() => {});

    next();
  };
}
