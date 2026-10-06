import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import cardsRouter from './routes/cards';
import groupsRouter from './routes/groups';
import platformRouter from './routes/platform';
import usersRouter from './routes/users';
import webhooksRouter from './routes/webhooks';

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true }));
  app.use(
    express.json({
      // Webhook signature verification (routes/webhooks.ts) needs the *exact* bytes the sender
      // signed — the parsed-then-reserialized JSON body isn't guaranteed to match byte-for-byte.
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/users', usersRouter);
  app.use('/groups', groupsRouter);
  app.use('/cards', cardsRouter);
  app.use('/platform', platformRouter);
  app.use('/webhooks', webhooksRouter);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  });

  return app;
}
