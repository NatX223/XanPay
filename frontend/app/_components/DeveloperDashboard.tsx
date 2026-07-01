'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ─────────────────────────────────────────────────────────────────
   Types & fixtures
───────────────────────────────────────────────────────────────── */
type Range = '7d' | '30d' | '90d';
type Env = 'live' | 'test';
type Section = 'overview' | 'routes' | 'keys' | 'settlements' | 'logs' | 'docs';

interface ApiKeyT {
  id: string;
  name: string;
  env: Env;
  created: string;
  lastUsed: string;
  full: string;
}

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

const RANGE_DATA: Record<Range, { vals: number[]; total: string; delta: string; labels: string[] }> = {
  '7d': { vals: [30, 38, 34, 46, 52, 60, 72], total: '12,840', delta: '14%', labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
  '30d': { vals: [18, 26, 22, 34, 30, 44, 42, 58, 66, 80], total: '48,920', delta: '38%', labels: ['W1', '', 'W2', '', 'W3', '', 'W4', '', 'W5', 'W6'] },
  '90d': { vals: [10, 16, 14, 24, 30, 28, 40, 52, 60, 68, 82, 96], total: '142,300', delta: '62%', labels: ['Apr', '', 'May', '', '', 'Jun', '', '', 'Jul', '', '', ''] },
};

const ROUTES = [
  { path: '/v1/infer', method: 'POST', price: '$0.0012', calls: '184,204', revenue: '221.04', status: 'Live' },
  { path: '/v1/embed', method: 'POST', price: '$0.0004', calls: '96,730', revenue: '38.69', status: 'Live' },
  { path: '/v1/stream', method: 'GET', price: '$0.0003/s', calls: '42,118', revenue: '12.63', status: 'Live' },
  { path: '/v1/vision', method: 'POST', price: '$0.0021', calls: '0', revenue: '0.00', status: 'Paused' },
] as const;

const INITIAL_KEYS: ApiKeyT[] = [
  { id: 'k1', name: 'Production server', env: 'live', created: 'Mar 2026', lastUsed: '2s ago', full: 'sk_live_xp_9f2Ka7Dq4mZ1v8Rb3Xc6Ht0' },
  { id: 'k2', name: 'Staging', env: 'live', created: 'Feb 2026', lastUsed: '4h ago', full: 'sk_live_xp_2Lp8Wq3Nx7Yc1Rb9Vd5Kt6' },
  { id: 'k3', name: 'Local dev', env: 'test', created: 'Jan 2026', lastUsed: '3d ago', full: 'sk_test_xp_7Hn4Zz1Qr8Mb2Wc6Yx0Lp3' },
];

const ALL_SCOPES = ['charges:write', 'settlements:read', 'routes:manage'];

const BASE_LOGS = [
  { code: '200', route: 'POST /v1/infer', platform: 'ai-inference.dev', amount: '0.0012', latency: '1.8ms' },
  { code: '200', route: 'POST /v1/embed', platform: 'vector-search.dev', amount: '0.0004', latency: '1.2ms' },
  { code: '200', route: 'GET /v1/stream', platform: 'video-stream.io', amount: '0.0003', latency: '0.9ms' },
  { code: '200', route: 'POST /v1/infer', platform: 'chat-app.co', amount: '0.0012', latency: '2.1ms' },
  { code: '402', route: 'POST /v1/vision', platform: 'img-tool.app', amount: '0.0000', latency: '0.4ms' },
  { code: '200', route: 'POST /v1/embed', platform: 'data-query.app', amount: '0.0004', latency: '1.1ms' },
  { code: '200', route: 'GET /v1/stream', platform: 'audio-cast.fm', amount: '0.0003', latency: '0.8ms' },
];

const KEY_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';

function randomKeyValue(env: Env) {
  const prefix = env === 'live' ? 'sk_live_xp_' : 'sk_test_xp_';
  return prefix + Array.from({ length: 22 }, () => KEY_CHARSET[Math.floor(Math.random() * KEY_CHARSET.length)]).join('');
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
  env, generated, newKeyValue, newCopied, onCopyNewKey,
  draftName, onNameChange, keyEnv, onPickEnv, scopes, onToggleScope, blocked, onGenerate, onClose,
}: {
  env: Env;
  generated: boolean;
  newKeyValue: string;
  newCopied: boolean;
  onCopyNewKey: () => void;
  draftName: string;
  onNameChange: (v: string) => void;
  keyEnv: Env;
  onPickEnv: (e: Env) => void;
  scopes: string[];
  onToggleScope: (s: string) => void;
  blocked: boolean;
  onGenerate: () => void;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(11,27,51,0.5)', backdropFilter: 'blur(3px)', animation: 'db-fade .25s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="dd-modal" onClick={stop} style={{ width: 480, maxWidth: '96vw', background: '#fff', borderRadius: 20, boxShadow: '0 40px 100px rgba(15,45,82,0.4)', animation: 'db-pop .3s cubic-bezier(.2,.8,.25,1)', overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Create API key</h2>
            <button onClick={onClose} style={{ fontFamily: 'inherit', width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(11,27,51,0.12)', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#42546E', lineHeight: 1 }}>&times;</button>
          </div>
        </div>

        {generated ? (
          <div style={{ padding: '18px 28px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 14px', borderRadius: 11, background: 'rgba(224,128,27,0.1)', border: '1px solid rgba(224,128,27,0.28)', marginBottom: 16 }}>
              <span style={{ fontSize: 15 }}>⚠️</span>
              <span style={{ fontSize: 12.5, color: '#a86a1e', lineHeight: 1.45 }}>Copy this key now — the full value is shown once. Store it as an env var.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#0c1830', borderRadius: 11, padding: '14px 15px' }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#e6edf3', flex: 1, wordBreak: 'break-all' }}>{newKeyValue}</span>
              <button onClick={onCopyNewKey} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: newCopied ? '#3ddc97' : '#9cc6f3', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 7, cursor: 'pointer', padding: '7px 11px', whiteSpace: 'nowrap' }}>
                {newCopied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <button onClick={onClose} style={{ fontFamily: 'inherit', width: '100%', marginTop: 20, fontSize: 15, fontWeight: 700, color: '#fff', background: '#2775CA', border: 'none', borderRadius: 12, cursor: 'pointer', padding: 14, boxShadow: '0 10px 26px rgba(39,117,202,0.3)', transition: 'transform .2s' }}>Done</button>
          </div>
        ) : (
          <div style={{ padding: '18px 28px 26px' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#42546E', marginBottom: 7 }}>Key name</label>
            <input className="dd-fld" value={draftName} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Production server" style={{ fontFamily: 'inherit', width: '100%', padding: '12px 14px', fontSize: 14.5, borderRadius: 11, border: '1.5px solid rgba(11,27,51,0.15)', background: '#fff', transition: 'border-color .2s, box-shadow .2s' }} />

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#42546E', margin: '18px 0 7px' }}>Environment</label>
            <div style={{ display: 'flex', gap: 9 }}>
              {(['live', 'test'] as Env[]).map((e) => {
                const sel = keyEnv === e;
                return (
                  <button key={e} onClick={() => onPickEnv(e)} style={{ fontFamily: 'inherit', flex: 1, fontSize: 13.5, fontWeight: 700, borderRadius: 11, cursor: 'pointer', padding: 12, transition: 'all .18s', background: sel ? '#EAF2FC' : '#fff', color: sel ? '#1B5FA8' : '#42546E', border: `1.5px solid ${sel ? '#2775CA' : 'rgba(11,27,51,0.13)'}` }}>
                    {e === 'live' ? 'Live' : 'Test'}
                  </button>
                );
              })}
            </div>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#42546E', margin: '18px 0 7px' }}>Scopes</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALL_SCOPES.map((name) => {
                const sel = scopes.includes(name);
                return (
                  <button key={name} onClick={() => onToggleScope(name)} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, borderRadius: 9, cursor: 'pointer', padding: '8px 12px', transition: 'all .18s', background: sel ? '#EAF2FC' : '#fff', color: sel ? '#1B5FA8' : '#42546E', border: `1.5px solid ${sel ? '#2775CA' : 'rgba(11,27,51,0.13)'}` }}>
                    {sel ? '✓' : '+'} {name}
                  </button>
                );
              })}
            </div>

            <button onClick={onGenerate} disabled={blocked} style={{ fontFamily: 'inherit', width: '100%', marginTop: 24, fontSize: 15, fontWeight: 700, color: '#fff', background: blocked ? '#9db8d6' : '#2775CA', border: 'none', borderRadius: 12, cursor: blocked ? 'not-allowed' : 'pointer', padding: 14, boxShadow: '0 10px 26px rgba(39,117,202,0.3)', transition: 'transform .2s' }}>Generate key</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Developer dashboard
───────────────────────────────────────────────────────────────── */
export default function DeveloperDashboard() {
  const [section, setSection] = useState<Section>('overview');
  const [env, setEnv] = useState<Env>('live');
  const [range, setRange] = useState<Range>('30d');
  const [paused, setPaused] = useState(false);

  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyGenerated, setKeyGenerated] = useState(false);
  const [keyDraftName, setKeyDraftName] = useState('');
  const [keyEnv, setKeyEnv] = useState<Env>('live');
  const [keyScopes, setKeyScopes] = useState<string[]>(['charges:write', 'settlements:read']);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newCopied, setNewCopied] = useState(false);

  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKeyT[]>(INITIAL_KEYS);

  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
  }, [range, animateChart]);

  const live = env === 'live';
  const rd = RANGE_DATA[range];
  const paths = buildPath(rd.vals);

  const stats = [
    { label: `Settled (${range})`, value: '$' + rd.total, delta: 'USDC', deltaColor: '#1B5FA8', deltaBg: '#EAF2FC' },
    { label: 'Charges today', value: '3,418', delta: '+5%', deltaColor: '#1B7A4B', deltaBg: 'rgba(61,220,151,0.16)' },
    { label: 'Active routes', value: '4', delta: 'live', deltaColor: '#1B7A4B', deltaBg: 'rgba(61,220,151,0.16)' },
    { label: 'Avg settle time', value: '1.9ms', delta: '-0.3ms', deltaColor: '#1B7A4B', deltaBg: 'rgba(61,220,151,0.16)' },
  ];

  const visibleKeys = keys.filter((k) => (live ? k.env === 'live' : k.env === 'test'));
  const logs = BASE_LOGS.map((l, i) => ({
    ...l,
    anim: i === 0 && !paused ? 'dd-rowin .5s ease both' : 'none',
    codeColor: l.code === '200' ? '#1B7A4B' : '#C53030',
    codeBg: l.code === '200' ? 'rgba(61,220,151,0.16)' : 'rgba(219,74,74,0.12)',
  }));

  const openKey = () => {
    setKeyModalOpen(true);
    setKeyGenerated(false);
    setKeyDraftName('');
    setKeyEnv(env);
    setKeyScopes(['charges:write', 'settlements:read']);
    setNewCopied(false);
  };
  const closeKey = () => setKeyModalOpen(false);

  const toggleScope = (name: string) => {
    setKeyScopes((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));
  };

  const kdBlocked = keyDraftName.trim().length < 2 || keyScopes.length === 0;

  const generateKey = () => {
    if (kdBlocked) return;
    const val = randomKeyValue(keyEnv);
    const nk: ApiKeyT = { id: 'k' + Date.now(), name: keyDraftName.trim(), env: keyEnv, created: 'just now', lastUsed: 'never', full: val };
    setKeys((ks) => [nk, ...ks]);
    setKeyGenerated(true);
    setNewKeyValue(val);
    setRevealed((r) => ({ ...r, [nk.id]: true }));
  };

  const copyNewKey = () => {
    try { navigator.clipboard?.writeText(newKeyValue); } catch { /* clipboard unavailable */ }
    setNewCopied(true);
    clearTimeout(newCopyResetRef.current);
    newCopyResetRef.current = setTimeout(() => setNewCopied(false), 1800);
  };

  const toggleReveal = (id: string) => setRevealed((r) => ({ ...r, [id]: !r[id] }));

  const copyKey = (k: ApiKeyT) => {
    try { navigator.clipboard?.writeText(k.full); } catch { /* clipboard unavailable */ }
    setCopiedId(k.id);
    setRevealed((r) => ({ ...r, [k.id]: true }));
    clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => setCopiedId(null), 1600);
  };

  const rollKey = (id: string) => {
    setKeys((ks) => ks.map((k) => (k.id === id ? { ...k, full: randomKeyValue(k.env), lastUsed: 'just now' } : k)));
    setRevealed((r) => ({ ...r, [id]: true }));
  };

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
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#2775CA,#1B5FA8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>AI</div>
              <div style={{ lineHeight: 1.25 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Acme Inference</div>
                <div style={{ fontSize: 11.5, color: '#8194AC' }}>ada@acme.com</div>
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
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2775CA', fontWeight: 600 }}>Acme Inference</div>
                <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', margin: '7px 0 0' }}>{SECTION_TITLES[section]}</h1>
                <div style={{ marginTop: 14, display: 'inline-block', minWidth: 200, background: 'linear-gradient(140deg,#0B1B33,#11305a)', borderRadius: 14, padding: 16, color: '#fff', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(39,117,202,0.4),transparent 70%)' }} />
                  <div style={{ position: 'relative' }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.12em', color: '#9fb3cc' }}>SETTLED &middot; ALL TIME</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, marginTop: 3 }}>$203,470</div>
                    <div style={{ fontSize: 11.5, color: '#9fb3cc', marginTop: 2 }}>on Arc via Circle</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ display: 'flex', gap: 4, padding: 4, background: '#E7EDF5', borderRadius: 11 }}>
                  <button onClick={() => setEnv('test')} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 700, border: 'none', borderRadius: 8, cursor: 'pointer', padding: '8px 13px', transition: 'all .2s', background: !live ? '#fff' : 'transparent', color: !live ? '#0B1B33' : '#5B6B82', boxShadow: !live ? '0 2px 8px rgba(15,45,82,0.12)' : 'none' }}>Test</button>
                  <button onClick={() => setEnv('live')} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 700, border: 'none', borderRadius: 8, cursor: 'pointer', padding: '8px 13px', transition: 'all .2s', background: live ? '#fff' : 'transparent', color: live ? '#0B1B33' : '#5B6B82', boxShadow: live ? '0 2px 8px rgba(15,45,82,0.12)' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: live ? '#3ddc97' : '#8194AC' }} />Live
                  </button>
                </div>
                <button className="db-primary-btn" onClick={openKey} style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#fff', background: '#2775CA', border: 'none', borderRadius: 11, cursor: 'pointer', padding: '11px 18px', boxShadow: '0 8px 22px rgba(39,117,202,0.3)', transition: 'transform .2s' }}>+ New key</button>
              </div>
            </div>

            {/* stat tiles */}
            <div className="dd-stats" style={{ marginBottom: 26 }}>
              {stats.map((s) => (
                <div key={s.label} style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 16, padding: '18px 20px', boxShadow: '0 8px 22px rgba(15,45,82,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8194AC' }}>{s.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: s.deltaColor, background: s.deltaBg, borderRadius: 6, padding: '3px 7px' }}>{s.delta}</span>
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
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em' }}>${rd.total}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#1B7A4B', background: 'rgba(61,220,151,0.16)', borderRadius: 7, padding: '3px 8px' }}>▲ {rd.delta}</span>
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
                {rd.labels.map((cl, i) => <span key={i}>{cl}</span>)}
              </div>
            </div>

            <div className="dd-cols">
              {/* protected routes */}
              <div style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 22px rgba(15,45,82,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid rgba(11,27,51,0.07)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Protected routes</h2>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#2775CA', fontWeight: 600, cursor: 'pointer' }}>+ Add route</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 0.9fr 1fr 1fr auto', gap: 10, padding: '11px 22px', fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8194AC', borderBottom: '1px solid rgba(11,27,51,0.06)' }}>
                  <span>Route</span><span className="dd-routehide">Price</span><span>Calls (24h)</span><span>Revenue</span><span />
                </div>
                {ROUTES.map((r) => {
                  const isLive = r.status === 'Live';
                  return (
                    <div key={r.path} style={{ display: 'grid', gridTemplateColumns: '1.7fr 0.9fr 1fr 1fr auto', gap: 10, alignItems: 'center', padding: '14px 22px', borderBottom: '1px solid rgba(11,27,51,0.05)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600, color: '#0B1B33', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.path}</div>
                        <div style={{ fontSize: 11.5, color: '#8194AC', marginTop: 2 }}>{r.method}</div>
                      </div>
                      <span className="dd-routehide" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#1B5FA8' }}>{r.price}</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#42546E' }}>{r.calls}</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#0B1B33' }}>${r.revenue}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 700, color: isLive ? '#1B7A4B' : '#8194AC', background: isLive ? 'rgba(61,220,151,0.16)' : 'rgba(129,148,172,0.16)', borderRadius: 999, padding: '4px 9px', whiteSpace: 'nowrap' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isLive ? '#1B7A4B' : '#8194AC' }} />{r.status}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* api keys */}
              <div style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 22px rgba(15,45,82,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid rgba(11,27,51,0.07)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>API keys</h2>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8194AC' }}>{live ? 'live mode' : 'test mode'}</span>
                </div>
                {visibleKeys.map((k) => {
                  const isRev = !!revealed[k.id];
                  const masked = (k.env === 'live' ? 'sk_live_xp_' : 'sk_test_xp_') + '•'.repeat(18);
                  const isCopied = copiedId === k.id;
                  return (
                    <div key={k.id} style={{ padding: '15px 22px', borderBottom: '1px solid rgba(11,27,51,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                          <span style={{ fontSize: 14 }}>🔑</span>
                          <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{k.name}</span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, color: k.env === 'live' ? '#1B7A4B' : '#a86a1e', background: k.env === 'live' ? 'rgba(61,220,151,0.16)' : 'rgba(224,128,27,0.14)', borderRadius: 6, padding: '2px 7px' }}>{k.env.toUpperCase()}</span>
                        </div>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8194AC', whiteSpace: 'nowrap' }}>{k.created}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, background: '#F1F5FA', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 9, padding: '9px 11px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#42546E', flex: 1, wordBreak: 'break-all' }}>{isRev ? k.full : masked}</span>
                        <button onClick={() => toggleReveal(k.id)} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 700, color: '#1B5FA8', background: '#EAF2FC', border: '1px solid rgba(39,117,202,0.22)', borderRadius: 6, cursor: 'pointer', padding: '5px 8px', whiteSpace: 'nowrap' }}>{isRev ? 'Hide' : 'Reveal'}</button>
                        <button onClick={() => copyKey(k)} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 700, color: isCopied ? '#1B7A4B' : '#42546E', background: '#fff', border: '1px solid rgba(11,27,51,0.12)', borderRadius: 6, cursor: 'pointer', padding: '5px 8px', whiteSpace: 'nowrap' }}>{isCopied ? '✓' : 'Copy'}</button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8194AC' }}>Last used {k.lastUsed}</span>
                        <button onClick={() => rollKey(k.id)} style={{ fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, color: '#C53030', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>↻ Roll key</button>
                      </div>
                    </div>
                  );
                })}
                <div onClick={openKey} style={{ padding: '14px 22px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#2775CA', cursor: 'pointer' }}>+ Create new key</div>
              </div>
            </div>

            {/* live request log */}
            <div style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 22px rgba(15,45,82,0.04)', marginTop: 26 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 22px', borderBottom: '1px solid rgba(11,27,51,0.07)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ddc97', boxShadow: '0 0 9px #3ddc97', animation: 'dd-blink 1.3s infinite' }} />
                <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Request log</h2>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: '#8194AC' }}>streaming &middot; {live ? 'live mode' : 'test mode'}</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => setPaused((p) => !p)} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 700, color: '#42546E', background: '#F1F5FA', border: '1px solid rgba(11,27,51,0.1)', borderRadius: 8, cursor: 'pointer', padding: '6px 12px' }}>{paused ? '▶ Resume' : '‖ Pause'}</button>
              </div>
              <div className="dd-scroll" style={{ maxHeight: 260, overflowY: 'auto' }}>
                {logs.map((l, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: 14, alignItems: 'center', padding: '11px 22px', borderBottom: '1px solid rgba(11,27,51,0.04)', animation: l.anim }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 700, color: l.codeColor, background: l.codeBg, borderRadius: 6, padding: '3px 7px' }}>{l.code}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#0B1B33', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.route}</span>
                    <span className="dd-routehide" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#8194AC' }}>{l.platform}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 700, color: '#1B7A4B' }}>+${l.amount}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8194AC', whiteSpace: 'nowrap' }}>{l.latency}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ═══ NEW KEY MODAL ═══ */}
      {keyModalOpen && (
        <NewKeyModal
          env={env}
          generated={keyGenerated}
          newKeyValue={newKeyValue}
          newCopied={newCopied}
          onCopyNewKey={copyNewKey}
          draftName={keyDraftName}
          onNameChange={setKeyDraftName}
          keyEnv={keyEnv}
          onPickEnv={setKeyEnv}
          scopes={keyScopes}
          onToggleScope={toggleScope}
          blocked={kdBlocked}
          onGenerate={generateKey}
          onClose={closeKey}
        />
      )}
    </div>
  );
}
