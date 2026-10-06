/**
 * Broader than a strict 1:1 status-code mapping — the platform API sometimes returns the same HTTP
 * status for several distinct reasons (e.g. 402 covers insufficient balance *and* per-charge/daily/
 * monthly limit denials; 403 covers a paused, frozen, or not-yet-approved card). `code` groups those by
 * what the caller should do about them; always inspect `.message` for the specific reason.
 */
export type XanPayErrorCode =
  | 'invalid_request'
  | 'invalid_key'
  | 'card_not_found'
  | 'card_not_approved'
  | 'charge_declined'
  | 'rate_limited'
  | 'settlement_failed'
  | 'token_not_found'
  | 'token_used'
  | 'token_expired'
  | 'token_mismatch'
  | 'server_error'
  | 'network_error';

/** Thrown by every XanPay/XanPayBrowser network call that doesn't succeed. */
export class XanPayError extends Error {
  constructor(
    public readonly code: XanPayErrorCode,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'XanPayError';
  }
}
