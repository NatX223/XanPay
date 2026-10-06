/**
 * Firestore holds app metadata only. Circle is the source of truth for
 * wallet balances and transaction history — routes call out to Circle
 * live (see circle.ts) rather than storing money-shaped data here.
 */

export interface UserDoc {
  name: string;
  email: string;
  circleWalletId: string;
  walletAddress: string;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface GroupDoc {
  userId: string;
  name: string;
  accent: string;
  glyph: string;
  createdAt: FirebaseFirestore.Timestamp;
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

/**
 * Server-maintained rolling spend counters used to enforce CardRules.daily/monthly/velocity at charge
 * time. Kept on the card doc itself (rather than derived by querying the charges subcollection) so a
 * charge can read+write them in the same Firestore transaction as the gatewayBalance decrement — that's
 * what makes the limit checks race-safe against concurrent charge requests, the same way the balance
 * check already is. Absent on cards that haven't been charged since this was introduced; treat as zero.
 */
export interface CardSpendCounters {
  dailySpent: number;
  /** YYYY-MM-DD in UTC. dailySpent resets to 0 whenever this stops matching the current day. */
  dailyKey: string;
  monthlySpent: number;
  /** YYYY-MM in UTC. monthlySpent resets to 0 whenever this stops matching the current month. */
  monthlyKey: string;
  /** Epoch ms of recent successful charges, pruned to the last 1s window, for the velocity (charges/sec) check. */
  recentChargeTimestamps: number[];
  /** Whether the card.spend_threshold webhook has already fired for the current dailyKey/monthlyKey — resets whenever the key rolls over, same as the spent counters, so a card gets exactly one alert per period. */
  dailyThresholdNotified?: boolean;
  monthlyThresholdNotified?: boolean;
}

export interface CardDoc {
  userId: string;
  groupId: string;
  name: string;
  last4: string;
  circleWalletId: string;
  walletAddress: string;
  active: boolean;
  rules: CardRules;
  /**
   * Cached USDC balance deposited into Circle Gateway for this card, decremented
   * as charges are submitted. Gateway settles batched charges asynchronously, so
   * this can't be derived live from Circle the way other balances are — it's the
   * only money-shaped value XanPay tracks itself. Absent on cards created before
   * Gateway charging existed; treat as 0.
   */
  gatewayBalance?: number;
  spend?: CardSpendCounters;
  createdAt: FirebaseFirestore.Timestamp;
}

/** A platform allowed to charge cards via POST /platform/charge. Firestore doc ID is sha256(apiKey) hex. */
export interface PlatformDoc {
  name: string;
  merchantWalletAddress: string;
  /** Firebase uid of the developer who self-registered this platform via POST /platform/register. Undefined for platforms created by the create-platform CLI script. */
  ownerUid?: string;
  /** Denormalized all-time totals, incremented atomically alongside each successful charge — avoids scanning the charges collection group to render the dashboard. Absent on platforms created before this existed; treat as 0. */
  totalSettledUsdc?: number;
  totalChargeCount?: number;
  /** Where XanPay POSTs charge.settled / card.spend_threshold events. Absent until the platform configures one via PUT /platform/webhooks. */
  webhookUrl?: string;
  /** HMAC-SHA256 signing secret for webhookUrl deliveries (whsec_... prefix). Stored in plaintext — unlike API keys, this must be re-readable to sign outgoing requests. */
  webhookSecret?: string;
  createdAt: FirebaseFirestore.Timestamp;
}

/** One charge attempt against a card, stored at cards/{cardId}/charges/{chargeId}. Always a new doc — never mutated. */
export interface ChargeDoc {
  platformId: string;
  /** Which of the platform's API keys authorized this charge — lets a compromised key's blast radius be audited after revocation. */
  keyId: string;
  /** The platforms/{id}/routes/{routeId} this charge was billed against, if the caller supplied one — null for free-form charges. */
  routeId: string | null;
  amount: number;
  reason: string;
  txId: string;
  timestamp: FirebaseFirestore.Timestamp;
  status: 'pending';
}

/**
 * A priced, named endpoint a platform wants to charge for, stored at platforms/{platformId}/routes/{routeId}.
 * Purely a pricing catalog + audit label — XanPay doesn't proxy or intercept the platform's actual HTTP
 * traffic. When a charge names a routeId, the charge amount must exactly match the route's configured
 * price, which stops a compromised or buggy client from charging arbitrary amounts under that route's name.
 */
export interface RouteDoc {
  path: string;
  method: string;
  /** USDC, e.g. 0.0012. */
  price: number;
  status: 'live' | 'paused';
  /** Denormalized, incremented atomically alongside each successful charge against this route. */
  calls: number;
  revenue: number;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/** One UTC calendar day's rollup for a platform, stored at platforms/{platformId}/dailyStats/{YYYY-MM-DD}. Powers the settlements chart without scanning individual charges. */
export interface DailyStatsDoc {
  settledUsdc: number;
  chargeCount: number;
}

/**
 * One API key, stored at platforms/{platformId}/apiKeys/{keyId}. Only `hash` (sha256 of the secret) and
 * `last4` are kept — the plaintext secret is returned once, at creation/roll time, and never stored.
 * Revocation is soft (revokedAt set) so the key list stays visible, but auth is gated by the *existence*
 * of the corresponding apiKeyIndex/{hash} doc, which is deleted immediately on revoke.
 */
export interface ApiKeyDoc {
  name: string;
  last4: string;
  hash: string;
  scopes: string[];
  createdAt: FirebaseFirestore.Timestamp;
  lastUsedAt: FirebaseFirestore.Timestamp | null;
  revokedAt: FirebaseFirestore.Timestamp | null;
}

/** Lookup index at apiKeyIndex/{sha256(secret)} → owning platform/key, so auth is a single point read instead of a query. */
export interface ApiKeyIndexDoc {
  platformId: string;
  keyId: string;
  scopes: string[];
}

/**
 * A short-lived, single-use token stored at linkTokens/{linkToken} (doc id is the token itself, a UUID).
 * Minted by POST /platform/link/approve once a signed-in user picks a card in the connect-modal, and
 * burned by POST /platform/link/exchange when the platform's backend trades it for a billingKey.
 */
export interface LinkTokenDoc {
  cardId: string;
  platformId: string;
  createdAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
  used: boolean;
}

/**
 * One issued billing key, stored at billingKeys/{sha256(billingKey)} — the plaintext key is never stored,
 * only its hash. Lets the charge endpoint check revocation without decrypting, and gives an audit trail.
 * cardId here is for internal reference only; it's never returned to platforms.
 */
export interface BillingKeyDoc {
  cardId: string;
  platformId: string;
  createdAt: FirebaseFirestore.Timestamp;
  active: boolean;
}

export type WithId<T> = T & { id: string };

/** JSON-serializes a doc for API responses: adds `id`, turns Firestore Timestamp into an ISO string. */
export function toApiDoc<T extends { createdAt: FirebaseFirestore.Timestamp }>(
  id: string,
  data: T,
): WithId<Omit<T, 'createdAt'> & { createdAt: string }> {
  return { id, ...data, createdAt: data.createdAt.toDate().toISOString() };
}
