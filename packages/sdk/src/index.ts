import './express';
import { XanPayError, type XanPayErrorCode } from './errors';
import { createProtectMiddleware } from './middleware';
import type {
  CardBalance,
  ChargeHistoryParams,
  ChargeHistoryResult,
  ChargeParams,
  ChargeReceipt,
  ProtectOptions,
  XanPayConfig,
  XanPayNextFunction,
  XanPayRequest,
  XanPayResponse,
} from './types';

const DEFAULT_BASE_URL = 'https://api.xanpay.com';

function chargeErrorCode(status: number): XanPayErrorCode {
  switch (status) {
    case 400: return 'invalid_request';
    case 401: return 'invalid_key';
    case 402: return 'charge_declined';
    case 403: return 'card_not_approved';
    case 404: return 'card_not_found';
    case 429: return 'rate_limited';
    case 502: return 'settlement_failed';
    default: return 'server_error';
  }
}

function linkExchangeErrorCode(status: number): XanPayErrorCode {
  switch (status) {
    case 401: return 'token_mismatch';
    case 404: return 'token_not_found';
    case 410: return 'token_used';
    case 400: return 'token_expired';
    default: return 'server_error';
  }
}

/** billingKey verification errors — shared shape across getBalance/disconnect/getChargeHistory. */
function billingKeyErrorCode(status: number): XanPayErrorCode {
  switch (status) {
    case 400: return 'invalid_request';
    case 401: return 'invalid_key';
    case 404: return 'card_not_found';
    default: return 'server_error';
  }
}

/**
 * Server-side XanPay client. charge() is the foundation — exchangeLinkToken(), protect(), getBalance(),
 * disconnect(), and getChargeHistory() all either call it or hit the same authenticated request path.
 * Never import this in browser code: apiKey must stay server-side. For the browser connect-modal flow,
 * see XanPayBrowser in '@xanpay/sdk/browser'.
 */
export class XanPay {
  private readonly apiKey: string;
  private readonly platformId: string;
  private readonly baseUrl: string;

  constructor(config: XanPayConfig) {
    if (!config.apiKey) throw new Error('XanPay: apiKey is required');
    if (!config.platformId) throw new Error('XanPay: platformId is required');
    this.apiKey = config.apiKey;
    this.platformId = config.platformId;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  private async requestRaw(path: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
    let res: Response;
    try {
      res = await fetch(new URL(path, this.baseUrl), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...init.headers,
        },
      });
    } catch (err) {
      throw new XanPayError('network_error', err instanceof Error ? err.message : 'Network request failed', 0);
    }
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  /**
   * Core function — every other charge-related method (and protect()) calls this. POST /platform/charge.
   * Throws XanPayError on a non-2xx response; `.code` groups the reason (see errors.ts), `.message` has
   * the specific one (insufficient balance vs. a daily/monthly limit vs. per-charge limit, etc).
   */
  async charge(params: ChargeParams): Promise<ChargeReceipt> {
    const { status, body } = await this.requestRaw('/platform/charge', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (status === 201) return body as ChargeReceipt;
    throw new XanPayError(chargeErrorCode(status), body?.error ?? `Charge failed with status ${status}`, status);
  }

  /**
   * Exchanges a one-time linkToken (received via XanPayBrowser.link()'s onSuccess callback) for an
   * encrypted billingKey. Call this from the platform's backend callback handler. The token expires in
   * 10 minutes and is single-use. POST /platform/link/exchange.
   */
  async exchangeLinkToken(linkToken: string): Promise<{ billingKey: string }> {
    const { status, body } = await this.requestRaw('/platform/link/exchange', {
      method: 'POST',
      body: JSON.stringify({ linkToken }),
    });
    if (status === 201) return body as { billingKey: string };
    throw new XanPayError(
      linkExchangeErrorCode(status),
      body?.error ?? `Link token exchange failed with status ${status}`,
      status,
    );
  }

  /** Returns a card's current spendable Gateway balance. GET /platform/balance. */
  async getBalance(billingKey: string): Promise<CardBalance> {
    const { status, body } = await this.requestRaw(`/platform/balance?billingKey=${encodeURIComponent(billingKey)}`);
    if (status === 200) return body as CardBalance;
    throw new XanPayError(billingKeyErrorCode(status), body?.error ?? `getBalance failed with status ${status}`, status);
  }

  /**
   * Revokes a billingKey and removes this platform from the card's approved list. Call when a user
   * removes their linked XanCard from the platform's own settings UI. POST /platform/disconnect.
   */
  async disconnect(billingKey: string): Promise<{ success: boolean }> {
    const { status, body } = await this.requestRaw('/platform/disconnect', {
      method: 'POST',
      body: JSON.stringify({ billingKey }),
    });
    if (status === 200) return body as { success: boolean };
    throw new XanPayError(billingKeyErrorCode(status), body?.error ?? `disconnect failed with status ${status}`, status);
  }

  /** Paginated charge history for a single billingKey. GET /platform/charges/by-key. */
  async getChargeHistory(params: ChargeHistoryParams): Promise<ChargeHistoryResult> {
    const query = new URLSearchParams({ billingKey: params.billingKey });
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.startAfter !== undefined) query.set('startAfter', params.startAfter);

    const { status, body } = await this.requestRaw(`/platform/charges/by-key?${query.toString()}`);
    if (status === 200) return body as ChargeHistoryResult;
    throw new XanPayError(
      billingKeyErrorCode(status),
      body?.error ?? `getChargeHistory failed with status ${status}`,
      status,
    );
  }

  /**
   * Returns Express-style middleware that charges `options.price` against the request's billingKey
   * (read from req.xanpay?.billingKey by default — set that in your own auth middleware upstream, or
   * pass getBillingKey) before calling next(). Rejects the request rather than passing it through if
   * the billingKey is missing or the charge fails.
   */
  protect(
    options: ProtectOptions,
  ): (req: XanPayRequest, res: XanPayResponse, next: XanPayNextFunction) => Promise<void> {
    return createProtectMiddleware((params) => this.charge(params), options);
  }
}

export { XanPayError };
export { constructEvent } from './webhooks';
export type {
  CardBalance,
  ChargeHistoryParams,
  ChargeHistoryResult,
  ChargeParams,
  ChargeReceipt,
  ChargeRecord,
  ProtectOptions,
  XanPayConfig,
  XanPayEvent,
  XanPayEventType,
  XanPayNextFunction,
  XanPayRequest,
  XanPayResponse,
} from './types';
export type { XanPayErrorCode } from './errors';
