/** Shapes returned by the backend API. createdAt is an ISO string (serialized from a Firestore Timestamp). */

export interface User {
  id: string;
  name: string;
  email: string;
  circleWalletId: string;
  walletAddress: string;
  createdAt: string;
}

export interface Group {
  id: string;
  userId: string;
  name: string;
  accent: string;
  glyph: string;
  createdAt: string;
}

export interface CardRules {
  monthly: number;
  perCharge: string;
  daily: string;
  velocity: string;
  autopause: boolean;
  approve: boolean;
  frozen: boolean;
  platforms: string[];
}

export interface Card {
  id: string;
  userId: string;
  groupId: string;
  name: string;
  last4: string;
  circleWalletId: string;
  walletAddress: string;
  active: boolean;
  rules: CardRules;
  /** Cached USDC balance deposited into Circle Gateway — what a platform charge actually draws from. Absent on older cards; treat as 0. */
  gatewayBalance?: number;
  createdAt: string;
}

export interface TokenBalance {
  token: { symbol?: string; name?: string };
  amount: string;
}

/**
 * `GET /cards/:id/balance` — `gatewayBalance` is the spendable number (what a platform charge
 * actually draws from; see backend's lib/gatewaySweep.ts). `tokenBalances` is the card's raw
 * on-chain wallet balance, kept only for debugging/support — don't show it as "the balance".
 */
export interface CardBalance {
  gatewayBalance: number;
  tokenBalances: TokenBalance[];
}

/** `POST /cards/:id/withdraw` — pulls USDC back out of Circle Gateway to the card's own wallet. */
export interface WithdrawResult {
  withdrawn: number;
  gatewayBalance: number;
  mintTransactionId: string;
}

export interface CircleTransaction {
  id: string;
  walletId: string;
  amounts?: string[];
  transactionType?: string;
  state?: string;
  createDate?: string;
}

export interface Platform {
  id: string;
  name: string;
  merchantWalletAddress: string;
  ownerUid?: string;
  createdAt: string;
}

/** Returned once, from POST /platform/register — the plaintext apiKey is never stored or shown again after this. */
export interface PlatformRegistration {
  platformId: string;
  apiKey: string;
  name: string;
  merchantWalletAddress: string;
}

/** An API key's metadata — never carries the plaintext secret or its hash. */
export interface ApiKeySummary {
  id: string;
  name: string;
  last4: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

/** Returned once, from creating or rolling a key — the plaintext apiKey is never retrievable again after this. */
export interface ApiKeyCreated {
  id: string;
  apiKey: string;
  name: string;
  last4: string;
  scopes: string[];
}

/** A priced, named endpoint the platform charges for. XanPay doesn't proxy traffic — this is a pricing catalog + audit label enforced when a charge names this route's id. */
export interface RouteSummary {
  id: string;
  path: string;
  method: string;
  price: number;
  status: 'live' | 'paused';
  calls: number;
  revenue: number;
  createdAt: string;
  updatedAt: string;
}

export interface StatsDayPoint {
  date: string;
  settledUsdc: number;
  chargeCount: number;
}

export interface PlatformStats {
  totalSettledUsdc: number;
  totalChargeCount: number;
  rangeSettledUsdc: number;
  rangeChargeCount: number;
  chargesToday: number;
  activeRoutes: number;
  series: StatsDayPoint[];
}

/** The safe subset of a platform's info exposed to the unauthenticated connect-modal iframe. */
export interface PublicPlatform {
  id: string;
  name: string;
}

export interface ChargeLogEntry {
  id: string;
  amount: number;
  reason: string;
  routeId: string | null;
  status: string;
  txId: string;
  keyId: string;
  timestamp: string;
}
