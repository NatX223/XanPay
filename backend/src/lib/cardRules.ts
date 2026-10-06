import type { CardDoc } from '../types';

/** "Max charges per second" per CardRules.velocity — the window recent charge timestamps are pruned against. */
const VELOCITY_WINDOW_MS = 1000;

/** Fraction of a daily/monthly limit that triggers a one-time card.spend_threshold webhook for that period. */
const SPEND_ALERT_THRESHOLD_RATIO = 0.8;

export interface ChargeRuleDenial {
  allowed: false;
  status: number;
  reason: string;
}

export interface ChargeAlert {
  type: 'daily_spend_threshold' | 'monthly_spend_threshold';
  limit: number;
  spent: number;
}

export interface ChargeRuleApproval {
  allowed: true;
  /** Firestore field updates to merge into the same transaction that decrements gatewayBalance — apply only if the charge goes on to succeed (balance check, then settlement). */
  cardUpdates: Record<string, unknown>;
  /** Newly-crossed daily/monthly spend thresholds this charge caused — the caller dispatches a webhook event per entry after settlement succeeds. */
  alerts: ChargeAlert[];
}

export type ChargeRuleDecision = ChargeRuleDenial | ChargeRuleApproval;

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcMonthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function parsePositiveFloat(value: string | number | undefined): number | null {
  const n = typeof value === 'number' ? value : parseFloat(value ?? '');
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePositiveInt(value: string | undefined): number | null {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Evaluates every CardRules gate against a proposed charge. Pure/no I/O by design: the caller (the
 * reservation transaction in routes/platform/charge.ts) reads the card doc, calls this, and — only if
 * `allowed` — merges `cardUpdates` into the same tx.update() that decrements gatewayBalance. That's what
 * makes the daily/monthly/velocity counters race-safe: two concurrent charges against the same card both
 * touch the same document, so Firestore's optimistic-concurrency check serializes them exactly like it
 * already does for the balance decrement.
 *
 * autopause semantics (per product decision): the monthly cap is a hard block only when rules.autopause
 * is on. With it off, monthly spend is still tracked but never blocks a charge — it's advisory only.
 * rules.approve is intentionally not enforced here — there's no approval-queue/notification path yet:
 * it's stored and returned by the API but has no effect on charging.
 */
export function evaluateChargeRules(card: CardDoc, platformId: string, amount: number, now: Date): ChargeRuleDecision {
  const deny = (status: number, reason: string): ChargeRuleDenial => ({ allowed: false, status, reason });

  if (card.active === false) return deny(403, 'Card is paused');
  if (card.rules.frozen) return deny(403, 'Card is frozen');
  if (!card.rules.platforms.includes(platformId)) return deny(403, 'Platform is not approved for this card');

  const perCharge = parsePositiveFloat(card.rules.perCharge);
  if (perCharge !== null && amount > perCharge) {
    return deny(402, `Charge of ${amount} exceeds the card's per-charge limit of ${perCharge}`);
  }

  const velocityLimit = parsePositiveInt(card.rules.velocity);
  const recentTimestamps = (card.spend?.recentChargeTimestamps ?? []).filter((t) => now.getTime() - t < VELOCITY_WINDOW_MS);
  if (velocityLimit !== null && recentTimestamps.length >= velocityLimit) {
    return deny(429, `Card has exceeded its velocity limit of ${velocityLimit} charges/sec`);
  }

  const dayKey = utcDayKey(now);
  const dailySpent = card.spend?.dailyKey === dayKey ? card.spend.dailySpent : 0;
  const dailyLimit = parsePositiveFloat(card.rules.daily);
  if (dailyLimit !== null && dailySpent + amount > dailyLimit) {
    return deny(402, `Charge would exceed the card's daily limit of ${dailyLimit}`);
  }

  const monthKey = utcMonthKey(now);
  const monthlySpent = card.spend?.monthlyKey === monthKey ? card.spend.monthlySpent : 0;
  const monthlyLimit = parsePositiveFloat(card.rules.monthly);
  if (card.rules.autopause && monthlyLimit !== null && monthlySpent + amount > monthlyLimit) {
    return deny(402, `Charge would exceed the card's monthly cap of ${monthlyLimit}`);
  }

  const newDailySpent = dailySpent + amount;
  const newMonthlySpent = monthlySpent + amount;
  const alerts: ChargeAlert[] = [];

  // dailyThresholdNotified/monthlyThresholdNotified reset alongside their spent counters — same
  // dayKey/monthKey rollover — so each period fires the alert at most once.
  const dailyAlreadyNotified = card.spend?.dailyKey === dayKey ? (card.spend.dailyThresholdNotified ?? false) : false;
  let dailyThresholdNotified = dailyAlreadyNotified;
  if (dailyLimit !== null && !dailyAlreadyNotified && newDailySpent >= dailyLimit * SPEND_ALERT_THRESHOLD_RATIO) {
    dailyThresholdNotified = true;
    alerts.push({ type: 'daily_spend_threshold', limit: dailyLimit, spent: newDailySpent });
  }

  const monthlyAlreadyNotified =
    card.spend?.monthlyKey === monthKey ? (card.spend.monthlyThresholdNotified ?? false) : false;
  let monthlyThresholdNotified = monthlyAlreadyNotified;
  if (monthlyLimit !== null && !monthlyAlreadyNotified && newMonthlySpent >= monthlyLimit * SPEND_ALERT_THRESHOLD_RATIO) {
    monthlyThresholdNotified = true;
    alerts.push({ type: 'monthly_spend_threshold', limit: monthlyLimit, spent: newMonthlySpent });
  }

  return {
    allowed: true,
    cardUpdates: {
      'spend.dailySpent': newDailySpent,
      'spend.dailyKey': dayKey,
      'spend.dailyThresholdNotified': dailyThresholdNotified,
      'spend.monthlySpent': newMonthlySpent,
      'spend.monthlyKey': monthKey,
      'spend.monthlyThresholdNotified': monthlyThresholdNotified,
      'spend.recentChargeTimestamps': [...recentTimestamps, now.getTime()],
    },
    alerts,
  };
}
