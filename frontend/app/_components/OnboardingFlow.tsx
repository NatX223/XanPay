'use client';

import { useState, useRef, useCallback } from 'react';

type Method = 'deposit' | 'ramp';

const STEP_LABELS = ['Account', 'Identity', 'Fund', 'Card', 'Done'] as const;
const CAPTIONS = [
  'Building your card…',
  'Printing your name…',
  'Loading your balance…',
  'Card activated — settled on Arc',
  'Ready to spend by the millisecond',
];
const CONFETTI_COLORS = ['#2775CA', '#3a8ce0', '#3ddc97', '#f1d98a', '#ffffff', '#9cc6f3'];
const AMOUNT_CHIPS = [{ v: 25, label: '$25' }, { v: 50, label: '$50' }, { v: 100, label: '$100' }, { v: 500, label: 'Max' }];

function fmt(n: string | number) {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OnboardingFlow() {
  const [step, setStep]     = useState(0);
  const [email, setEmail]   = useState('');
  const [name, setName]     = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('deposit');
  const [flipped, setFlipped] = useState(false);

  const confettiRef = useRef<HTMLDivElement>(null);
  const bodyRef     = useRef<HTMLDivElement>(null);

  /* ── confetti burst ─────────────────────────────────────────────── */
  const burst = useCallback(() => {
    const host = confettiRef.current;
    if (!host) return;
    for (let i = 0; i < 80; i++) {
      const p = document.createElement('div');
      const sz = 6 + Math.random() * 7;
      p.style.cssText = [
        'position:absolute',
        `top:38%`,
        `left:${10 + Math.random() * 80}%`,
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

  /* ── step navigation ────────────────────────────────────────────── */
  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(4, next));
    const enteringReveal = clamped === 3 && step !== 3;

    setStep(clamped);
    setFlipped(false);

    const b = bodyRef.current;
    if (b && clamped !== 3) {
      b.style.animation = 'none';
      void b.offsetWidth;
      b.style.animation = 'xp-in .5s ease both';
    }

    if (enteringReveal) setTimeout(burst, 420);
  }, [step, burst]);

  /* ── derived values ─────────────────────────────────────────────── */
  const amt         = Number(amount) || 0;
  const cardName    = name.trim() ? name.trim().toUpperCase() : 'YOUR NAME';
  const cardBalance = fmt(amount);
  const funded      = step >= 3;
  const firstName   = name.trim().split(/\s+/)[0] || 'there';

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  let cardTransform = 'rotateY(-12deg) rotateX(7deg)';
  if (step === 3) cardTransform = flipped ? 'rotateY(168deg) rotateX(4deg)' : 'rotateY(0deg) rotateX(3deg) scale(1.04)';

  /* ── shared input style ─────────────────────────────────────────── */
  const inputBase: React.CSSProperties = {
    fontFamily: 'inherit',
    width: '100%',
    padding: '14px 16px',
    fontSize: 15.5,
    borderRadius: 12,
    border: '1.5px solid rgba(11,27,51,0.15)',
    background: '#fff',
    transition: 'border-color .2s, box-shadow .2s',
    marginTop: 7,
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
    fontSize: 34,
    lineHeight: 1.1,
    letterSpacing: '-0.03em',
    fontWeight: 800,
    margin: '12px 0 6px',
  };

  const sub: React.CSSProperties = {
    fontSize: 15.5,
    color: '#5B6B82',
    lineHeight: 1.5,
    margin: '0 0 26px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: '#42546E',
  };

  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#0B1B33', WebkitFontSmoothing: 'antialiased' }}>
      <div className="ob-grid">

        {/* ════ LEFT — Card Stage ════════════════════════════════════ */}
        <div className="ob-stage">
          {/* Grid pattern overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.045) 1px,transparent 1px)',
            backgroundSize: '44px 44px',
            WebkitMaskImage: 'radial-gradient(circle at 50% 45%,#000,transparent 72%)',
            maskImage: 'radial-gradient(circle at 50% 45%,#000,transparent 72%)',
          }} />

          {/* Glow orb */}
          <div style={{
            position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
            width: 520, height: 520, borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(39,117,202,0.34),transparent 65%)',
            filter: 'blur(18px)',
            animation: 'xp-pulse 5s infinite',
          }} />

          {/* Confetti mount */}
          <div ref={confettiRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6, overflow: 'hidden' }} />

          {/* Brand mark */}
          <div style={{ position: 'absolute', top: 30, left: 34, display: 'flex', alignItems: 'center', gap: 9, zIndex: 5 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: 'linear-gradient(135deg,#2775CA,#1B5FA8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(39,117,202,0.4)',
            }}>
              <div style={{ width: 11, height: 11, borderRadius: 3, background: '#fff', opacity: 0.92 }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: '#fff' }}>XanPay</span>
          </div>

          {/* ── 3-D card ── */}
          <div style={{ position: 'relative', zIndex: 4, perspective: 1500 }} className="ob-cardscale">
            <div style={{ animation: 'xp-float 6.5s ease-in-out infinite' }}>
              <div style={{
                position: 'relative', width: 392, height: 246, borderRadius: 22,
                transform: cardTransform,
                transformStyle: 'preserve-3d',
                transition: 'transform 0.9s cubic-bezier(.2,.8,.25,1)',
                willChange: 'transform',
              }}>
                {/* Glow behind card */}
                <div style={{
                  position: 'absolute', inset: -14, borderRadius: 28,
                  background: 'radial-gradient(circle at 30% 30%,rgba(39,117,202,0.6),transparent 70%)',
                  filter: 'blur(24px)', zIndex: -1,
                }} />

                {/* ── FRONT FACE ── */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 22,
                  backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                  background: 'linear-gradient(140deg,rgba(255,255,255,0.62),rgba(214,232,250,0.32) 48%,rgba(39,117,202,0.22))',
                  backdropFilter: 'blur(14px)',
                  border: '1px solid rgba(255,255,255,0.7)',
                  boxShadow: '0 30px 70px rgba(15,45,82,0.42),inset 0 1px 1px rgba(255,255,255,0.9)',
                  overflow: 'hidden',
                }}>
                  {/* Sheen sweep */}
                  <div style={{
                    position: 'absolute', top: '-40%', left: 0, width: '55%', height: '180%',
                    background: 'linear-gradient(105deg,transparent,rgba(255,255,255,0.55),transparent)',
                    animation: 'xp-sheen 5.5s ease-in-out infinite',
                    pointerEvents: 'none',
                  }} />

                  {/* USDC badge */}
                  <div style={{
                    position: 'absolute', right: 24, top: 22, width: 42, height: 42, borderRadius: '50%',
                    background: 'radial-gradient(circle at 40% 35%,#3a8ce0,#2775CA)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 22px rgba(39,117,202,0.7),inset 0 1px 2px rgba(255,255,255,0.6)',
                  }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 17, color: '#fff' }}>$</span>
                  </div>

                  {/* Card body */}
                  <div style={{ position: 'relative', padding: '24px 26px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 17, height: 17, borderRadius: 5, background: 'linear-gradient(135deg,#2775CA,#1B5FA8)' }} />
                        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em', color: '#0B1B33' }}>XanCard</span>
                        <span style={{
                          marginLeft: 6,
                          fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, fontWeight: 700,
                          letterSpacing: '0.1em', color: '#1B7A4B',
                          background: 'rgba(61,220,151,0.18)', border: '1px solid rgba(61,220,151,0.4)',
                          borderRadius: 999, padding: '2px 7px',
                          opacity: funded ? 1 : 0, transition: 'opacity .5s ease',
                        }}>ACTIVE</span>
                      </div>
                      {/* EMV chip */}
                      <div style={{
                        width: 40, height: 30, borderRadius: 7, marginTop: 18,
                        background: 'linear-gradient(135deg,#d9b24a,#f1d98a 45%,#c79a35)',
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)',
                        position: 'relative',
                      }}>
                        <div style={{ position: 'absolute', inset: 6, border: '1px solid rgba(120,90,20,0.35)', borderRadius: 3 }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.12em', color: '#3a5074', opacity: 0.7 }}>CARDHOLDER</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, fontSize: 14, letterSpacing: '0.04em', color: '#0B1B33', marginTop: 2, minHeight: 18, transition: 'color .3s ease' }}>
                        {cardName}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.12em', color: '#3a5074', opacity: 0.7 }}>BALANCE</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 23, letterSpacing: '-0.01em', color: '#0B1B33', marginTop: 2 }}>
                          ${cardBalance} <span style={{ fontSize: 12, color: '#2775CA' }}>USDC</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, lineHeight: 1.5, color: '#3a5074' }}>
                        <div style={{ fontWeight: 600, color: '#1B5FA8' }}>ARC</div>
                        <div style={{ opacity: 0.7 }}>powered by Circle</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── BACK FACE ── */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 22,
                  backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: 'linear-gradient(140deg,#11305a,#0B1B33)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 30px 70px rgba(15,45,82,0.42)',
                  overflow: 'hidden',
                }}>
                  <div style={{ width: '100%', height: 46, background: '#06101f', marginTop: 26 }} />
                  <div style={{ padding: '18px 26px' }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, letterSpacing: '0.12em', color: '#6f86a3' }}>
                      XANPAY . ARC
                    </div>
                    <div style={{
                      marginTop: 14, height: 30, borderRadius: 6,
                      background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.5) 0 2px,transparent 2px 5px)',
                      opacity: 0.5,
                    }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stage caption */}
          <div style={{ position: 'absolute', bottom: 30, left: 0, right: 0, textAlign: 'center', zIndex: 5 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, letterSpacing: '0.04em', color: '#9fb3cc', transition: 'opacity .4s ease' }}>
              {CAPTIONS[step]}
            </div>
          </div>
        </div>

        {/* ════ RIGHT — Step Panel ══════════════════════════════════= */}
        <div className="ob-panel">

          {/* ── Stepper ── */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 36 }}>
            {STEP_LABELS.map((label, i) => {
              const done   = i < step;
              const active = i === step;
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', ...(i < STEP_LABELS.length - 1 ? { flex: 1 } : {}) }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 12.5,
                      transition: 'all .35s ease',
                      background: done ? '#2775CA' : active ? '#fff' : '#E7EDF5',
                      color:      done ? '#fff'    : active ? '#2775CA' : '#8194AC',
                      border: `1.5px solid ${done || active ? '#2775CA' : 'transparent'}`,
                    }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: (done || active) ? '#0B1B33' : '#8194AC', whiteSpace: 'nowrap' }}>
                      {label}
                    </span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div style={{
                      flex: 1, height: 2, margin: '0 8px', marginBottom: 22,
                      background: i < step ? '#2775CA' : 'rgba(11,27,51,0.12)',
                      transition: 'background .35s ease', borderRadius: 2,
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Step content ── */}
          <div ref={bodyRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 440, width: '100%', margin: '0 auto' }}>

            {/* ─── STEP 0 — Account ─── */}
            {step === 0 && (
              <div>
                <div style={stepLabel}>Step 1 of 5</div>
                <h1 className="ob-h1" style={heading}>Create your XanCard</h1>
                <p style={sub}>Spend by the millisecond, settled in USDC. No wallet, no seed phrase — just a card.</p>

                <label style={labelStyle}>Email address</label>
                <input
                  className="ob-fld"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && emailValid && go(1)}
                  style={inputBase}
                />

                <button onClick={() => go(1)} disabled={!emailValid} style={{ ...primaryBtn(!emailValid), width: '100%', marginTop: 18 }}>
                  Continue →
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(11,27,51,0.1)' }} />
                  <span style={{ fontSize: 12.5, color: '#8194AC' }}>or</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(11,27,51,0.1)' }} />
                </div>

                <button
                  onClick={() => go(1)}
                  style={{ fontFamily: 'inherit', width: '100%', fontSize: 15, fontWeight: 600, color: '#0B1B33', background: '#fff', border: '1.5px solid rgba(11,27,51,0.15)', borderRadius: 12, cursor: 'pointer', padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, transition: 'border-color .2s' }}
                >
                  <span style={{ fontSize: 16 }}></span> Continue with Google
                </button>

                <p style={{ fontSize: 12, color: '#8194AC', lineHeight: 1.5, margin: '22px 0 0', textAlign: 'center' }}>
                  By continuing you agree to the Terms.<b style={{ color: '#56657D' }}></b>
                </p>
              </div>
            )}

            {/* ─── STEP 1 — Identity ─── */}
            {step === 1 && (
              <div>
                <div style={stepLabel}>Step 2 of 5</div>
                <h1 className="ob-h1" style={heading}>Whose card is this?</h1>
                <p style={sub}>Your name prints on the card. A quick check keeps your funds compliant and recoverable.</p>

                <label style={labelStyle}>Full name</label>
                <input
                  className="ob-fld"
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && name.trim().length >= 2 && go(2)}
                  style={inputBase}
                />

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button onClick={() => go(0)} style={ghostBtn}>Back</button>
                  <button onClick={() => go(2)} disabled={name.trim().length < 2} style={{ ...primaryBtn(name.trim().length < 2), flex: 1 }}>
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* ─── STEP 2 — Fund ─── */}
            {step === 2 && (
              <div>
                <div style={stepLabel}>Step 3 of 5</div>
                <h1 className="ob-h1" style={heading}>Fund your card</h1>
                <p style={{ ...sub, margin: '0 0 22px' }}>
                  Add USDC once. It sits as your balance and draws down per use — down to a hundredth of a cent.
                </p>

                {/* Method toggle */}
                <div style={{ display: 'flex', gap: 8, padding: 5, background: '#E7EDF5', borderRadius: 13, marginBottom: 20 }}>
                  {(['deposit', 'ramp'] as Method[]).map((m) => {
                    const active = method === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setMethod(m)}
                        style={{ flex: 1, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, border: 'none', borderRadius: 9, cursor: 'pointer', padding: 11, transition: 'all .25s', background: active ? '#fff' : 'transparent', color: active ? '#0B1B33' : '#5B6B82', boxShadow: active ? '0 2px 8px rgba(15,45,82,0.12)' : 'none' }}
                      >
                        {m === 'deposit' ? 'Deposit USDC' : 'Pay with card'}
                      </button>
                    );
                  })}
                </div>

                {/* Amount chips */}
                <label style={labelStyle}>Amount</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, marginTop: 8 }}>
                  {AMOUNT_CHIPS.map(({ v, label }) => {
                    const sel = amt === v;
                    return (
                      <button
                        key={v}
                        onClick={() => setAmount(String(v))}
                        style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, borderRadius: 11, cursor: 'pointer', padding: '13px 0', transition: 'all .2s', background: sel ? '#EAF2FC' : '#fff', color: sel ? '#1B5FA8' : '#42546E', border: `1.5px solid ${sel ? '#2775CA' : 'rgba(11,27,51,0.13)'}` }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom input */}
                <div style={{ position: 'relative', marginTop: 10 }}>
                  <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700, color: '#8194AC' }}>$</span>
                  <input
                    className="ob-fld"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    inputMode="decimal"
                    placeholder="Custom amount"
                    style={{ ...inputBase, marginTop: 0, paddingLeft: 30, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, fontSize: 16 }}
                  />
                </div>

                {/* Method info panels */}
                {method === 'deposit' && (
                  <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 12, background: '#0B1B33', color: '#cdd9e8' }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, letterSpacing: '0.12em', color: '#6f86a3' }}>SEND USDC (ARC) TO</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 7 }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#fff', wordBreak: 'break-all' }}>0xA1c…7F2b</span>
                      <span
                        onClick={() => navigator.clipboard.writeText('0xA1c7F2b')}
                        style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: '#6cb0f5', background: 'rgba(39,117,202,0.2)', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Copy
                      </span>
                    </div>
                  </div>
                )}
                {method === 'ramp' && (
                  <div style={{ marginTop: 16, padding: '13px 15px', borderRadius: 12, background: '#EAF2FC', border: '1px solid rgba(39,117,202,0.18)', fontSize: 13, color: '#1B5FA8', lineHeight: 1.45 }}>
                    Your debit card is converted to USDC instantly. <b>Coming soon</b> — we'll preview it with a demo balance.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button onClick={() => go(1)} style={ghostBtn}>Back</button>
                  <button onClick={() => go(3)} disabled={!amt} style={{ ...primaryBtn(!amt), flex: 1 }}>
                    Fund &amp; create card →
                  </button>
                </div>
              </div>
            )}

            {/* ─── STEP 3 — Reveal ─── */}
            {step === 3 && (
              <div style={{ textAlign: 'center', animation: 'xp-in .6s ease both' }}>
                <div style={stepLabel}>Step 4 of 5</div>
                <h1 className="ob-h1" style={{ ...heading, fontSize: 36, lineHeight: 1.08, margin: '12px 0 8px' }}>Your card is live.</h1>
                <p style={{ fontSize: 16, color: '#5B6B82', lineHeight: 1.5, margin: '0 auto 28px', maxWidth: 380 }}>
                  ${cardBalance} USDC is loaded and ready. Flip it over, or keep going.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11, alignItems: 'center' }}>
                  <button
                    onClick={() => setFlipped(f => !f)}
                    style={{ fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600, color: '#0B1B33', background: '#fff', border: '1.5px solid rgba(11,27,51,0.15)', borderRadius: 12, cursor: 'pointer', padding: '13px 24px', transition: 'border-color .2s, transform .2s' }}
                  >
                    ↻ Flip the card
                  </button>
                  <button onClick={() => go(4)} style={{ ...primaryBtn(false), padding: '15px 30px' }}>
                    Finish setup →
                  </button>
                </div>
              </div>
            )}

            {/* ─── STEP 4 — Done ─── */}
            {step === 4 && (
              <div style={{ animation: 'xp-in .6s ease both' }}>
                <div style={{ width: 58, height: 58, borderRadius: 16, background: 'linear-gradient(135deg,#3ddc97,#1B7A4B)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 30px rgba(27,122,75,0.34)' }}>
                  <span style={{ fontSize: 30, color: '#fff', lineHeight: 1 }}>✓</span>
                </div>

                <h1 className="ob-h1" style={{ ...heading, margin: '20px 0 6px' }}>You&apos;re all set, {firstName}.</h1>
                <p style={sub}>
                  Your XanCard is funded with <b style={{ color: '#0B1B33' }}>${cardBalance} USDC</b>. Link it to a platform and you&apos;ll only ever pay for exactly what you use.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <button style={{ fontFamily: 'inherit', fontSize: 15.5, fontWeight: 700, color: '#fff', background: '#2775CA', border: 'none', borderRadius: 12, cursor: 'pointer', padding: 15, boxShadow: '0 10px 26px rgba(39,117,202,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'transform .2s' }}>
                    <span>Link your first platform</span><span>→</span>
                  </button>
                  <button style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: '#0B1B33', background: '#fff', border: '1.5px solid rgba(11,27,51,0.15)', borderRadius: 12, cursor: 'pointer', padding: 14, transition: 'border-color .2s' }}>
                    Go to dashboard
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 18, marginTop: 30, paddingTop: 22, borderTop: '1px solid rgba(11,27,51,0.08)' }}>
                  {[
                    { v: `$${cardBalance}`, k: 'card balance' },
                    { v: '$0.0001',         k: 'min charge' },
                    { v: '0 gas',           k: 'per charge' },
                  ].map(({ v, k }) => (
                    <div key={k}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 19, fontWeight: 700, color: '#0B1B33' }}>{v}</div>
                      <div style={{ fontSize: 12, color: '#8194AC', marginTop: 2 }}>{k}</div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => { setStep(0); setEmail(''); setName(''); setAmount(''); setMethod('deposit'); setFlipped(false); }}
                  style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: '#8194AC', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: 22, padding: 0 }}
                >
                  ↻ Replay onboarding
                </button>
              </div>
            )}

          </div>{/* /body */}
        </div>{/* /panel */}
      </div>{/* /grid */}
    </div>
  );
}
