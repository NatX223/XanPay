export interface XanPayConfig {
  /** Platform's secret key (sk_xan_...). Server-side only — never ship this to a browser bundle. */
  apiKey: string;
  platformId: string;
  /** Defaults to https://api.xanpay.com. Override for local development. */
  baseUrl?: string;
}

export interface XanPayBrowserConfig {
  platformId: string;
  /** Defaults to https://xanpay.com. Override for local development. */
  baseUrl?: string;
}

export interface ChargeParams {
  billingKey: string;
  /** USDC amount, e.g. 0.001. */
  amount: number;
  reason: string;
}

export interface ChargeReceipt {
  chargeId: string;
  txId: string;
  amount: number;
  timestamp: string;
}

export interface ChargeRecord {
  chargeId: string;
  amount: number;
  reason: string;
  routeId: string | null;
  status: string;
  txId: string;
  timestamp: string;
}

export interface ChargeHistoryParams {
  billingKey: string;
  limit?: number;
  /** chargeId to page after — pass the last chargeId from the previous page's `charges` array. */
  startAfter?: string;
}

export interface ChargeHistoryResult {
  charges: ChargeRecord[];
  hasMore: boolean;
}

export interface CardBalance {
  available: number;
  currency: 'USDC';
}

export type XanPayEventType = 'charge.settled' | 'card.spend_threshold';

export interface XanPayEvent {
  type: XanPayEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

/** Minimal, structural request/response/next shapes so protect() doesn't need an express dependency — any real Express Request/Response/NextFunction satisfies these. */
export interface XanPayRequest {
  headers: Record<string, string | string[] | undefined>;
  xanpay?: {
    billingKey?: string;
    lastReceipt?: ChargeReceipt;
  };
}
export interface XanPayResponse {
  status(code: number): XanPayResponse;
  json(body: unknown): void;
}
export type XanPayNextFunction = (err?: unknown) => void;

export interface ProtectOptions {
  /** USDC amount to charge per request. */
  price: number;
  /** Recorded as the charge's reason. Defaults to 'API charge'. */
  reason?: string;
  /** Custom billingKey extractor. Defaults to reading req.xanpay?.billingKey, set by the platform's own auth middleware upstream of protect(). */
  getBillingKey?: (req: XanPayRequest) => string | undefined | Promise<string | undefined>;
}
