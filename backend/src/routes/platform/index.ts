import { Router } from 'express';
import balanceRouter from './balance';
import chargeRouter from './charge';
import chargesRouter from './charges';
import disconnectRouter from './disconnect';
import keysRouter from './keys';
import linkRouter from './link';
import meRouter from './me';
import publicRouter from './public';
import registerRouter from './register';
import routesRouter from './routes';
import statsRouter from './stats';
import webhooksRouter from './webhooks';

const router = Router();

// Bearer = platform API key (see requirePlatformAuth in charge.ts).
router.use('/charge', chargeRouter);
router.use('/balance', balanceRouter);
router.use('/disconnect', disconnectRouter);

// Bearer = Firebase ID token (see requireAuth) — used by the developer onboarding/dashboard UI.
router.use('/register', registerRouter);
router.use('/me', meRouter);
router.use('/keys', keysRouter);
router.use('/routes', routesRouter);
router.use('/stats', statsRouter);
router.use('/webhooks', webhooksRouter);

// Mixed: '/' is Firebase-ID-token-authed (dashboard request log), '/by-key' is platform-API-key-authed
// (SDK's getChargeHistory) — see charges.ts for why each route sets its own auth instead of router.use().
router.use('/charges', chargesRouter);

// Card-to-platform linking (connect-modal flow) — /approve is Firebase-ID-token-authed (the card owner),
// /exchange is platform-API-key-authed. See link.ts for why each is split that way.
router.use('/link', linkRouter);

// Unauthenticated — the connect-modal iframe looks up a platform's display name before login.
router.use('/public', publicRouter);

export default router;
