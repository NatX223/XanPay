import { Router } from 'express';
import { db } from '../../firebaseAdmin';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { platformManagementRateLimiter } from '../../middleware/rateLimit';
import type { DailyStatsDoc, PlatformDoc } from '../../types';

const router = Router();
router.use(platformManagementRateLimiter);
router.use(requireAuth);

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function getOwnedPlatformDoc(uid: string) {
  const snap = await db.collection('platforms').where('ownerUid', '==', uid).limit(1).get();
  return snap.empty ? null : snap.docs[0]!;
}

/**
 * Settlement totals + a daily time series, read from the dailyStats rollup (see charge.ts) instead of
 * scanning the charges collection group — at most `days` small doc reads regardless of charge volume.
 */
router.get('/', async (req, res) => {
  const { uid } = req as AuthedRequest;
  const platformDoc = await getOwnedPlatformDoc(uid);
  if (!platformDoc) {
    res.status(404).json({ error: 'No platform registered for this account' });
    return;
  }

  const range = typeof req.query.range === 'string' ? req.query.range : '30d';
  const days = RANGE_DAYS[range];
  if (!days) {
    res.status(400).json({ error: `range must be one of: ${Object.keys(RANGE_DAYS).join(', ')}` });
    return;
  }

  const platform = platformDoc.data() as PlatformDoc;
  const dailyCol = db.collection('platforms').doc(platformDoc.id).collection('dailyStats');

  const today = new Date();
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dayKeys.push(utcDayKey(d));
  }

  const [dailySnaps, activeRoutesSnap] = await Promise.all([
    Promise.all(dayKeys.map((k) => dailyCol.doc(k).get())),
    db.collection('platforms').doc(platformDoc.id).collection('routes').where('status', '==', 'live').count().get(),
  ]);

  const series = dailySnaps.map((snap, i) => {
    const data = snap.exists ? (snap.data() as DailyStatsDoc) : { settledUsdc: 0, chargeCount: 0 };
    return { date: dayKeys[i], settledUsdc: data.settledUsdc ?? 0, chargeCount: data.chargeCount ?? 0 };
  });

  res.json({
    totalSettledUsdc: platform.totalSettledUsdc ?? 0,
    totalChargeCount: platform.totalChargeCount ?? 0,
    rangeSettledUsdc: series.reduce((sum, d) => sum + d.settledUsdc, 0),
    rangeChargeCount: series.reduce((sum, d) => sum + d.chargeCount, 0),
    chargesToday: series[series.length - 1]?.chargeCount ?? 0,
    activeRoutes: activeRoutesSnap.data().count,
    series,
  });
});

export default router;
