import { createHmac, timingSafeEqual } from 'node:crypto';
import { XanPayError } from './errors';
import type { XanPayEvent } from './types';

/**
 * Verifies and parses an incoming XanPay webhook delivery (charge.settled / card.spend_threshold — see
 * PUT /platform/webhooks for configuring the endpoint that receives these). `signature` is the raw
 * X-XanPay-Signature header value (`sha256=<hex>`), HMAC-SHA256'd over the exact raw request body using
 * the platform's webhookSecret. Compares in constant time to avoid leaking the expected signature via
 * response-time differences. Throws XanPayError('invalid_request', ...) if verification fails.
 */
export function constructEvent(rawBody: Buffer | string, signature: string, webhookSecret: string): XanPayEvent {
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expected = createHmac('sha256', webhookSecret).update(body).digest('hex');
  const provided = signature.startsWith('sha256=') ? signature.slice('sha256='.length) : signature;

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  const signatureValid = expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf);
  if (!signatureValid) {
    throw new XanPayError('invalid_request', 'Webhook signature verification failed', 400);
  }

  return JSON.parse(body) as XanPayEvent;
}
