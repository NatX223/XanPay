import type { ChargeReceipt } from './types';

// Merges into the consuming app's own Express.Request (via @types/express) so req.xanpay is typed —
// this package doesn't depend on express itself, it just augments the ambient namespace if present.
declare global {
  namespace Express {
    interface Request {
      xanpay?: {
        billingKey?: string;
        lastReceipt?: ChargeReceipt;
      };
    }
  }
}

export {};
