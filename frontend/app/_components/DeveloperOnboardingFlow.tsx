'use client';

import { useState, useRef, useCallback } from 'react';

type UseCase = 'action' | 'inference' | 'second';
type Stack = 'Express' | 'Next.js' | 'Hono' | 'FastAPI';

const STEP_LABELS = ['Account', 'Project', 'API key', 'Live'] as const;
const CAPTIONS = [
  'Bootstrapping your environment…',
  'Tailoring your quickstart…',
  'Keep this key secret — env vars only',
  '🎉 Welcome to XanPay',
];
const CONFETTI_COLORS = ['#2775CA', '#3a8ce0', '#3ddc97', '#f1d98a', '#ffffff', '#9cc6f3'];
const KEY = 'sk_live_xp_9f2Ka7Dq4mZ1v8Rb3Xc6Ht0';
const MASKED_KEY = 'sk_live_xp_' + '•'.repeat(22);
const SCOPES = ['charges:write', 'settlements:read', 'routes:manage'];
const STACKS: Stack[] = ['Express', 'Next.js', 'Hono', 'FastAPI'];
const USE_CASES: { id: UseCase; label: string; glyph: string }[] = [
  { id: 'action', label: 'Per action', glyph: 'ƒ()' },
  { id: 'inference', label: 'Per inference', glyph: '✦' },
  { id: 'second', label: 'Per second', glyph: '0:01' },
];
const ROUTE_BY_CASE: Record<UseCase, string> = { action: '/v1/run', inference: '/v1/infer', second: '/v1/stream' };
const PRICE_BY_CASE: Record<UseCase, string> = { action: "'$0.0008'", inference: "'$0.0012'", second: "'$0.0003'" };
const CHART_VALS = [8, 18, 15, 34, 52, 78];
const CHART_MAX = 90;
const TARGET_SETTLEMENTS = 48920;

function buildChartPaths() {
  const pts = CHART_VALS.map((v, i) => ({ x: (i / (CHART_VALS.length - 1)) * 400, y: 180 - (v / CHART_MAX) * 160 }));
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    const cx = (p0.x + p1.x) / 2;
    line += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  const area = line + ' L 400 180 L 0 180 Z';
  return { line, area };
}

export default function DeveloperOnboardingFlow() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [org, setOrg] = useState('');
  const [useCase, setUseCase] = useState<UseCase>('inference');
  const [stack, setStack] = useState<Stack>('Express');
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [snipCopied, setSnipCopied] = useState(false);
  const [count, setCount] = useState(0);

  const bodyRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const snipResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* ── confetti burst ─────────────────────────────────────────────── */
  const burst = useCallback(() => {
    const host = confettiRef.current;
    if (!host) return;
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('div');
      const sz = 6 + Math.random() * 7;
      p.style.cssText = [
        'position:absolute',
        'top:30%',
        `left:${8 + Math.random() * 84}%`,
        `width:${sz}px`,
        `height:${sz * 0.5}px`,
        `background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`,
        'border-radius:2px',
        'opacity:0',
        `animation:xp-fall ${1.1 + Math.random() * 1.3}s cubic-bezier(.3,.6,.4,1) ${Math.random() * 0.3}s forwards`,
      ].join(';');
      host.appendChild(p);
      setTimeout(() => p.remove(), 3000);
    }
  }, []);

  /* ── settlements chart draw-on ───────────────────────────────────── */
  const animateChart = useCallback(() => {
    setTimeout(() => {
      const line = lineRef.current, area = areaRef.current, dot = dotRef.current;
      if (!line) return;
      const len = line.getTotalLength();
      line.style.strokeDasharray = String(len);
      line.style.strokeDashoffset = String(len);
      line.getBoundingClientRect();
      line.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.4,.1,.2,1)';
      line.style.strokeDashoffset = '0';
      if (area) {
        area.style.transition = 'opacity .8s ease .8s';
        area.style.opacity = '1';
      }
      if (dot) {
        const p = line.getPointAtLength(len);
        dot.setAttribute('cx', String(p.x));
        dot.setAttribute('cy', String(p.y));
        dot.style.transition = 'opacity .4s ease 1.5s';
        dot.style.opacity = '1';
      }
    }, 60);
  }, []);

  /* ── projected settlements count-up ──────────────────────────────── */
  const countUp = useCallback(() => {
    const t0 = performance.now();
    const dur = 1600;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(TARGET_SETTLEMENTS * e));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  /* ── step navigation ────────────────────────────────────────────── */
  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(3, next));
    setStep((prev) => {
      const enteringDone = clamped === 3 && prev !== 3;
      if (enteringDone) {
        animateChart();
        countUp();
        setTimeout(burst, 300);
      }
      return clamped;
    });
    setCopied(false);
    setSnipCopied(false);
    setRevealed((prevRevealed) => (clamped === 2 ? prevRevealed : false));

    const b = bodyRef.current;
    if (b) {
      b.style.animation = 'none';
      void b.offsetWidth;
      b.style.animation = 'xp-in .45s ease both';
    }
  }, [animateChart, countUp, burst]);

  const restart = useCallback(() => {
    setStep(0); setEmail(''); setPass(''); setOrg('');
    setUseCase('inference'); setStack('Express');
    setRevealed(false); setCopied(false); setSnipCopied(false); setCount(0);
  }, []);

  /* ── derived values ─────────────────────────────────────────────── */
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const accountBlocked = !emailValid || pass.length < 8;
  const orgBlocked = org.trim().length < 2;
  const orgName = org.trim() || 'your project';
  const firstName = (() => {
    const raw = (email.split('@')[0] || 'there').replace(/[._-]/g, ' ').split(' ')[0];
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  const route = ROUTE_BY_CASE[useCase];
  const price = PRICE_BY_CASE[useCase];
  const codeLine = `app.use(xanpay.charge('${route}', { price: ${price} }))`;
  const snippetFile = stack === 'FastAPI' ? 'main.py' : 'server.ts';

  const paths = buildChartPaths();

  let termLines: { text: string; color: string }[];
  if (step === 0) {
    termLines = [
      { text: '$ npx create-xanpay-app', color: '#6cb0f5' },
      { text: '✓ Circle Gateway reachable', color: '#3ddc97' },
      { text: '✓ Arc settlement node online', color: '#3ddc97' },
      { text: '  Create an account to continue →', color: '#7e93ad' },
    ];
  } else if (step === 1) {
    termLines = [
      { text: '$ xanpay init', color: '#6cb0f5' },
      { text: '✓ Account created', color: '#3ddc97' },
      { text: '? Naming your first project…', color: '#f0b878' },
      { text: '  Pick a stack to tailor the quickstart', color: '#7e93ad' },
    ];
  } else {
    termLines = [
      { text: '$ xanpay keys:create --live', color: '#6cb0f5' },
      { text: `✓ Project ${orgName} provisioned`, color: '#3ddc97' },
      { text: '✓ Secret key generated', color: '#3ddc97' },
    ];
  }

  /* ── shared styles ───────────────────────────────────────────────── */
  const inputBase: React.CSSProperties = {
    fontFamily: 'inherit',
    width: '100%',
    marginTop: 7,
    padding: '14px 16px',
    fontSize: 15.5,
    borderRadius: 12,
    border: '1.5px solid rgba(11,27,51,0.15)',
    background: '#fff',
    transition: 'border-color .2s, box-shadow .2s',
  };

  const primaryBtn = (disabled: boolean): React.CSSProperties => ({
    fontFamily: 'inherit',
    fontSize: 15.5,
    fontWeight: 700,
    color: '#fff',
    background: disabled ? '#9db8d6' : '#2775CA',
    border: 'none',
    borderRadius: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    padding: 15,
    boxShadow: '0 10px 26px rgba(39,117,202,0.3)',
    transition: 'transform .2s, background .2s',
  });

  const ghostBtn: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: 15,
    fontWeight: 600,
    color: '#0B1B33',
    background: 'transparent',
    border: '1.5px solid rgba(11,27,51,0.15)',
    borderRadius: 12,
    cursor: 'pointer',
    padding: '15px 22px',
    transition: 'border-color .2s',
  };

  const stepLabel: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#2775CA',
    fontWeight: 600,
  };

  const heading: React.CSSProperties = {
    fontSize: 33,
    lineHeight: 1.1,
    letterSpacing: '-0.03em',
    fontWeight: 800,
    margin: '12px 0 6px',
  };

  const sub: React.CSSProperties = {
    fontSize: 15.5,
    color: '#5B6B82',
    lineHeight: 1.5,
    margin: '0 0 24px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: '#42546E',
  };

  const copyKey = () => {
    try { navigator.clipboard?.writeText(KEY); } catch { /* clipboard unavailable */ }
    setCopied(true);
    setRevealed(true);
    clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => setCopied(false), 1800);
  };

  const copySnippet = () => {
    try { navigator.clipboard?.writeText(`import { xanpay } from '@xanpay/sdk'\n${codeLine}`); } catch { /* clipboard unavailable */ }
    setSnipCopied(true);
    clearTimeout(snipResetRef.current);
    snipResetRef.current = setTimeout(() => setSnipCopied(false), 1800);
  };

  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#0B1B33', WebkitFontSmoothing: 'antialiased' }}>
      <div className="do-grid">

        {/* ════ LEFT — Stage ═══════════════════════════════════════ */}
        <div className="do-stage">
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px)',
            backgroundSize: '42px 42px',
            WebkitMaskImage: 'radial-gradient(circle at 50% 40%,#000,transparent 74%)',
            maskImage: 'radial-gradient(circle at 50% 40%,#000,transparent 74%)',
          }} />
          <div style={{
            position: 'absolute', top: '-8%', left: '50%', transform: 'translateX(-50%)',
            width: 520, height: 520, borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(39,117,202,0.28),transparent 65%)',
            filter: 'blur(20px)', animation: 'xp-pulse 6s infinite',
          }} />
          <div ref={confettiRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8, overflow: 'hidden' }} />

          {/* Brand */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9, zIndex: 5 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: 'linear-gradient(135deg,#2775CA,#1B5FA8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(39,117,202,0.4)',
            }}>
              <div style={{ width: 11, height: 11, borderRadius: 3, background: '#fff', opacity: 0.92 }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: '#fff' }}>XanPay</span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
              color: '#6cb0f5', background: 'rgba(39,117,202,0.18)', border: '1px solid rgba(39,117,202,0.32)',
              borderRadius: 999, padding: '3px 9px', marginLeft: 2,
            }}>DEVELOPERS</span>
          </div>

          {/* Stage content */}
          <div style={{ position: 'relative', zIndex: 4, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

            {/* steps 0-1: terminal */}
            {step <= 1 && (
              <div>
                <div style={{ borderRadius: 15, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 30px 70px rgba(0,0,0,0.4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 16px', background: '#0c1830', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#7e93ad', marginLeft: 10 }}>xanpay — onboarding</span>
                  </div>
                  <div style={{ background: '#0c1830', padding: '22px 20px', minHeight: 280, fontFamily: "'JetBrains Mono', monospace", fontSize: 13.5, lineHeight: 1.9 }}>
                    {termLines.map((l, i) => (
                      <div key={i} style={{ animation: 'xp-in .4s ease both', color: l.color }}>{l.text}</div>
                    ))}
                    <div style={{ color: '#6cb0f5' }}>
                      $ <span style={{ display: 'inline-block', width: 8, height: 15, background: '#6cb0f5', verticalAlign: -2, animation: 'do-blink 1.1s steps(1) infinite' }} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20, marginTop: 22, padding: '0 4px' }}>
                  {[{ v: '2ms', k: 'settlement proof' }, { v: '$0.0001', k: 'min charge' }, { v: '0 gas', k: 'per charge' }].map(({ v, k }) => (
                    <div key={k}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19, fontWeight: 700, color: '#fff' }}>{v}</div>
                      <div style={{ fontSize: 11.5, color: '#7e93ad', marginTop: 2 }}>{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* step 2: API key card */}
            {step === 2 && (
              <div style={{ animation: 'xp-in .5s ease both' }}>
                <div style={{ borderRadius: 15, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 30px 70px rgba(0,0,0,0.4)', background: 'linear-gradient(150deg,#11305a,#0a1526)' }}>
                  <div style={{ padding: '20px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ fontSize: 15 }}>🔑</span>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Secret API key</span>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 700, color: '#3ddc97', background: 'rgba(61,220,151,0.16)', borderRadius: 999, padding: '4px 10px' }}>LIVE</span>
                  </div>
                  <div style={{ padding: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0a1526', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11, padding: '14px 16px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13.5, color: '#e6edf3', wordBreak: 'break-all', flex: 1 }}>{revealed ? KEY : MASKED_KEY}</span>
                      <button onClick={() => setRevealed((r) => !r)} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: '#9cc6f3', background: 'rgba(39,117,202,0.18)', border: '1px solid rgba(39,117,202,0.3)', borderRadius: 7, cursor: 'pointer', padding: '6px 10px', whiteSpace: 'nowrap' }}>
                        {revealed ? 'Hide' : 'Reveal'}
                      </button>
                      <button onClick={copyKey} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: copied ? '#3ddc97' : '#9cc6f3', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, cursor: 'pointer', padding: '6px 10px', whiteSpace: 'nowrap' }}>
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 15, padding: '12px 14px', borderRadius: 11, background: 'rgba(224,128,27,0.1)', border: '1px solid rgba(224,128,27,0.28)' }}>
                      <span style={{ fontSize: 15 }}>⚠️</span>
                      <span style={{ fontSize: 12.5, color: '#f0b878', lineHeight: 1.45 }}>Copy this now — you won&apos;t see the full key again. Store it as an environment variable, never in client code.</span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#7e93ad', marginTop: 16 }}>SCOPES</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
                      {SCOPES.map((sc) => (
                        <span key={sc} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: '#9cc6f3', background: 'rgba(39,117,202,0.16)', border: '1px solid rgba(39,117,202,0.28)', borderRadius: 7, padding: '4px 9px' }}>{sc}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* step 3: welcome chart */}
            {step === 3 && (
              <div style={{ animation: 'xp-in .5s ease both' }}>
                <div style={{ borderRadius: 15, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 30px 70px rgba(0,0,0,0.4)', background: 'linear-gradient(150deg,#11305a,#0a1526)', padding: '22px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em', color: '#7e93ad' }}>PROJECTED SETTLEMENTS · USDC</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 30, fontWeight: 700, color: '#fff', marginTop: 5 }}>${count.toLocaleString('en-US')}</div>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: '#3ddc97', background: 'rgba(61,220,151,0.16)', borderRadius: 8, padding: '5px 10px' }}>▲ +38%</span>
                  </div>
                  <div style={{ position: 'relative', height: 180, marginTop: 18 }}>
                    <svg viewBox="0 0 400 180" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="doFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2775CA" stopOpacity={0.42} />
                          <stop offset="100%" stopColor="#2775CA" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <g stroke="rgba(255,255,255,0.06)" strokeWidth={1}>
                        <line x1={0} y1={45} x2={400} y2={45} />
                        <line x1={0} y1={90} x2={400} y2={90} />
                        <line x1={0} y1={135} x2={400} y2={135} />
                      </g>
                      <path ref={areaRef} d={paths.area} fill="url(#doFill)" opacity={0} />
                      <path ref={lineRef} d={paths.line} fill="none" stroke="#3a8ce0" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                      <circle ref={dotRef} r={5} fill="#fff" stroke="#2775CA" strokeWidth={3} opacity={0} />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: '#6f86a3', marginTop: 8 }}>
                    {['W1', 'W2', 'W3', 'W4', 'W5', 'W6'].map((w) => <span key={w}>{w}</span>)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ position: 'relative', zIndex: 5, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#6f86a3', textAlign: 'center', marginTop: 16, transition: 'opacity .3s' }}>
            {CAPTIONS[step]}
          </div>
        </div>

        {/* ════ RIGHT — Panel ═══════════════════════════════════════ */}
        <div className="do-panel do-scroll">

          {/* Stepper */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 34 }}>
            {STEP_LABELS.map((label, i) => {
              const done = i < step, active = i === step;
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', ...(i < STEP_LABELS.length - 1 ? { flex: 1 } : {}) }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12.5,
                      transition: 'all .35s',
                      background: done ? '#2775CA' : active ? '#fff' : '#E7EDF5',
                      color: done ? '#fff' : active ? '#2775CA' : '#8194AC',
                      border: `1.5px solid ${done || active ? '#2775CA' : 'transparent'}`,
                    }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: (done || active) ? '#0B1B33' : '#8194AC', whiteSpace: 'nowrap' }}>{label}</span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div style={{ flex: 1, height: 2, margin: '0 8px 22px', borderRadius: 2, transition: 'background .35s', background: i < step ? '#2775CA' : 'rgba(11,27,51,0.12)' }} />
                  )}
                </div>
              );
            })}
          </div>

          <div ref={bodyRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 440, width: '100%', margin: '0 auto' }}>

            {/* ─── STEP 0 — Account ─── */}
            {step === 0 && (
              <div>
                <div style={stepLabel}>Step 1 of 4</div>
                <h1 className="do-h1" style={{ ...heading, fontSize: 33 }}>Start charging in minutes</h1>
                <p style={sub}>Create a developer account and get a live API key. Protect any route with one line and settle in USDC on Arc.</p>

                <label style={labelStyle}>Work email</label>
                <input
                  className="do-fld"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !accountBlocked && go(1)}
                  style={inputBase}
                />

                <label style={{ ...labelStyle, display: 'block', marginTop: 16 }}>Password</label>
                <input
                  className="do-fld"
                  type="password"
                  placeholder="At least 8 characters"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !accountBlocked && go(1)}
                  style={inputBase}
                />

                <button onClick={() => go(1)} disabled={accountBlocked} style={{ ...primaryBtn(accountBlocked), width: '100%', marginTop: 20 }}>
                  Create account →
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(11,27,51,0.1)' }} />
                  <span style={{ fontSize: 12.5, color: '#8194AC' }}>or</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(11,27,51,0.1)' }} />
                </div>

                <button onClick={() => go(1)} style={{ fontFamily: 'inherit', width: '100%', fontSize: 15, fontWeight: 600, color: '#0B1B33', background: '#fff', border: '1.5px solid rgba(11,27,51,0.15)', borderRadius: 12, cursor: 'pointer', padding: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, transition: 'border-color .2s' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15 }}>◈</span> Continue with GitHub
                </button>
              </div>
            )}

            {/* ─── STEP 1 — Org / stack ─── */}
            {step === 1 && (
              <div>
                <div style={stepLabel}>Step 2 of 4</div>
                <h1 className="do-h1" style={{ ...heading, fontSize: 33 }}>Tell us about your project</h1>
                <p style={sub}>This names your first project and tunes the quickstart to your stack.</p>

                <label style={labelStyle}>Organization / project name</label>
                <input
                  className="do-fld"
                  placeholder="e.g. Acme Inference"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !orgBlocked && go(2)}
                  style={inputBase}
                />

                <label style={{ ...labelStyle, display: 'block', marginTop: 18 }}>What are you charging for?</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9, marginTop: 8 }}>
                  {USE_CASES.map((u) => {
                    const sel = useCase === u.id;
                    return (
                      <button key={u.id} onClick={() => setUseCase(u.id)} style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, borderRadius: 11, cursor: 'pointer', padding: '12px 6px', transition: 'all .18s', background: sel ? '#EAF2FC' : '#fff', color: sel ? '#1B5FA8' : '#42546E', border: `1.5px solid ${sel ? '#2775CA' : 'rgba(11,27,51,0.13)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 16 }}>{u.glyph}</span>{u.label}
                      </button>
                    );
                  })}
                </div>

                <label style={{ ...labelStyle, display: 'block', marginTop: 18 }}>Server framework</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {STACKS.map((k) => {
                    const sel = stack === k;
                    return (
                      <button key={k} onClick={() => setStack(k)} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 600, borderRadius: 9, cursor: 'pointer', padding: '9px 13px', transition: 'all .18s', background: sel ? '#EAF2FC' : '#fff', color: sel ? '#1B5FA8' : '#42546E', border: `1.5px solid ${sel ? '#2775CA' : 'rgba(11,27,51,0.13)'}` }}>
                        {k}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 26 }}>
                  <button onClick={() => go(0)} style={ghostBtn}>Back</button>
                  <button onClick={() => go(2)} disabled={orgBlocked} style={{ ...primaryBtn(orgBlocked), flex: 1 }}>
                    Generate API key →
                  </button>
                </div>
              </div>
            )}

            {/* ─── STEP 2 — Key + integrate ─── */}
            {step === 2 && (
              <div>
                <div style={stepLabel}>Step 3 of 4</div>
                <h1 className="do-h1" style={{ ...heading, fontSize: 33 }}>Your key is ready</h1>
                <p style={{ ...sub, margin: '0 0 22px' }}>
                  Grab it from the panel, then drop these lines into <b style={{ color: '#0B1B33' }}>{orgName}</b>. That&apos;s the whole integration.
                </p>

                <div style={{ borderRadius: 13, overflow: 'hidden', boxShadow: '0 16px 40px rgba(15,45,82,0.16)', border: '1px solid rgba(11,27,51,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 15px', background: '#0a1526' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#7e93ad' }}>{snippetFile}</span>
                    <button onClick={copySnippet} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: snipCopied ? '#3ddc97' : '#9cc6f3', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, cursor: 'pointer', padding: '5px 10px' }}>
                      {snipCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre style={{ margin: 0, padding: '16px 15px', background: '#0c1830', fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, lineHeight: 1.75, overflowX: 'auto' }}>
                    <code>
                      <span style={{ color: '#5d7a9e' }}>// set XANPAY_KEY in your env</span>{'\n'}
                      <span style={{ color: '#c792ea' }}>import</span> <span style={{ color: '#e6edf3' }}>{'{ xanpay }'}</span> <span style={{ color: '#c792ea' }}>from</span> <span style={{ color: '#9ece6a' }}>&apos;@xanpay/sdk&apos;</span>{'\n'}
                      <span style={{ color: '#e6edf3' }}>{codeLine}</span>
                    </code>
                  </pre>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '12px 15px', borderRadius: 12, background: '#EAF2FC', border: '1px solid rgba(39,117,202,0.18)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ddc97', boxShadow: '0 0 8px #3ddc97', animation: 'xp-pulse 1.4s infinite' }} />
                  <span style={{ fontSize: 13, color: '#1B5FA8' }}>Waiting for your first charge… it&apos;ll appear here live.</span>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button onClick={() => go(1)} style={ghostBtn}>Back</button>
                  <button onClick={() => go(3)} style={{ ...primaryBtn(false), flex: 1 }}>
                    I&apos;ve added it →
                  </button>
                </div>
              </div>
            )}

            {/* ─── STEP 3 — Done ─── */}
            {step === 3 && (
              <div style={{ animation: 'xp-in .6s ease both' }}>
                <div style={{ width: 58, height: 58, borderRadius: 16, background: 'linear-gradient(135deg,#3ddc97,#1B7A4B)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 30px rgba(27,122,75,0.34)' }}>
                  <span style={{ fontSize: 30, color: '#fff' }}>✓</span>
                </div>

                <h1 className="do-h1" style={{ ...heading, fontSize: 33, margin: '20px 0 6px' }}>You&apos;re charging, {firstName}.</h1>
                <p style={sub}>
                  <b style={{ color: '#0B1B33' }}>{orgName}</b> is live on XanPay. Every protected request now settles in USDC on Arc — watch it climb.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <a href="/developers/dashboard" style={{ fontFamily: 'inherit', fontSize: 15.5, fontWeight: 700, color: '#fff', background: '#2775CA', border: 'none', borderRadius: 12, cursor: 'pointer', padding: 15, boxShadow: '0 10px 26px rgba(39,117,202,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'transform .2s', textDecoration: 'none' }}>
                    <span>Open developer dashboard</span><span>→</span>
                  </a>
                  <button style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: '#0B1B33', background: '#fff', border: '1.5px solid rgba(11,27,51,0.15)', borderRadius: 12, cursor: 'pointer', padding: 14, transition: 'border-color .2s' }}>
                    Read the docs
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 20, marginTop: 28, paddingTop: 22, borderTop: '1px solid rgba(11,27,51,0.08)' }}>
                  {[{ v: stack, k: 'framework' }, { v: '1 route', k: 'protected' }, { v: 'Live', k: 'settlement' }].map(({ v, k }) => (
                    <div key={k}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: '#0B1B33' }}>{v}</div>
                      <div style={{ fontSize: 12, color: '#8194AC', marginTop: 2 }}>{k}</div>
                    </div>
                  ))}
                </div>

                <button onClick={restart} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: '#8194AC', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: 22, padding: 0 }}>
                  ↻ Replay onboarding
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
