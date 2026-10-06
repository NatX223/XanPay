'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage, useAuthUser } from '@/lib/auth';
import {
  createApiKey,
  createRoute,
  deleteRoute,
  getMyPlatform,
  getPlatformStats,
  listApiKeys,
  listPlatformCharges,
  listRoutes,
  revokeApiKey as revokeApiKeyRequest,
  rollApiKey as rollApiKeyRequest,
  updateRoute,
} from '@/lib/api';
import type { ApiKeySummary, ChargeLogEntry, Platform, PlatformStats, RouteSummary } from '@/lib/types/api';
import DeveloperDocs from './DeveloperDocs';

/* ─────────────────────────────────────────────────────────────────
   Types & fixtures
───────────────────────────────────────────────────────────────── */
type Range = '7d' | '30d' | '90d';
type Section = 'overview' | 'routes' | 'keys' | 'settlements' | 'logs' | 'docs';

/** Every real API key carries this one scope today — see ALL_SCOPES in the backend's lib/apiKeys.ts. */
const DEFAULT_SCOPE = 'charges:write';
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const LOGS_POLL_MS = 8000;

const NAV_ITEMS: { id: Section; label: string; glyph: string }[] = [
  { id: 'overview', label: 'Overview', glyph: '◉' },
  { id: 'routes', label: 'Routes', glyph: '⧉' },
  { id: 'keys', label: 'API keys', glyph: '⚿' },
  { id: 'settlements', label: 'Settlements', glyph: '▲' },
  { id: 'logs', label: 'Logs', glyph: '≡' },
  { id: 'docs', label: 'Docs', glyph: '⌘' },
];

const SECTION_TITLES: Record<Section, string> = {
  overview: 'Overview',
  routes: 'Routes',
  keys: 'API keys',
  settlements: 'Settlements',
  logs: 'Request logs',
  docs: 'Documentation',
};

function fmtUsdc(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function maskKey(last4: string) {
  return 'sk_xan_' + '•'.repeat(18) + last4;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function buildPath(vals: number[]) {
  const max = Math.max(...vals) * 1.08;
  const pts = vals.map((v, i) => ({ x: (i / (vals.length - 1)) * 800, y: 230 - (v / max) * 210 }));
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    const cx = (p0.x + p1.x) / 2;
    line += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return { line, area: line + ' L 800 230 L 0 230 Z' };
}

function stop(e: React.MouseEvent) {
  e.stopPropagation();
}

/* ─────────────────────────────────────────────────────────────────
   New key modal
───────────────────────────────────────────────────────────────── */
function NewKeyModal({
  mode, generating, generateError, generated, newKeyValue, newCopied, onCopyNewKey,
  draftName, onNameChange, blocked, onGenerate, onClose,
}: {
  mode: 'create' | 'roll';
  generating: boolean;
  generateError: string | null;
  generated: boolean;
  newKeyValue: string;
  newCopied: boolean;
  onCopyNewKey: () => void;
  draftName: string;
  onNameChange: (v: string) => void;
  blocked: boolean;
  onGenerate: () => void;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(11,27,51,0.5)', backdropFilter: 'blur(3px)', animation: 'db-fade .25s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="dd-modal" onClick={stop} style={{ width: 480, maxWidth: '96vw', background: '#fff', borderRadius: 20, boxShadow: '0 40px 100px rgba(15,45,82,0.4)', animation: 'db-pop .3s cubic-bezier(.2,.8,.25,1)', overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>{mode === 'roll' ? 'Roll API key' : 'Create API key'}</h2>
            <button onClick={onClose} style={{ fontFamily: 'inherit', width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(11,27,51,0.12)', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#42546E', lineHeight: 1 }}>&times;</button>
          </div>
        </div>

        {generated ? (
          <div style={{ padding: '18px 28px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 14px', borderRadius: 11, background: 'rgba(224,128,27,0.1)', border: '1px solid rgba(224,128,27,0.28)', marginBottom: 16 }}>
              <span style={{ fontSize: 15 }}>⚠️</span>
              <span style={{ fontSize: 12.5, color: '#a86a1e', lineHeight: 1.45 }}>Copy this key now — it&apos;s shown once and can&apos;t be recovered later. Store it as an environment variable, never in client code.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#0c1830', borderRadius: 11, padding: '14px 15px' }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#e6edf3', flex: 1, wordBreak: 'break-all' }}>{newKeyValue}</span>
              <button onClick={onCopyNewKey} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: newCopied ? '#3ddc97' : '#9cc6f3', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 7, cursor: 'pointer', padding: '7px 11px', whiteSpace: 'nowrap' }}>
                {newCopied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <button onClick={onClose} style={{ fontFamily: 'inherit', width: '100%', marginTop: 20, fontSize: 15, fontWeight: 700, color: '#fff', background: '#2775CA', border: 'none', borderRadius: 12, cursor: 'pointer', padding: 14, boxShadow: '0 10px 26px rgba(39,117,202,0.3)', transition: 'transform .2s' }}>Done</button>
          </div>
        ) : mode === 'roll' ? (
          <div style={{ padding: '18px 28px 26px' }}>
            <p style={{ fontSize: 13.5, color: '#5B6B82', lineHeight: 1.5, margin: 0 }}>
              This revokes the current secret immediately and issues a new one with the same name and scopes. Anything still using the old key will start failing right away.
            </p>
            {generateError && (
              <p style={{ fontSize: 12.5, color: '#C53030', lineHeight: 1.5, margin: '14px 0 0' }}>{generateError}</p>
            )}
            <button onClick={onGenerate} disabled={generating} style={{ fontFamily: 'inherit', width: '100%', marginTop: 18, fontSize: 15, fontWeight: 700, color: '#fff', background: generating ? '#9db8d6' : '#C53030', border: 'none', borderRadius: 12, cursor: generating ? 'not-allowed' : 'pointer', padding: 14, transition: 'transform .2s' }}>
              {generating ? 'Rolling…' : 'Revoke & issue new key'}
            </button>
          </div>
        ) : (
          <div style={{ padding: '18px 28px 26px' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#42546E', marginBottom: 7 }}>Key name</label>
            <input
              className="dd-fld"
              value={draftName}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !blocked && onGenerate()}
              placeholder="e.g. Production server"
              disabled={generating}
              style={{ fontFamily: 'inherit', width: '100%', padding: '12px 14px', fontSize: 14.5, borderRadius: 11, border: '1.5px solid rgba(11,27,51,0.15)', background: '#fff', transition: 'border-color .2s, box-shadow .2s' }}
            />

            <div style={{ marginTop: 14, fontSize: 12.5, color: '#8194AC' }}>
              Scope: <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#1B5FA8', fontWeight: 600 }}>{DEFAULT_SCOPE}</span> — can submit charges against your cards&apos; approved-platform allowlist.
            </div>

            {generateError && (
              <p style={{ fontSize: 12.5, color: '#C53030', lineHeight: 1.5, margin: '14px 0 0' }}>{generateError}</p>
            )}

            <button onClick={onGenerate} disabled={blocked || generating} style={{ fontFamily: 'inherit', width: '100%', marginTop: 20, fontSize: 15, fontWeight: 700, color: '#fff', background: (blocked || generating) ? '#9db8d6' : '#2775CA', border: 'none', borderRadius: 12, cursor: (blocked || generating) ? 'not-allowed' : 'pointer', padding: 14, boxShadow: '0 10px 26px rgba(39,117,202,0.3)', transition: 'transform .2s' }}>
              {generating ? 'Generating…' : 'Generate key'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   New route modal
───────────────────────────────────────────────────────────────── */
function NewRouteModal({
  path, onPathChange, method, onMethodChange, price, onPriceChange,
  creating, createError, blocked, onCreate, onClose,
}: {
  path: string;
  onPathChange: (v: string) => void;
  method: string;
  onMethodChange: (v: string) => void;
  price: string;
  onPriceChange: (v: string) => void;
  creating: boolean;
  createError: string | null;
  blocked: boolean;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(11,27,51,0.5)', backdropFilter: 'blur(3px)', animation: 'db-fade .25s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="dd-modal" onClick={stop} style={{ width: 480, maxWidth: '96vw', background: '#fff', borderRadius: 20, boxShadow: '0 40px 100px rgba(15,45,82,0.4)', animation: 'db-pop .3s cubic-bezier(.2,.8,.25,1)', overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Add route</h2>
            <button onClick={onClose} style={{ fontFamily: 'inherit', width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(11,27,51,0.12)', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#42546E', lineHeight: 1 }}>&times;</button>
          </div>
        </div>
        <div style={{ padding: '18px 28px 26px' }}>
          <p style={{ fontSize: 13, color: '#5B6B82', lineHeight: 1.5, margin: '0 0 16px' }}>
            A named, priced endpoint. Pass its id as <code style={{ fontFamily: "'JetBrains Mono',monospace" }}>routeId</code> when calling <code style={{ fontFamily: "'JetBrains Mono',monospace" }}>POST /platform/charge</code> and the amount must exactly match this price.
          </p>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#42546E', marginBottom: 7 }}>Path</label>
          <input
            className="dd-fld"
            value={path}
            onChange={(e) => onPathChange(e.target.value)}
            placeholder="/v1/infer"
            disabled={creating}
            style={{ fontFamily: "'JetBrains Mono',monospace", width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 11, border: '1.5px solid rgba(11,27,51,0.15)', background: '#fff' }}
          />

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#42546E', margin: '16px 0 7px' }}>Method</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {HTTP_METHODS.map((m) => {
              const sel = method === m;
              return (
                <button key={m} onClick={() => onMethodChange(m)} disabled={creating} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 600, borderRadius: 9, cursor: 'pointer', padding: '8px 12px', background: sel ? '#EAF2FC' : '#fff', color: sel ? '#1B5FA8' : '#42546E', border: `1.5px solid ${sel ? '#2775CA' : 'rgba(11,27,51,0.13)'}` }}>
                  {m}
                </button>
              );
            })}
          </div>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#42546E', margin: '16px 0 7px' }}>Price per call (USDC)</label>
          <input
            className="dd-fld"
            value={price}
            onChange={(e) => onPriceChange(e.target.value.replace(/[^0-9.]/g, ''))}
            inputMode="decimal"
            placeholder="0.0012"
            disabled={creating}
            style={{ fontFamily: "'JetBrains Mono',monospace", width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 11, border: '1.5px solid rgba(11,27,51,0.15)', background: '#fff' }}
          />

          {createError && (
            <p style={{ fontSize: 12.5, color: '#C53030', lineHeight: 1.5, margin: '14px 0 0' }}>{createError}</p>
          )}

          <button onClick={onCreate} disabled={blocked || creating} style={{ fontFamily: 'inherit', width: '100%', marginTop: 20, fontSize: 15, fontWeight: 700, color: '#fff', background: (blocked || creating) ? '#9db8d6' : '#2775CA', border: 'none', borderRadius: 12, cursor: (blocked || creating) ? 'not-allowed' : 'pointer', padding: 14, boxShadow: '0 10px 26px rgba(39,117,202,0.3)' }}>
            {creating ? 'Adding…' : 'Add route'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Developer dashboard
───────────────────────────────────────────────────────────────── */
export default function DeveloperDashboard() {
  const [section, setSection] = useState<Section>('overview');
  const [range, setRange] = useState<Range>('30d');
  const [paused, setPaused] = useState(false);

  const { user, loading: authLoading } = useAuthUser();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [platformLoading, setPlatformLoading] = useState(true);

  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [routeActionId, setRouteActionId] = useState<string | null>(null);

  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [routeDraftPath, setRouteDraftPath] = useState('');
  const [routeDraftMethod, setRouteDraftMethod] = useState<string>('POST');
  const [routeDraftPrice, setRouteDraftPrice] = useState('');
  const [routeCreating, setRouteCreating] = useState(false);
  const [routeCreateError, setRouteCreateError] = useState<string | null>(null);

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [logs, setLogs] = useState<ChargeLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);

  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyModalMode, setKeyModalMode] = useState<'create' | 'roll'>('create');
  const [rollTargetId, setRollTargetId] = useState<string | null>(null);
  const [keyGenerated, setKeyGenerated] = useState(false);
  const [keyDraftName, setKeyDraftName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newCopied, setNewCopied] = useState(false);

  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const newCopyResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const animateChart = useCallback(() => {
    const line = lineRef.current, area = areaRef.current, dot = dotRef.current;
    if (!line) return;
    const len = line.getTotalLength();
    line.style.transition = 'none';
    line.style.strokeDasharray = String(len);
    line.style.strokeDashoffset = String(len);
    line.getBoundingClientRect();
    line.style.transition = 'stroke-dashoffset 1.3s cubic-bezier(.4,.1,.2,1)';
    line.style.strokeDashoffset = '0';
    if (area) {
      area.style.opacity = '0';
      area.style.transition = 'opacity .7s ease .6s';
      requestAnimationFrame(() => { area.style.opacity = '1'; });
    }
    if (dot) {
      const p = line.getPointAtLength(len);
      dot.setAttribute('cx', String(p.x));
      dot.setAttribute('cy', String(p.y));
      dot.style.opacity = '0';
      dot.style.transition = 'opacity .4s ease 1.2s';
      requestAnimationFrame(() => { dot.style.opacity = '1'; });
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(animateChart, 40);
    return () => clearTimeout(t);
  }, [range, stats, animateChart]);

  /* ── load the signed-in developer's platform + API keys ──────────── */
  // platformLoading/keysLoading both default to true; the render gate below treats
  // `!user` as "not loading" regardless of their value, so the no-user case needs no
  // explicit reset here — keeping this effect free of synchronous setState calls.
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    getMyPlatform()
      .then((p) => { if (!cancelled) setPlatform(p); })
      .finally(() => { if (!cancelled) setPlatformLoading(false); });
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const refreshKeys = useCallback(() => {
    return listApiKeys()
      .then(({ keys: fetched }) => { setKeys(fetched); setKeysError(null); })
      .catch((err) => setKeysError(getErrorMessage(err)))
      .finally(() => setKeysLoading(false));
  }, []);

  useEffect(() => {
    if (!platform) return;
    refreshKeys();
  }, [platform, refreshKeys]);

  const refreshRoutes = useCallback(() => {
    return listRoutes()
      .then(({ routes: fetched }) => { setRoutes(fetched); setRoutesError(null); })
      .catch((err) => setRoutesError(getErrorMessage(err)))
      .finally(() => setRoutesLoading(false));
  }, []);

  useEffect(() => {
    if (!platform) return;
    refreshRoutes();
  }, [platform, refreshRoutes]);

  // Stale-while-revalidate: switching `range` refetches in place without resetting to a loading
  // state, so the chart doesn't flash empty on every click — `stats === null` only gates the very
  // first load.
  useEffect(() => {
    if (!platform) return;
    let cancelled = false;
    getPlatformStats(range)
      .then((s) => { if (!cancelled) { setStats(s); setStatsError(null); } })
      .catch((err) => { if (!cancelled) setStatsError(getErrorMessage(err)); })
      .finally(() => {});
    return () => { cancelled = true; };
  }, [platform, range]);

  const refreshLogs = useCallback(() => {
    return listPlatformCharges(50)
      .then(({ charges }) => { setLogs(charges); setLogsError(null); })
      .catch((err) => setLogsError(getErrorMessage(err)))
      .finally(() => setLogsLoading(false));
  }, []);

  useEffect(() => {
    if (!platform) return;
    refreshLogs();
  }, [platform, refreshLogs]);

  // Lightweight polling instead of a websocket/SSE stream — good enough for a dashboard, not a claim of true push delivery.
  useEffect(() => {
    if (!platform || paused) return;
    const interval = setInterval(refreshLogs, LOGS_POLL_MS);
    return () => clearInterval(interval);
  }, [platform, paused, refreshLogs]);

  const orgName = platform?.name ?? 'Your project';
  const orgInitials = orgName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '·';

  const activeKeys = keys.filter((k) => !k.revoked);
  const routeById = Object.fromEntries(routes.map((r) => [r.id, r]));
  const keyById = Object.fromEntries(keys.map((k) => [k.id, k]));

  const chartVals = stats && stats.series.length > 1 ? stats.series.map((d) => d.settledUsdc) : [0, 0];
  const paths = buildPath(chartVals);
  const chartLabels = (stats?.series ?? []).map((d, i, arr) => {
    const step = Math.max(1, Math.ceil(arr.length / 8));
    if (i % step !== 0 && i !== arr.length - 1) return '';
    return new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  });

  const statTiles = [
    { label: `Settled (${range})`, value: '$' + fmtUsdc(stats?.rangeSettledUsdc ?? 0), sub: 'USDC' },
    { label: `Charges (${range})`, value: (stats?.rangeChargeCount ?? 0).toLocaleString('en-US'), sub: 'requests' },
    { label: 'Charges today', value: (stats?.chargesToday ?? 0).toLocaleString('en-US'), sub: 'today' },
    { label: 'Active routes', value: String(stats?.activeRoutes ?? 0), sub: 'live' },
  ];

  const openAddRoute = () => {
    setRouteDraftPath('');
    setRouteDraftMethod('POST');
    setRouteDraftPrice('');
    setRouteCreateError(null);
    setRouteModalOpen(true);
  };
  const closeAddRoute = () => { if (!routeCreating) setRouteModalOpen(false); };
  const routeCreateBlocked = !routeDraftPath.trim().startsWith('/') || !(Number(routeDraftPrice) > 0);

  const handleCreateRoute = async () => {
    if (routeCreateBlocked || routeCreating) return;
    setRouteCreating(true);
    setRouteCreateError(null);
    try {
      const route = await createRoute({ path: routeDraftPath.trim(), method: routeDraftMethod, price: Number(routeDraftPrice) });
      setRoutes((rs) => [route, ...rs]);
      setRouteModalOpen(false);
    } catch (err) {
      setRouteCreateError(getErrorMessage(err));
    } finally {
      setRouteCreating(false);
    }
  };

  const handleToggleRouteStatus = async (route: RouteSummary) => {
    if (routeActionId) return;
    setRouteActionId(route.id);
    try {
      const updated = await updateRoute(route.id, { status: route.status === 'live' ? 'paused' : 'live' });
      setRoutes((rs) => rs.map((r) => (r.id === route.id ? updated : r)));
    } catch (err) {
      window.alert(getErrorMessage(err));
    } finally {
      setRouteActionId(null);
    }
  };

  const handleDeleteRoute = async (route: RouteSummary) => {
    if (routeActionId) return;
    if (!window.confirm(`Delete route ${route.method} ${route.path}? Existing charge history against it is unaffected.`)) return;
    setRouteActionId(route.id);
    try {
      await deleteRoute(route.id);
      setRoutes((rs) => rs.filter((r) => r.id !== route.id));
    } catch (err) {
      window.alert(getErrorMessage(err));
    } finally {
      setRouteActionId(null);
    }
  };

  const openCreateKey = () => {
    setKeyModalMode('create');
    setRollTargetId(null);
    setKeyModalOpen(true);
    setKeyGenerated(false);
    setKeyDraftName('');
    setGenerateError(null);
    setNewCopied(false);
  };
  const openRollKey = (id: string) => {
    setKeyModalMode('roll');
    setRollTargetId(id);
    setKeyModalOpen(true);
    setKeyGenerated(false);
    setGenerateError(null);
    setNewCopied(false);
  };
  const closeKey = () => { if (!generating) setKeyModalOpen(false); };

  const kdBlocked = keyDraftName.trim().length < 2;

  const generateKey = async () => {
    if (generating) return;
    if (keyModalMode === 'create' && kdBlocked) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const result = keyModalMode === 'roll' && rollTargetId
        ? await rollApiKeyRequest(rollTargetId)
        : await createApiKey({ name: keyDraftName.trim() });

      const summary: ApiKeySummary = {
        id: result.id, name: result.name, last4: result.last4, scopes: result.scopes,
        createdAt: new Date().toISOString(), lastUsedAt: null, revoked: false,
      };
      setKeys((ks) => (keyModalMode === 'roll' && rollTargetId
        ? [summary, ...ks.filter((k) => k.id !== rollTargetId)]
        : [summary, ...ks]));
      setNewKeyValue(result.apiKey);
      setKeyGenerated(true);
    } catch (err) {
      setGenerateError(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const copyNewKey = () => {
    try { navigator.clipboard?.writeText(newKeyValue); } catch { /* clipboard unavailable */ }
    setNewCopied(true);
    clearTimeout(newCopyResetRef.current);
    newCopyResetRef.current = setTimeout(() => setNewCopied(false), 1800);
  };

  const handleRevoke = async (key: ApiKeySummary) => {
    if (revokingId) return;
    if (!window.confirm(`Revoke "${key.name}"? Anything still using this key will stop working immediately.`)) return;
    setRevokingId(key.id);
    try {
      await revokeApiKeyRequest(key.id);
      setKeys((ks) => ks.map((k) => (k.id === key.id ? { ...k, revoked: true } : k)));
    } catch (err) {
      window.alert(getErrorMessage(err));
    } finally {
      setRevokingId(null);
    }
  };

  /* ── auth / onboarding gate ───────────────────────────────────────── */
  if (authLoading || (user && platformLoading)) {
    return (
      <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5B6B82' }}>
        Loading…
      </div>
    );
  }
  if (!user) {
    return (
      <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#0B1B33', textAlign: 'center', padding: 24 }}>
        <p style={{ fontSize: 16, color: '#5B6B82', maxWidth: 360 }}>Sign in to view your developer dashboard.</p>
        <a href="/developers/onboarding" style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: '#fff', background: '#2775CA', border: 'none', borderRadius: 12, padding: '13px 24px', boxShadow: '0 10px 26px rgba(39,117,202,0.3)', textDecoration: 'none' }}>
          Sign in →
        </a>
      </div>
    );
  }
  if (!platform) {
    return (
      <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#0B1B33', textAlign: 'center', padding: 24 }}>
        <p style={{ fontSize: 16, color: '#5B6B82', maxWidth: 360 }}>You haven&apos;t finished developer onboarding yet — there&apos;s no platform registered to this account.</p>
        <a href="/developers/onboarding" style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: '#fff', background: '#2775CA', border: 'none', borderRadius: 12, padding: '13px 24px', boxShadow: '0 10px 26px rgba(39,117,202,0.3)', textDecoration: 'none' }}>
          Finish onboarding →
        </a>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", color: '#0B1B33', background: '#F4F7FB', WebkitFontSmoothing: 'antialiased' }}>
      <div className="dd-shell">

        {/* ═══ SIDEBAR ═══ */}
        <aside className="dd-side" style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '1px solid rgba(11,27,51,0.08)', padding: '22px 16px', position: 'sticky', top: 0, height: '100vh' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 8px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#2775CA,#1B5FA8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(39,117,202,0.35)' }}>
              <div style={{ width: 11, height: 11, borderRadius: 3, background: '#fff', opacity: 0.92 }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>XanPay</span>
            <span className="dd-navlabel" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#6cb0f5', background: 'rgba(39,117,202,0.14)', border: '1px solid rgba(39,117,202,0.28)', borderRadius: 999, padding: '2px 7px' }}>DEV</span>
          </div>

          <nav className="dd-side-nav" style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 24 }}>
            {NAV_ITEMS.map((n) => (
              <div key={n.id} onClick={() => setSection(n.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 11, cursor: 'pointer', fontSize: 14.5, fontWeight: 600, background: section === n.id ? '#EAF2FC' : 'transparent', color: section === n.id ? '#1B5FA8' : '#56657D', transition: 'background .18s' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, width: 16, textAlign: 'center', opacity: 0.9 }}>{n.glyph}</span>
                <span className="dd-navlabel">{n.label}</span>
              </div>
            ))}
          </nav>

          <div className="dd-side-foot" style={{ marginTop: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#2775CA,#1B5FA8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>{orgInitials}</div>
              <div style={{ lineHeight: 1.25, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{orgName}</div>
                <div style={{ fontSize: 11.5, color: '#8194AC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email ?? ''}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ═══ MAIN ═══ */}
        <main className="dd-scroll" style={{ overflowY: 'auto', maxHeight: '100vh' }}>
          <div className="dd-pad">

            {/* topbar */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 26 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2775CA', fontWeight: 600 }}>{orgName}</div>
                <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', margin: '7px 0 0' }}>{SECTION_TITLES[section]}</h1>
                <div style={{ marginTop: 14, display: 'inline-block', minWidth: 200, background: 'linear-gradient(140deg,#0B1B33,#11305a)', borderRadius: 14, padding: 16, color: '#fff', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(39,117,202,0.4),transparent 70%)' }} />
                  <div style={{ position: 'relative' }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.12em', color: '#9fb3cc' }}>SETTLED &middot; ALL TIME</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, marginTop: 3 }}>${fmtUsdc(stats?.totalSettledUsdc ?? 0)}</div>
                    <div style={{ fontSize: 11.5, color: '#9fb3cc', marginTop: 2 }}>on Arc via Circle</div>
                  </div>
                </div>
              </div>
              {section !== 'docs' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <button className="db-primary-btn" onClick={openCreateKey} style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#fff', background: '#2775CA', border: 'none', borderRadius: 11, cursor: 'pointer', padding: '11px 18px', boxShadow: '0 8px 22px rgba(39,117,202,0.3)', transition: 'transform .2s' }}>+ New key</button>
                </div>
              )}
            </div>

            {section === 'docs' ? (
              <DeveloperDocs platformId={platform.id} />
            ) : (
              <>
                {/* stat tiles */}
                <div className="dd-stats" style={{ marginBottom: 26 }}>
                  {statTiles.map((s) => (
                    <div key={s.label} style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 16, padding: '18px 20px', boxShadow: '0 8px 22px rgba(15,45,82,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8194AC' }}>{s.label}</span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: '#1B5FA8', background: '#EAF2FC', borderRadius: 6, padding: '3px 7px' }}>{s.sub}</span>
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 25, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 9 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* settlements chart */}
                <div style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 18, padding: '24px 26px', boxShadow: '0 8px 22px rgba(15,45,82,0.04)', marginBottom: 26 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#8194AC' }}>Settlements &middot; USDC on Arc</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 11, marginTop: 5 }}>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em' }}>${fmtUsdc(stats?.rangeSettledUsdc ?? 0)}</span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#5B6B82', background: '#F1F5FA', borderRadius: 7, padding: '3px 8px' }}>{stats?.rangeChargeCount ?? 0} charges</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, padding: 4, background: '#F1F5FA', borderRadius: 10 }}>
                      {(['7d', '30d', '90d'] as Range[]).map((r) => {
                        const sel = range === r;
                        return (
                          <button key={r} onClick={() => setRange(r)} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 7, cursor: 'pointer', padding: '7px 13px', transition: 'all .18s', background: sel ? '#fff' : 'transparent', color: sel ? '#0B1B33' : '#5B6B82', boxShadow: sel ? '0 2px 8px rgba(15,45,82,0.12)' : 'none' }}>{r}</button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ position: 'relative', height: 230, marginTop: 20 }}>
                    <svg viewBox="0 0 800 230" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2775CA" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#2775CA" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <g stroke="rgba(11,27,51,0.06)" strokeWidth={1}>
                        <line x1={0} y1={57} x2={800} y2={57} /><line x1={0} y1={115} x2={800} y2={115} /><line x1={0} y1={173} x2={800} y2={173} />
                      </g>
                      <path ref={areaRef} d={paths.area} fill="url(#ddFill)" opacity={0} />
                      <path ref={lineRef} d={paths.line} fill="none" stroke="#2775CA" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                      <circle ref={dotRef} r={5} fill="#fff" stroke="#2775CA" strokeWidth={3} opacity={0} />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: '#8194AC', marginTop: 10 }}>
                    {chartLabels.map((cl, i) => <span key={i}>{cl}</span>)}
                  </div>
                  {statsError && (
                    <p style={{ fontSize: 12.5, color: '#C53030', marginTop: 10 }}>{statsError}</p>
                  )}
                </div>

                <div className="dd-cols">
                  {/* protected routes */}
                  <div style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 22px rgba(15,45,82,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid rgba(11,27,51,0.07)' }}>
                      <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Protected routes</h2>
                      <span onClick={openAddRoute} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#2775CA', fontWeight: 600, cursor: 'pointer' }}>+ Add route</span>
                    </div>

                    {routesLoading && (
                      <div style={{ padding: '22px', fontSize: 13, color: '#8194AC' }}>Loading routes…</div>
                    )}
                    {routesError && !routesLoading && (
                      <div style={{ padding: '18px 22px', fontSize: 12.5, color: '#C53030' }}>{routesError}</div>
                    )}
                    {!routesLoading && !routesError && routes.length === 0 && (
                      <div style={{ padding: '22px', fontSize: 13, color: '#8194AC' }}>
                        No routes yet — add one, then pass its id as <code style={{ fontFamily: "'JetBrains Mono',monospace" }}>routeId</code> when calling <code style={{ fontFamily: "'JetBrains Mono',monospace" }}>POST /platform/charge</code>.
                      </div>
                    )}

                    {!routesLoading && routes.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.7fr 0.9fr auto auto', gap: 10, padding: '11px 22px', fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8194AC', borderBottom: '1px solid rgba(11,27,51,0.06)' }}>
                        <span>Route</span><span className="dd-routehide">Price</span><span>Calls</span><span>Revenue</span><span /><span />
                      </div>
                    )}
                    {!routesLoading && routes.map((r) => {
                      const isLive = r.status === 'live';
                      const isActing = routeActionId === r.id;
                      return (
                        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.7fr 0.9fr auto auto', gap: 10, alignItems: 'center', padding: '14px 22px', borderBottom: '1px solid rgba(11,27,51,0.05)' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600, color: '#0B1B33', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.path}</div>
                            <div style={{ fontSize: 11.5, color: '#8194AC', marginTop: 2 }}>{r.method}</div>
                          </div>
                          <span className="dd-routehide" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#1B5FA8' }}>${fmtUsdc(r.price)}</span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#42546E' }}>{r.calls.toLocaleString('en-US')}</span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#0B1B33' }}>${fmtUsdc(r.revenue)}</span>
                          <span
                            onClick={() => !isActing && handleToggleRouteStatus(r)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 700, color: isLive ? '#1B7A4B' : '#8194AC', background: isLive ? 'rgba(61,220,151,0.16)' : 'rgba(129,148,172,0.16)', borderRadius: 999, padding: '4px 9px', whiteSpace: 'nowrap', cursor: isActing ? 'not-allowed' : 'pointer' }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isLive ? '#1B7A4B' : '#8194AC' }} />{isLive ? 'Live' : 'Paused'}
                          </span>
                          <button onClick={() => handleDeleteRoute(r)} disabled={isActing} style={{ fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: '#C53030', background: 'transparent', border: 'none', cursor: isActing ? 'not-allowed' : 'pointer', padding: 0 }}>×</button>
                        </div>
                      );
                    })}
                  </div>

                  {/* api keys */}
                  <div style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 22px rgba(15,45,82,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid rgba(11,27,51,0.07)' }}>
                      <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>API keys</h2>
                      {!keysLoading && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8194AC' }}>{activeKeys.length} active</span>}
                    </div>

                    {keysLoading && (
                      <div style={{ padding: '22px', fontSize: 13, color: '#8194AC' }}>Loading keys…</div>
                    )}
                    {keysError && !keysLoading && (
                      <div style={{ padding: '18px 22px', fontSize: 12.5, color: '#C53030' }}>{keysError}</div>
                    )}
                    {!keysLoading && !keysError && keys.length === 0 && (
                      <div style={{ padding: '22px', fontSize: 13, color: '#8194AC' }}>No API keys yet.</div>
                    )}

                    {!keysLoading && keys.map((k) => {
                      const isRevoking = revokingId === k.id;
                      return (
                        <div key={k.id} style={{ padding: '15px 22px', borderBottom: '1px solid rgba(11,27,51,0.05)', opacity: k.revoked ? 0.55 : 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                              <span style={{ fontSize: 14 }}>🔑</span>
                              <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{k.name}</span>
                              {k.revoked && (
                                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, color: '#8194AC', background: 'rgba(129,148,172,0.16)', borderRadius: 6, padding: '2px 7px' }}>REVOKED</span>
                              )}
                            </div>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8194AC', whiteSpace: 'nowrap' }}>{new Date(k.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, background: '#F1F5FA', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 9, padding: '9px 11px' }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#42546E', flex: 1, wordBreak: 'break-all' }}>{maskKey(k.last4)}</span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#8194AC' }}>never shown again</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8194AC' }}>Last used {formatRelativeTime(k.lastUsedAt)}</span>
                            {!k.revoked && (
                              <div style={{ display: 'flex', gap: 12 }}>
                                <button onClick={() => openRollKey(k.id)} disabled={isRevoking} style={{ fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: '#1B5FA8', background: 'transparent', border: 'none', cursor: isRevoking ? 'not-allowed' : 'pointer', padding: 0 }}>↻ Roll key</button>
                                <button onClick={() => handleRevoke(k)} disabled={isRevoking} style={{ fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: '#C53030', background: 'transparent', border: 'none', cursor: isRevoking ? 'not-allowed' : 'pointer', padding: 0 }}>{isRevoking ? 'Revoking…' : 'Revoke'}</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div onClick={openCreateKey} style={{ padding: '14px 22px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#2775CA', cursor: 'pointer' }}>+ Create new key</div>
                  </div>
                </div>

                {/* request log */}
                <div style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 22px rgba(15,45,82,0.04)', marginTop: 26 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 22px', borderBottom: '1px solid rgba(11,27,51,0.07)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: paused ? '#8194AC' : '#3ddc97', boxShadow: paused ? 'none' : '0 0 9px #3ddc97', animation: paused ? 'none' : 'dd-blink 1.3s infinite' }} />
                    <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Request log</h2>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: '#8194AC' }}>{paused ? 'paused' : `auto-refreshing · every ${LOGS_POLL_MS / 1000}s`}</span>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => setPaused((p) => !p)} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 700, color: '#42546E', background: '#F1F5FA', border: '1px solid rgba(11,27,51,0.1)', borderRadius: 8, cursor: 'pointer', padding: '6px 12px' }}>{paused ? '▶ Resume' : '‖ Pause'}</button>
                  </div>
                  {logsLoading && (
                    <div style={{ padding: '22px', fontSize: 13, color: '#8194AC' }}>Loading request log…</div>
                  )}
                  {logsError && !logsLoading && (
                    <div style={{ padding: '18px 22px', fontSize: 12.5, color: '#C53030' }}>{logsError}</div>
                  )}
                  {!logsLoading && !logsError && logs.length === 0 && (
                    <div style={{ padding: '22px', fontSize: 13, color: '#8194AC' }}>No charges yet.</div>
                  )}
                  <div className="dd-scroll" style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {!logsLoading && logs.map((l) => {
                      const route = l.routeId ? routeById[l.routeId] : undefined;
                      const key = keyById[l.keyId];
                      return (
                        <div key={l.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: 14, alignItems: 'center', padding: '11px 22px', borderBottom: '1px solid rgba(11,27,51,0.04)' }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 700, color: '#1B5FA8', background: '#EAF2FC', borderRadius: 6, padding: '3px 7px' }}>{l.status}</span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#0B1B33', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{route ? `${route.method} ${route.path}` : l.reason}</span>
                          <span className="dd-routehide" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#8194AC' }}>{key?.name ?? l.keyId.slice(0, 8)}</span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 700, color: '#1B7A4B' }}>+${fmtUsdc(l.amount)}</span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8194AC', whiteSpace: 'nowrap' }}>{formatRelativeTime(l.timestamp)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* ═══ NEW KEY MODAL ═══ */}
      {keyModalOpen && (
        <NewKeyModal
          mode={keyModalMode}
          generating={generating}
          generateError={generateError}
          generated={keyGenerated}
          newKeyValue={newKeyValue}
          newCopied={newCopied}
          onCopyNewKey={copyNewKey}
          draftName={keyDraftName}
          onNameChange={setKeyDraftName}
          blocked={kdBlocked}
          onGenerate={generateKey}
          onClose={closeKey}
        />
      )}

      {/* ═══ NEW ROUTE MODAL ═══ */}
      {routeModalOpen && (
        <NewRouteModal
          path={routeDraftPath}
          onPathChange={setRouteDraftPath}
          method={routeDraftMethod}
          onMethodChange={setRouteDraftMethod}
          price={routeDraftPrice}
          onPriceChange={setRouteDraftPrice}
          creating={routeCreating}
          createError={routeCreateError}
          blocked={routeCreateBlocked}
          onCreate={handleCreateRoute}
          onClose={closeAddRoute}
        />
      )}
    </div>
  );
}
