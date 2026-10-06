# XanPay — Project Documentation

XanPay lets a person turn USDC into a spendable "card" and lets a platform (an API/SaaS
developer) charge that card per-request for nanopayments — sub-cent, gas-free charges settled
on-chain via Circle Gateway. This document covers the whole system: architecture, data model,
every REST endpoint, the money-movement flows, auth models, webhooks, environment setup, and the
`@xanpay/sdk` package.

## Contents

1. [Architecture](#1-architecture)
2. [Data model](#2-data-model-firestore)
3. [Auth models](#3-auth-models)
4. [Consumer API](#4-consumer-api-firebase-id-token)
5. [Platform API](#5-platform-api)
6. [Money flows](#6-money-flows)
7. [Card rules engine](#7-card-rules-engine)
8. [Webhooks](#8-webhooks)
9. [Rate limiting](#9-rate-limiting)
10. [Environment variables](#10-environment-variables)
11. [Setup & local development](#11-setup--local-development)
12. [The SDK (`@xanpay/sdk`)](#12-the-sdk-xanpaysdk)

---

## 1. Architecture

```
┌─────────────┐      Firebase ID token       ┌──────────────────┐
│  Consumer    │ ────────────────────────────▶│                  │
│  (web app)   │                               │                  │
└─────────────┘                               │                  │
                                               │   XanPay backend │
┌─────────────┐   API key (sk_xan_...)         │   (Express +     │
│  Platform    │ ────────────────────────────▶│   Firestore)     │
│  backend     │◀──────────────────────────── │                  │
└─────────────┘   outbound webhook (HMAC)      │                  │
                                               └─────────┬────────┘
                                                         │
                                       Circle Developer-Controlled Wallets
                                       (custody + MPC signing, no private
                                        keys ever touch this backend)
                                                         │
                                                         ▼
                                          Circle Gateway  /  Arc or EVM chain
                                          (gas-free settlement, unified balance)
```

- **Firestore** holds all app metadata (users, groups, cards, platforms, API keys, routes,
  charges, link tokens, billing keys). It is *not* the source of truth for money — Circle is.
  `cards/{id}.gatewayBalance` is the one exception: a cached ledger of what's spendable via
  Gateway, since Gateway settlement is asynchronous (see [§6](#6-money-flows)).
- **Circle Developer-Controlled Wallets** custody every wallet XanPay creates (one per user, one
  per card, one gas-sponsor wallet, one per platform's merchant wallet address is supplied by the
  platform, not created here). Signing happens via Circle's MPC API — no private key is ever held
  by this backend.
- **Circle Gateway** is what makes charges gas-free and instant from the platform's perspective:
  a card's wallet deposits USDC into Gateway once (the "sweep"), and after that, charges are
  EIP-3009 `TransferWithAuthorization` messages signed by the card's wallet and settled in a
  batch by Gateway's facilitator — no on-chain transaction (and no gas) per charge.
- **Express** (`src/app.ts`) is a thin router: `cors` → `express.json` (with a raw-body capture
  hook, needed for verifying Circle's webhook signature) → route mounts → a catch-all error
  handler that logs and returns `500`.

## 2. Data model (Firestore)

All types are defined in `src/types.ts`. Firestore holds metadata only — money-shaped fields are
called out explicitly below.

| Collection | Doc ID | Shape | Notes |
|---|---|---|---|
| `users/{uid}` | Firebase uid | `UserDoc` | `circleWalletId`/`walletAddress` — a general wallet, not a card. |
| `groups/{id}` | auto | `GroupDoc` | User-owned card folders (`accent`/`glyph` are UI only). |
| `cards/{id}` | auto | `CardDoc` | Has `rules: CardRules`, `spend?: CardSpendCounters`, `gatewayBalance?: number` (the only real money value XanPay tracks itself). |
| `cards/{id}/charges/{chargeId}` | auto | `ChargeDoc` | One row per settled charge. `status` is always `'pending'` today — nothing ever transitions it (see [§6](#6-money-flows)). |
| `platforms/{id}` | auto (also the id embedded in API keys' hash lookups) | `PlatformDoc` | `merchantWalletAddress` is where charges pay out to. `webhookUrl`/`webhookSecret` configure outbound event delivery. |
| `platforms/{id}/apiKeys/{keyId}` | auto | `ApiKeyDoc` | Only `hash` (sha256) + `last4` stored — the plaintext secret is shown once, at issuance/roll. |
| `apiKeyIndex/{sha256(secret)}` | the hash | `ApiKeyIndexDoc` | Auth is a single point read against this, not a query — see [§3](#3-auth-models). |
| `platforms/{id}/routes/{routeId}` | auto | `RouteDoc` | A priced, named endpoint — a pricing catalog + audit label. XanPay never proxies the platform's actual HTTP traffic. |
| `platforms/{id}/dailyStats/{YYYY-MM-DD}` | UTC day | `DailyStatsDoc` | Rollup powering the settlements chart without scanning `charges`. |
| `linkTokens/{token}` | the token (UUID) | `LinkTokenDoc` | Single-use, 10-minute TTL, minted by `/platform/link/approve`, burned by `/platform/link/exchange`. |
| `billingKeys/{sha256(billingKey)}` | the hash | `BillingKeyDoc` | Revocation/active-state lookup. The plaintext billingKey is never stored — it's a self-contained encrypted token (see below). |

### `CardRules` (per-card spend policy, user-controlled)

```ts
{
  monthly: number;       // advisory unless autopause is on
  perCharge: string;     // max USDC per single charge
  daily: string;         // max USDC per UTC day
  velocity: string;      // max charges per second
  autopause: boolean;    // when true, monthly becomes a hard block
  approve: boolean;      // stored, but not enforced anywhere yet
  frozen: boolean;       // hard block on all charges
  platforms: string[];   // allowlist of platformIds permitted to charge this card
}
```

### The billingKey

A billingKey is **not** a database lookup key — it's a self-contained, encrypted, platform-scoped
token: `xanpay_bk_` + AES-256-GCM(`{ cardId, platformId }`), keyed by `BILLING_KEY_SECRET`. This
means:
- A platform can hold a billingKey and use it, but can never read the `cardId` inside it.
- Every route that accepts one must decrypt it, confirm the embedded `platformId` matches the
  caller, and check `billingKeys/{hash}.active` for revocation — this exact sequence is
  centralized in `resolveBillingKey()` (`src/lib/billingKey.ts`) and reused by every endpoint that
  takes a billingKey.
- Losing `BILLING_KEY_SECRET` (or rotating it without a migration) makes every issued billingKey
  permanently undecryptable.

## 3. Auth models

XanPay has **five** distinct authentication mechanisms — know which one a given route uses:

| Mechanism | Header | Used by | Verification |
|---|---|---|---|
| Firebase ID token | `Authorization: Bearer <idToken>` | Consumer app (`/users`, `/groups`, `/cards`) and the developer dashboard (`/platform/register`, `/me`, `/keys`, `/routes`, `/stats`, `/charges`, `/webhooks` config, `/link/approve`) | `adminAuth.verifyIdToken()` — see `middleware/auth.ts` |
| Platform API key | `Authorization: Bearer sk_xan_...` | `/platform/charge`, `/balance`, `/disconnect`, `/charges/by-key`, `/link/exchange` | sha256(key) looked up directly at `apiKeyIndex/{hash}` — no query, no plaintext comparison. Each route also declares a required **scope** (`charges:write`, `charges:read`, `link:exchange`); a key missing it gets `403`. See `middleware/platformAuth.ts`. |
| billingKey | request body/query param, not a header | `/platform/charge`, `/balance`, `/disconnect`, `/charges/by-key` | `resolveBillingKey()` — decrypt, confirm platform ownership, check not revoked. |
| Circle webhook signature | `X-Circle-Signature` + `X-Circle-Key-Id` | `POST /webhooks/circle` (inbound, from Circle) | ECDSA-SHA256 against Circle's published public key for that key id — see `lib/circleWebhookSignature.ts`. Fails closed. |
| XanPay webhook signature | `X-XanPay-Signature: sha256=<hex>` | Outbound deliveries to a platform's own `webhookUrl` | HMAC-SHA256 with the platform's `webhookSecret` — see `lib/webhooks.ts` (sign) and `@xanpay/sdk`'s `constructEvent()` (verify, constant-time). |

API key scopes today: `charges:write` (charge), `charges:read` (balance/history), `link:exchange`
(exchange a linkToken, disconnect). New keys get all scopes by default unless the caller specifies
a subset (`POST /platform/keys`).

## 4. Consumer API (Firebase ID token)

Base path is the collection name directly (no `/api` prefix).

| Method & path | Purpose |
|---|---|
| `POST /users` | Create-or-fetch the caller's profile; provisions a Circle wallet on first call. |
| `GET /users/me` | Fetch own profile. |
| `GET /users/me/activity` | Circle transaction history across every card the user owns. |
| `POST /groups` | Create a card folder. |
| `GET /groups` | List own groups. |
| `PATCH /groups/:id` | Rename / restyle. |
| `DELETE /groups/:id` | Deletes the group **and cascades to delete its cards** (no dangling `groupId`). |
| `GET /groups/:id/activity` | Circle activity across every card in the group. |
| `POST /cards` | Create a card in a group; provisions a Circle wallet, seeds `CardRules` defaults. |
| `GET /cards` | List own cards. |
| `GET /cards/:id` | Fetch one card. |
| `GET /cards/:id/balance` | Spendable Gateway balance. Best-effort sweeps wallet USDC into Gateway first (see [§6](#6-money-flows)); a sweep failure never fails this request. |
| `POST /cards/:id/withdraw` | Pulls `amount` USDC **out** of Gateway back to the card's own wallet. Unlike balance, failures here are surfaced (this moves money). |
| `GET /cards/:id/activity` | Circle transaction history for this one card. |
| `PATCH /cards/:id/rules` | Partial update to `CardRules`. |
| `PATCH /cards/:id/active` | Pause/unpause the card. |
| `DELETE /cards/:id` | Refuses with `409` if `gatewayBalance > 0` — withdraw first. |

## 5. Platform API

Mounted at `/platform`. Split by auth mechanism — see the table below and `routes/platform/index.ts`
for the exact mount/middleware wiring.

### Firebase-ID-token-authed (developer dashboard)

| Method & path | Purpose |
|---|---|
| `POST /platform/register` | Self-serve signup: one platform per Firebase account. Provisions a Circle merchant wallet and a default API key (all scopes). `409` if already registered. |
| `GET /platform/me` | The caller's own platform, or `404` if not yet registered. |
| `GET /platform/keys` | List API keys (never returns secrets or hashes). |
| `POST /platform/keys` | Issue a new key. `{ name, scopes? }`. Max 10 active keys/platform. |
| `DELETE /platform/keys/:id` | Revoke (deletes the `apiKeyIndex` doc — auth fails on the very next request). |
| `POST /platform/keys/:id/roll` | Revoke + reissue with the same name/scopes in one call. |
| `GET /platform/routes` | List the pricing catalog. |
| `POST /platform/routes` | Create a priced route: `{ path, method, price }`. Max 50/platform, unique on `(path, method)`. |
| `PATCH /platform/routes/:id` | Update `price` and/or `status` (`'live' | 'paused'`). |
| `DELETE /platform/routes/:id` | Remove a route (existing charge history is unaffected). |
| `GET /platform/stats?range=7d\|30d\|90d` | Settlement totals + daily time series, read from the `dailyStats` rollup. |
| `GET /platform/charges?limit=` | Recent charges across every card this platform has charged — powers the dashboard's request log. |
| `POST /platform/link/approve` | Called from inside the connect-modal by the **card owner** (not the platform) once they pick a card to approve. Adds the platform to the card's allowlist, mints a 10-minute single-use `linkToken`. |
| `GET /platform/webhooks` | Current `webhookUrl`/`webhookSecret`, or `null` if unconfigured. |
| `PUT /platform/webhooks` | Set/replace the webhook endpoint: `{ url }` (must be `https://`). (Re)issues `webhookSecret`. |
| `DELETE /platform/webhooks` | Clear the webhook config. |

### Platform-API-key-authed (called by a platform's own backend, e.g. via `@xanpay/sdk`)

| Method & path | Scope | Purpose |
|---|---|---|
| `POST /platform/charge` | `charges:write` | The core money-moving endpoint. `{ billingKey, amount, reason, routeId? }` → reserves funds, settles via Gateway, records the charge. See [§6](#6-money-flows) for the full flow and every error case. |
| `GET /platform/balance?billingKey=` | `charges:read` | `{ available: number, currency: 'USDC' }` — the card's `gatewayBalance`. |
| `POST /platform/disconnect` | `link:exchange` | `{ billingKey }` — reverses `/link/approve`: revokes the billingKey and removes this platform from the card's allowlist. |
| `GET /platform/charges/by-key?billingKey=&limit=&startAfter=` | `charges:read` | Cursor-paginated charge history for one billingKey, scoped to charges *this platform* made (a card can be linked to several platforms, each with its own billingKey and history). `startAfter` is the last page's final `chargeId`. |
| `POST /platform/link/exchange` | `link:exchange` | `{ linkToken }` → `{ billingKey }`. Single-use; the used-check and used-flag write happen inside one Firestore transaction so two concurrent exchanges of the same token can't both succeed. |

### Unauthenticated

| Method & path | Purpose |
|---|---|
| `GET /platform/public/:id` | Connect-modal iframe looks up a platform's display name before the user signs in. Returns only `{ id, name }` — never the wallet address, owner, or totals. |

### `POST /platform/charge` error reference

Every non-2xx response is `{ error: string }`. Statuses are reused across multiple distinct
reasons — inspect the message, not just the code, if you need to distinguish them:

| Status | Reasons |
|---|---|
| `400` | Missing/invalid `billingKey`/`amount`/`reason`; unknown/paused `routeId`; `amount` doesn't match the route's configured price. |
| `401` | billingKey is malformed / tampered with (GCM auth tag mismatch); belongs to a different platform; has been revoked. |
| `402` | Charge exceeds the card's `perCharge`/`daily`/`monthly` (when `autopause` is on) limit; insufficient `gatewayBalance`. |
| `403` | Card is paused (`active: false`); card is frozen (`rules.frozen`); this platform isn't on the card's `rules.platforms` allowlist. |
| `404` | Card not found. |
| `429` | Card has exceeded its `velocity` (charges/sec) limit. |
| `502` | Gateway settlement itself failed *after* funds were reserved — the reservation (balance + daily/monthly counters) is automatically refunded. |

## 6. Money flows

### Deposit → spendable (the "sweep")

A card's Circle wallet can receive USDC like any address, but that balance isn't directly
chargeable — it first has to move into Circle Gateway. `lib/gatewaySweep.ts` does this:

1. Read the card wallet's on-chain USDC balance via Circle.
2. If below `GATEWAY_SWEEP_MIN_USDC` (default `0.01`), no-op.
3. Card wallets hold no native gas of their own, so `ensureGas()` tops the wallet up from a
   dedicated **gas-sponsor wallet** first (skipped with a one-time warning if
   `CIRCLE_GAS_SPONSOR_WALLET_ID` isn't configured — sweeps then fail for gas-less wallets).
4. Two on-chain calls, both MPC-signed by the card's own wallet, each awaited to `CONFIRMED`
   before the next: `approve(gatewayWallet, amount)` on the USDC contract, then
   `deposit(usdc, amount)` on Gateway's `GatewayWallet` contract.
5. `cards/{id}.gatewayBalance` is incremented by the swept amount.

This runs proactively (triggered by Circle's inbound-transaction webhook, `POST
/webhooks/circle`) and inline as a fallback (`GET /cards/:id/balance` re-checks and sweeps before
returning). A sweep failure is always logged and swallowed by both callers — it just means the
balance shown is whatever was already swept as of the last success.

### Charging (`POST /platform/charge`)

1. **Reserve, atomically.** `db.runTransaction` reads the card doc, runs
   `evaluateChargeRules()` (frozen/paused/allowlist, per-charge/daily/monthly/velocity — see
   [§7](#7-card-rules-engine)), checks `gatewayBalance >= amount`, then
   `tx.update(gatewayBalance: -amount, ...spend counters)` — all inside the same transaction, so
   two concurrent charges against the same card can't both pass the check and overdraw it.
2. **Settle.** `lib/gatewayClient.ts` signs an EIP-3009 `TransferWithAuthorization` from the
   card's wallet to the platform's `merchantWalletAddress` (MPC-signed, gas-free) and submits it
   to Circle Gateway's batched x402 facilitator, which settles it on-chain itself. Returns a
   `txId`.
3. **On settlement failure**, the reservation is refunded (`gatewayBalance` and the daily/monthly
   spend counters get the amount credited back) and `502` is returned — a failed charge never
   counts against a card's limits.
4. **On success**, a `charges/{chargeId}` doc is written (`status: 'pending'` — nothing
   transitions this today; it's a settlement-submitted marker, not a lifecycle field), platform
   and route stats are incremented, and `charge.settled` (plus any newly-crossed
   `card.spend_threshold`) webhook events are dispatched **fire-and-forget** — they never delay
   or affect the HTTP response.

### Withdrawing (`POST /cards/:id/withdraw`)

The inverse of the sweep, but not a simple reverse call — Gateway balance can't be pulled out
with a plain signed contract call. It's a burn/mint attestation flow (`lib/gatewayWithdraw.ts`):

1. `gatewayBalance` is decremented up front, inside a transaction (refunded if anything below
   fails).
2. The card's wallet signs a `BurnIntent` (EIP-712) authorizing Circle to burn `amount` from its
   Gateway balance and mint it back to the same address.
3. The signed intent is posted to Circle Gateway's `/transfer` API, which attests it.
4. The **gas-sponsor wallet** (not the card wallet — the mint call's `destinationCaller` is the
   zero address, so it's callable by anyone) relays `gatewayMint(attestation, signature)`
   on-chain. This is why withdrawals need no card-wallet gas top-up, unlike deposits.

## 7. Card rules engine

`lib/cardRules.ts`'s `evaluateChargeRules()` is pure (no I/O) and runs inside the same Firestore
transaction as the balance reservation, in this order:

1. `active === false` → `403` "Card is paused"
2. `rules.frozen` → `403` "Card is frozen"
3. `platformId` not in `rules.platforms` → `403` "Platform is not approved for this card"
4. `amount > rules.perCharge` → `402`
5. Velocity: more than `rules.velocity` charges within the trailing 1-second window
   (`spend.recentChargeTimestamps`) → `429`
6. `dailySpent + amount > rules.daily` → `402` (resets whenever `spend.dailyKey` rolls to a new
   UTC day)
7. `rules.autopause && monthlySpent + amount > rules.monthly` → `402` (resets on UTC month
   rollover). **Without `autopause`, monthly spend is tracked but never blocks a charge** — it's
   advisory only.
8. `rules.approve` is stored and returned by the API but **not enforced anywhere** — there's no
   approval-queue/notification path built yet.

If all gates pass, it also computes **spend-threshold alerts**: the first time a charge pushes
`dailySpent` or `monthlySpent` past 80% (`SPEND_ALERT_THRESHOLD_RATIO`) of its configured limit
within the current period, a `card.spend_threshold` webhook event is queued (see [§8](#8-webhooks)).
`spend.dailyThresholdNotified`/`monthlyThresholdNotified` gate this to once per period.

## 8. Webhooks

### Inbound: Circle → XanPay (`POST /webhooks/circle`)

Fires on Circle developer-controlled-wallet activity. Unauthenticated by bearer token (Circle
can't carry one) — protected instead by verifying Circle's ECDSA signature
(`X-Circle-Signature`/`X-Circle-Key-Id`) against Circle's own published public key. Treated as a
**trigger, not a source of truth**: on an inbound/settled transaction notification, it looks up
the card by `circleWalletId` and re-runs the same Gateway sweep `GET /cards/:id/balance` uses —
safe against a forged or duplicated delivery, since worst case it just re-checks and finds
nothing new. Register with `npm run create-webhook-subscription -- https://<host>/webhooks/circle`
once the backend is publicly reachable over HTTPS.

### Outbound: XanPay → platform

Configured via `PUT /platform/webhooks` (`{ url }`, must be `https://`) — issues a `webhookSecret`
(`whsec_...`). Delivery (`lib/webhooks.ts`) is **best-effort, fire-and-forget, no retry queue**:
a `POST` to `webhookUrl` with body `{ type, data, timestamp }` and header
`X-XanPay-Signature: sha256=<hmac-sha256(rawBody, webhookSecret)>`. A slow/unreachable endpoint
never affects the charge that triggered the event; failures are only logged server-side.

| Event `type` | Fired when | `data` |
|---|---|---|
| `charge.settled` | Every successful `POST /platform/charge` | `{ chargeId, txId, amount, reason, routeId, timestamp }` |
| `card.spend_threshold` | A charge crosses 80% of a card's daily or monthly limit (once per period) | `{ alertType: 'daily_spend_threshold' \| 'monthly_spend_threshold', limit, spent, timestamp }` |

Verify deliveries with `@xanpay/sdk`'s `constructEvent(rawBody, signatureHeader, webhookSecret)` —
constant-time comparison, throws `XanPayError` on mismatch.

## 9. Rate limiting

In-memory, per-IP, per-process (`express-rate-limit`) — resets on redeploy, doesn't share state
across horizontally-scaled instances. Fine for a single instance; swap for a shared store (e.g.
Redis) before scaling out.

| Limiter | Window | Default limit | Applies to |
|---|---|---|---|
| `chargeRateLimiter` | 60s | 60/min (`CHARGE_RATE_LIMIT_PER_MINUTE`) | `/platform/charge`, `/balance`, `/disconnect`, `/charges/by-key`, `/link/exchange` |
| `platformManagementRateLimiter` | 15min | 120/15min (`PLATFORM_MANAGEMENT_RATE_LIMIT_PER_15MIN`) | Firebase-ID-token-authed platform/dashboard routes |

## 10. Environment variables

See `.env.example` for the authoritative, commented list. Summary:

| Variable | Required | Purpose |
|---|---|---|
| `CIRCLE_API_KEY` | ✅ | Circle developer-controlled-wallets API key. |
| `CIRCLE_ENTITY_SECRET` | ✅ | Generated once via `npm run register-entity-secret`. |
| `CIRCLE_WALLET_SET_ID` | ✅ | Created once via `npm run create-wallet-set`. |
| `CIRCLE_BLOCKCHAIN` | defaults `MATIC-AMOY` | Any Circle-supported chain (`ETH`, `ETH-SEPOLIA`, `MATIC`, `MATIC-AMOY`, `AVAX`, `AVAX-FUJI`, `ARC`, `ARC-TESTNET`). |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ✅ | Full service-account JSON, single-line. |
| `BILLING_KEY_SECRET` | ✅ | 32-byte hex (`crypto.randomBytes(32).toString('hex')`). Rotating without a migration breaks every issued billingKey. |
| `PORT` | defaults `8080` | |
| `CORS_ORIGIN` | | Comma-separated allowed origins. |
| `CIRCLE_GAS_SPONSOR_WALLET_ID` | recommended | Created via `npm run create-gas-sponsor-wallet`, then fund it from a faucet. Without it, sweeps (and thus all charging) are skipped. |
| `GATEWAY_SWEEP_MIN_USDC` | defaults `0.01` | Below this, a wallet balance isn't worth sweeping. |
| `GATEWAY_GAS_TOPUP_THRESHOLD` / `GATEWAY_GAS_TOPUP_AMOUNT` | defaults `0.01` / `0.02` | Native-gas top-up tuning. |
| `GATEWAY_WITHDRAW_MAX_FEE` | defaults `0.05` | Max USDC fee a withdrawal authorizes Circle to charge. |
| `CHARGE_RATE_LIMIT_PER_MINUTE` / `PLATFORM_MANAGEMENT_RATE_LIMIT_PER_15MIN` | see defaults above | Rate-limit tuning. |

## 11. Setup & local development

One-time, in order (each is idempotent-refusing — they error rather than overwrite an existing
`.env` value):

```bash
npm run register-entity-secret     # writes CIRCLE_ENTITY_SECRET, saves a recovery file to ./recovery
npm run create-wallet-set          # writes CIRCLE_WALLET_SET_ID
npm run create-gas-sponsor-wallet  # writes CIRCLE_GAS_SPONSOR_WALLET_ID — fund the printed address from a faucet
npm run create-webhook-subscription -- https://<public-host>/webhooks/circle   # once publicly reachable
```

`npm run create-platform -- <name> <merchantWalletAddress>` is an alternative to the self-serve
`POST /platform/register` flow for provisioning a platform directly from the CLI (no Firebase
owner attached).

Day to day:

```bash
npm run dev     # tsx watch src/index.ts
npm run build   # tsc -p tsconfig.json --outDir dist
npm start       # node dist/index.js
```

## 12. The SDK (`@xanpay/sdk`)

Lives at `packages/sdk`, built with `tsup` into two independent entry points — never import the
server entry point into browser code, since it holds the platform's secret API key.

### `@xanpay/sdk` (server, Node 18+)

```ts
import { XanPay } from '@xanpay/sdk';

const xanpay = new XanPay({
  apiKey: process.env.XANPAY_API_KEY!,   // sk_xan_...
  platformId: process.env.XANPAY_PLATFORM_ID!,
  baseUrl: 'https://api.xanpay.com',      // optional, this is the default
});
```

| Method | Wraps | Notes |
|---|---|---|
| `charge({ billingKey, amount, reason, routeId? })` | `POST /platform/charge` | The foundation — every other method either calls this or hits the same request path. |
| `exchangeLinkToken(linkToken)` | `POST /platform/link/exchange` | Server-side callback handler for `XanPayBrowser.link()`'s `onSuccess`. |
| `getBalance(billingKey)` | `GET /platform/balance` | `{ available, currency }`. |
| `disconnect(billingKey)` | `POST /platform/disconnect` | Reverses linking. |
| `getChargeHistory({ billingKey, limit?, startAfter? })` | `GET /platform/charges/by-key` | Cursor-paginated. |
| `protect({ price, reason?, getBillingKey? })` | `charge()` | Returns Express middleware — see below. |

`protect()` usage — charges a fixed price per request before the handler runs:

```ts
app.post(
  '/v1/infer',
  lookupBillingKeyMiddleware,          // your own code: sets req.xanpay = { billingKey }
  xanpay.protect({ price: 0.0008, reason: 'AI inference call' }),
  handler,
);
```

By default `protect()` reads `req.xanpay?.billingKey` (typed via this package's ambient
`Express.Request` augmentation) — pass `getBillingKey: (req) => ...` to source it differently
(e.g. from your own session/user record). It rejects the request (never calls the real handler)
if the billingKey is missing or the charge itself fails, responding with the same status
`XanPayError` carries.

Errors are always `XanPayError` (`.code`, `.message`, `.statusCode`) — `.code` groups reasons the
same way [§5's error table](#post-platformcharge-error-reference) does; check `.message` for
specifics.

Webhook verification:

```ts
import { constructEvent } from '@xanpay/sdk';

app.post('/webhooks/xanpay', express.raw({ type: 'application/json' }), (req, res) => {
  const event = constructEvent(req.body, req.headers['x-xanpay-signature'] as string, process.env.XANPAY_WEBHOOK_SECRET!);
  if (event.type === 'charge.settled') { /* ... */ }
  res.sendStatus(200);
});
```

### `@xanpay/sdk/browser`

No secret — safe to bundle into client-side code.

```ts
import { XanPayBrowser } from '@xanpay/sdk/browser';

const xanpay = new XanPayBrowser({ platformId: 'plat_abc' });

xanpay.link({
  onSuccess: async (linkToken) => {
    await fetch('/api/save-xancard', { method: 'POST', body: JSON.stringify({ linkToken }) });
  },
  onCancel: () => {},
  onError: (err) => console.error(err),
});
```

Opens the XanPay connect-modal as an iframe overlay; `onSuccess` fires with an opaque `linkToken`
once the user approves a card — exchange it server-side via `exchangeLinkToken()` immediately
(it's single-use and expires in 10 minutes). Never send the linkToken anywhere but your own
backend.
