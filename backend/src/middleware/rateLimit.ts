import rateLimit from 'express-rate-limit';

/**
 * Coarse, per-IP guard in front of the money-moving, API-key-authenticated charge endpoint — it's the
 * one attackers would hammer to either exhaust a legitimate platform's gateway balance or brute-force
 * guess a valid key (192 bits of entropy makes that infeasible on its own, but defense in depth costs
 * nothing here). This is in-memory and per-instance, so it resets on redeploy and doesn't share state
 * across horizontally-scaled instances — fine for a single-instance deployment; swap the store for a
 * shared one (e.g. Redis) before scaling out.
 */
export const chargeRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.CHARGE_RATE_LIMIT_PER_MINUTE ?? 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many charge requests — slow down.' },
});

/** Looser per-IP guard on Firebase-authed platform self-service endpoints (register, key management). */
export const platformManagementRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: Number(process.env.PLATFORM_MANAGEMENT_RATE_LIMIT_PER_15MIN ?? 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down.' },
});
