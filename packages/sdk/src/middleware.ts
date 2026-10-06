import { XanPayError } from './errors';
import type { ChargeParams, ChargeReceipt, ProtectOptions, XanPayNextFunction, XanPayRequest, XanPayResponse } from './types';

type ChargeFn = (params: ChargeParams) => Promise<ChargeReceipt>;

/**
 * Builds protect()'s Express middleware around a charge function rather than a whole XanPay instance —
 * XanPay.protect() just calls this with `this.charge.bind(this)`. Charges `options.price` against the
 * request's billingKey before calling next(); rejects the request (never calls next() with the route
 * unpaid) if the billingKey is missing or the charge itself fails.
 */
export function createProtectMiddleware(
  charge: ChargeFn,
  options: ProtectOptions,
): (req: XanPayRequest, res: XanPayResponse, next: XanPayNextFunction) => Promise<void> {
  const { price, reason, getBillingKey } = options;

  return async (req: XanPayRequest, res: XanPayResponse, next: XanPayNextFunction): Promise<void> => {
    const billingKey = getBillingKey ? await getBillingKey(req) : req.xanpay?.billingKey;
    if (!billingKey) {
      res.status(401).json({ error: 'No billing key — user has not linked a XanCard' });
      return;
    }

    try {
      const receipt = await charge({ billingKey, amount: price, reason: reason ?? 'API charge' });
      req.xanpay = { ...req.xanpay, lastReceipt: receipt };
      next();
    } catch (err) {
      if (err instanceof XanPayError) {
        res.status(err.statusCode || 502).json({ error: err.message });
        return;
      }
      // Not a XanPayError — an actual bug or unexpected throw, not a "the charge was declined"
      // outcome. Hand it to the app's own error-handling middleware instead of masking it as a 502.
      next(err);
    }
  };
}
