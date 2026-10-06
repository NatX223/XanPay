import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../firebaseAdmin';

// P defaults to `any` (rather than the usual ParamsDictionary) so this cleanly
// intersects with a route's own, more specific `Request<{ id: string }, ...>` type.
export type AuthedRequest<P = any> = Request<P> & { uid: string };

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(header.slice('Bearer '.length));
    (req as AuthedRequest).uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
