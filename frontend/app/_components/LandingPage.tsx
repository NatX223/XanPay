'use client';

import { useState, useEffect, useRef } from 'react';

/* ─────────────────────────────────────────────────────────────────
   Shared sub-components
───────────────────────────────────────────────────────────────── */
function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.31,
      background: 'linear-gradient(135deg,#2775CA,#1B5FA8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 14px rgba(39,117,202,0.35)', flexShrink: 0,
    }}>
      <div style={{ width: size * 0.42, height: size * 0.42, borderRadius: size * 0.12, background: '#fff', opacity: 0.92 }} />
    </div>
  );
}

function HowSteps({ steps, dark }: { steps: { n: string; title: string; desc: string }[]; dark: boolean }) {
  const numBg    = dark ? 'rgba(39,117,202,0.18)' : '#EAF2FC';
  const numBd    = dark ? '1px solid rgba(39,117,202,0.35)' : '1px solid rgba(39,117,202,0.18)';
  const numColor = dark ? '#6cb0f5' : '#2775CA';
  const titleC   = dark ? '#fff'    : '#0B1B33';
  const descC    = dark ? '#9fb3cc' : '#5B6B82';
  const arrowC   = dark ? 'rgba(255,255,255,0.28)' : '#C2D2E6';

  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: 'flex', alignItems: 'stretch', flex: i < steps.length - 1 ? 1 : undefined }}>
          <div style={{ flex: 1 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: numBg, border: numBd, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 15, color: numColor }}>
              {s.n}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 14, color: titleC }}>{s.title}</div>
            <div style={{ fontSize: 13.5, color: descC, lineHeight: 1.5, marginTop: 4 }}>{s.desc}</div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: arrowC, fontSize: 22, paddingBottom: 30 }}>→</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Landing page
───────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [copied, setCopied] = useState(false);

  const motionRef  = useRef<HTMLDivElement>(null);
  const cardRef    = useRef<HTMLDivElement>(null);
  const gridRef    = useRef<HTMLDivElement>(null);
  const glowRef    = useRef<HTMLDivElement>(null);
  const ctaGlowRef = useRef<HTMLDivElement>(null);

  /* ── Scroll-reveal ── */
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('xp-revealed'); }),
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' },
    );
    document.querySelectorAll('.xp-reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* ── RAF: card bob/tilt + parallax ── */
  useEffect(() => {
    let raf: number;
    let scrollTarget = window.scrollY;
    let scrollCur    = scrollTarget;
    const t0 = performance.now();
    const bases = new Map<HTMLElement, number>();
    const getBase = (el: HTMLElement) => {
      if (!bases.has(el)) bases.set(el, el.getBoundingClientRect().top + window.scrollY);
      return bases.get(el)!;
    };

    const onScroll = () => { scrollTarget = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });

    const loop = (t: number) => {
      scrollCur += (scrollTarget - scrollCur) * 0.12;
      const now = t - t0;
      const mid = scrollCur + window.innerHeight / 2;

      if (gridRef.current)    gridRef.current.style.transform    = `translate3d(0,${((getBase(gridRef.current)    - mid) *  0.05).toFixed(2)}px,0)`;
      if (glowRef.current)    glowRef.current.style.transform    = `translate3d(0,${((getBase(glowRef.current)    - mid) * -0.13).toFixed(2)}px,0)`;
      if (ctaGlowRef.current) ctaGlowRef.current.style.transform = `translate3d(0,${((getBase(ctaGlowRef.current) - mid) *  0.07).toFixed(2)}px,0)`;

      if (motionRef.current) {
        const bob   = Math.sin(now / 950) * 7;
        const drift = -scrollCur * 0.06;
        const tilt  = Math.max(-9, -scrollCur * 0.013);
        motionRef.current.style.transform = `translateY(${(bob + drift).toFixed(2)}px) rotateX(${tilt.toFixed(2)}deg)`;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); };
  }, []);

  /* ── Card mouse-tilt ── */
  const onCardMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current; if (!el) return;
    const r  = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width  - 0.5;
    const py = (e.clientY - r.top)  / r.height - 0.5;
    el.style.transform = `rotateY(${(px * 18 - 4).toFixed(2)}deg) rotateX(${(-py * 16 + 3).toFixed(2)}deg)`;
  };
  const onCardLeave = () => {
    if (cardRef.current) cardRef.current.style.transform = 'rotateY(-13deg) rotateX(7deg)';
  };

  /* ── Copy code ── */
  const copyCode = () => {
    const code = `import { xanpay } from '@xanpay/sdk'\n\napp.post('/v1/infer', xanpay.protect({ price: '$0.0008' }), handler)`;
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", background: '#F4F7FB', color: '#0B1B33', WebkitFontSmoothing: 'antialiased', overflowX: 'hidden' }}>

      {/* ══ NAV ═════════════════════════════════════════════════════ */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 40px', background: 'rgba(244,247,251,0.72)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(11,27,51,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <LogoMark size={26} />
          <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em' }}>XanPay</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 14.5, fontWeight: 500, color: '#42546E' }}>
            {[
              { label: 'How it works', href: '#' },
              { label: 'For developers', href: '/developers/onboarding' },
              { label: 'Pricing', href: '#' },
              { label: 'Docs', href: '#' },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer', transition: 'color .15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#2775CA')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#42546E')}
              >{label}</a>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#0B1B33', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 6px' }}>Sign in</button>
            <button style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#fff', background: '#0B1B33', border: 'none', borderRadius: 10, cursor: 'pointer', padding: '10px 18px' }}>Get a XanCard</button>
          </div>
        </div>
      </nav>

      {/* ══ HERO ════════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', padding: '72px 40px 40px', overflow: 'hidden' }}>
        {/* Grid pattern */}
        <div ref={gridRef} style={{ position: 'absolute', inset: '-80px 0 0', backgroundImage: 'linear-gradient(rgba(39,117,202,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(39,117,202,0.05) 1px,transparent 1px)', backgroundSize: '46px 46px', WebkitMaskImage: 'radial-gradient(circle at 70% 35%,#000 0%,transparent 70%)', maskImage: 'radial-gradient(circle at 70% 35%,#000 0%,transparent 70%)', pointerEvents: 'none', willChange: 'transform' }} />
        {/* Glow blob */}
        <div ref={glowRef} style={{ position: 'absolute', top: -120, right: '6%', width: 620, height: 620, borderRadius: '50%', background: 'radial-gradient(circle,rgba(39,117,202,0.22),transparent 65%)', filter: 'blur(20px)', pointerEvents: 'none', willChange: 'transform' }} />

        <div style={{ position: 'relative', maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.02fr 1fr', gap: 48, alignItems: 'center' }}>

          {/* ── Copy ── */}
          <div className="xp-reveal">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderRadius: 999, background: '#fff', border: '1px solid rgba(39,117,202,0.2)', fontSize: 13, fontWeight: 600, color: '#1B5FA8', boxShadow: '0 2px 10px rgba(39,117,202,0.06)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2775CA', display: 'inline-block', animation: 'xp-pulse 1.8s infinite' }} />
              Real-time nanopayments, settled in USDC
            </div>

            <h1 style={{ fontSize: 62, lineHeight: 1.02, letterSpacing: '-0.035em', fontWeight: 800, margin: '24px 0 0' }}>
              Payments.<br />Charged by the<br /><span style={{ color: '#2775CA' }}>millicents.</span>
            </h1>

            <p style={{ fontSize: 19, lineHeight: 1.55, color: '#42546E', maxWidth: 480, margin: '22px 0 0', fontWeight: 400 }}>
              XanPay is a unified virtual card built for granular billing. Link it to your favorite platforms to authorize micro-charging in real time—whether you are pulling an API call, reading a single article, or running a machine learning model. You only pay for the exact value you extract.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 34 }}>
              <button
                style={{ fontFamily: 'inherit', fontSize: 15.5, fontWeight: 700, color: '#fff', background: '#2775CA', border: 'none', borderRadius: 12, cursor: 'pointer', padding: '15px 26px', boxShadow: '0 10px 26px rgba(39,117,202,0.34)', display: 'flex', alignItems: 'center', gap: 8, transition: 'transform .2s ease,box-shadow .2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 34px rgba(39,117,202,0.46)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 10px 26px rgba(39,117,202,0.34)'; }}
              >
                Create your XanCard <span style={{ fontSize: 17, lineHeight: 1 }}>→</span>
              </button>
              <button
                style={{ fontFamily: 'inherit', fontSize: 15.5, fontWeight: 600, color: '#0B1B33', background: 'transparent', border: '1.5px solid rgba(11,27,51,0.18)', borderRadius: 12, cursor: 'pointer', padding: '15px 24px', transition: 'transform .2s ease,border-color .2s ease,background .2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#2775CA'; e.currentTarget.style.background = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(11,27,51,0.18)'; e.currentTarget.style.background = 'transparent'; }}
              >
                Start charging — for developers
              </button>
            </div>

            {/* Trust strip */}
            <div style={{ marginTop: 46 }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8194AC', marginBottom: 14 }}>Built on real infrastructure</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#56657D', letterSpacing: '-0.01em' }}>Circle</span>
                <span style={{ width: 1, height: 16, background: 'rgba(11,27,51,0.12)', display: 'inline-block' }} />
                <span style={{ fontWeight: 700, fontSize: 16, color: '#56657D', letterSpacing: '-0.01em' }}>Arc</span>
                <span style={{ width: 1, height: 16, background: 'rgba(11,27,51,0.12)', display: 'inline-block' }} />
                <span style={{ fontWeight: 700, fontSize: 16, color: '#56657D', letterSpacing: '-0.01em' }}>USDC</span>
                <span style={{ width: 1, height: 16, background: 'rgba(11,27,51,0.12)', display: 'inline-block' }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, fontSize: 13, color: '#56657D', border: '1px solid rgba(11,27,51,0.14)', borderRadius: 6, padding: '4px 9px' }}>x402</span>
              </div>
            </div>
          </div>

          {/* ── Card ── */}
          <div className="xp-reveal" style={{ perspective: 1400, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            {/* Floating micro-charges */}
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: 500, height: 340, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 5 }}>
              {[
                { label: '− $0.0008 · api call',  pos: { left: '-4%', top: '6%'  }, delay: '0s'   },
                { label: '− $0.0012 · inference', pos: { right: '-3%', top: '33%' }, delay: '1.6s' },
                { label: '− $0.0003 · 1s stream', pos: { left: '3%',  top: '80%' }, delay: '3.2s' },
              ].map(({ label, pos, delay }) => (
                <div key={label} style={{ position: 'absolute', ...pos, fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 700, color: '#1B5FA8', background: 'rgba(255,255,255,0.94)', border: '1px solid rgba(39,117,202,0.28)', borderRadius: 999, padding: '5px 11px', boxShadow: '0 8px 20px rgba(15,45,82,0.14)', whiteSpace: 'nowrap', opacity: 0, animation: `xp-rise 4.8s ${delay} ease-in-out infinite` }}>
                  {label}
                </div>
              ))}
            </div>

            {/* motionRef: idle bob + scroll drift */}
            <div ref={motionRef} style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}>
              {/* cardRef: mouse tilt */}
              <div
                ref={cardRef}
                onMouseMove={onCardMove}
                onMouseLeave={onCardLeave}
                style={{ position: 'relative', width: 420, height: 262, borderRadius: 24, transform: 'rotateY(-13deg) rotateX(7deg)', transformStyle: 'preserve-3d', transition: 'transform 0.25s cubic-bezier(.2,.7,.3,1)', cursor: 'pointer', willChange: 'transform' }}
              >
                {/* Glow behind */}
                <div style={{ position: 'absolute', inset: -14, borderRadius: 30, background: 'radial-gradient(circle at 30% 30%,rgba(39,117,202,0.55),transparent 70%)', filter: 'blur(26px)', zIndex: -1, animation: 'xp-pulse 4s infinite' }} />

                {/* Glass face */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: 24, background: 'linear-gradient(140deg,rgba(255,255,255,0.62),rgba(214,232,250,0.32) 48%,rgba(39,117,202,0.22))', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 30px 70px rgba(15,45,82,0.32),inset 0 1px 1px rgba(255,255,255,0.9)', overflow: 'hidden' }}>
                  {/* Sheen */}
                  <div style={{ position: 'absolute', top: '-40%', left: 0, width: '55%', height: '180%', background: 'linear-gradient(105deg,transparent,rgba(255,255,255,0.55),transparent)', animation: 'xp-sheen 5.5s ease-in-out infinite', pointerEvents: 'none' }} />

                  {/* USDC badge */}
                  <div style={{ position: 'absolute', right: 26, top: 24, width: 46, height: 46, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%,#3a8ce0,#2775CA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 22px rgba(39,117,202,0.7),inset 0 1px 2px rgba(255,255,255,0.6)' }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 18, color: '#fff' }}>$</span>
                  </div>

                  <div style={{ position: 'relative', padding: '26px 28px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 18, height: 18, borderRadius: 5, background: 'linear-gradient(135deg,#2775CA,#1B5FA8)' }} />
                        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: '#0B1B33' }}>XanCard</span>
                      </div>
                      {/* EMV chip */}
                      <div style={{ width: 42, height: 31, borderRadius: 7, marginTop: 22, background: 'linear-gradient(135deg,#d9b24a,#f1d98a 45%,#c79a35)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 6, border: '1px solid rgba(120,90,20,0.35)', borderRadius: 3 }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.12em', color: '#3a5074', opacity: 0.72 }}>CARD ID</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, fontSize: 18, letterSpacing: '0.06em', color: '#0B1B33', marginTop: 3 }}>•••• •••• •••• 4820</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.12em', color: '#3a5074', opacity: 0.72 }}>BALANCE</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', color: '#0B1B33', marginTop: 2 }}>
                          $1,284.00 <span style={{ fontSize: 13, color: '#2775CA' }}>USDC</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, lineHeight: 1.5, color: '#3a5074' }}>
                        <div style={{ fontWeight: 600, color: '#1B5FA8' }}>ARC</div>
                        <div style={{ opacity: 0.7 }}>via Circle</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════════════ */}
      <section style={{ padding: '78px 40px 0' }}>
        <div className="xp-reveal" style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2775CA', fontWeight: 600 }}>How it works</div>
          <h2 style={{ fontSize: 42, lineHeight: 1.08, letterSpacing: '-0.03em', fontWeight: 800, margin: '14px 0 0' }}>Link your card. Get charged in real time.</h2>
          <p style={{ fontSize: 17.5, color: '#42546E', lineHeight: 1.55, margin: '16px auto 0', maxWidth: 560 }}>Two sides of the same standard — users fund a card, developers charge it. Circle batches and settles the rest in USDC.</p>
        </div>

        <div style={{ maxWidth: 1180, margin: '48px auto 0', display: 'flex', flexDirection: 'column', gap: 26 }}>
          {/* Users */}
          <div className="xp-reveal" style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 24, padding: '38px 40px', boxShadow: '0 18px 46px rgba(15,45,82,0.08)', display: 'grid', gridTemplateColumns: '286px 1fr', gap: 46, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px', borderRadius: 999, background: '#EAF2FC', color: '#1B5FA8', fontSize: 13, fontWeight: 700 }}>For users</div>
              <h3 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: '16px 0 6px' }}>Get a card. Spend like one.</h3>
              <p style={{ fontSize: 14.5, color: '#5B6B82', margin: 0, lineHeight: 1.55 }}>Deposit USDC once. Circle MPC holds the keys — you never touch a wallet.</p>
            </div>
            <HowSteps dark={false} steps={[
              { n: '01', title: 'Sign up',             desc: "Email and you're in. No exchange, no extension." },
              { n: '02', title: 'Fund your card',       desc: 'Deposit USDC once, secured by Circle MPC.' },
              { n: '03', title: 'Link to a platform',   desc: 'Connect the card and pay only for what you use.' },
            ]} />
          </div>

          {/* Developers */}
          <div className="xp-reveal" style={{ background: '#0B1B33', borderRadius: 24, padding: '38px 40px', boxShadow: '0 18px 46px rgba(15,45,82,0.16)', position: 'relative', overflow: 'hidden', display: 'grid', gridTemplateColumns: '286px 1fr', gap: 46, alignItems: 'center' }}>
            <div style={{ position: 'absolute', top: -90, right: -50, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(39,117,202,0.32),transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px', borderRadius: 999, background: 'rgba(39,117,202,0.22)', color: '#9cc6f3', fontSize: 13, fontWeight: 700 }}>For developers</div>
              <h3 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: '16px 0 6px', color: '#fff' }}>Protect a route. Get paid per call.</h3>
              <p style={{ fontSize: 14.5, color: '#9fb3cc', margin: 0, lineHeight: 1.55 }}>Drop in the SDK. Settlements accumulate in USDC on Arc.</p>
            </div>
            <HowSteps dark={true} steps={[
              { n: '01', title: 'Install the SDK',  desc: 'One package. Works with Express, Next, or Hono.' },
              { n: '02', title: 'Protect a route',  desc: 'Wrap an endpoint with a price. One line.' },
              { n: '03', title: 'Earn per call',    desc: 'Charges settle to USDC on Arc, batched by Circle.' },
            ]} />
          </div>
        </div>
      </section>

      {/* ══ USE CASES ════════════════════════════════════════════════ */}
      <section style={{ padding: '88px 40px 0' }}>
        <div className="xp-reveal" style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2775CA', fontWeight: 600 }}>Use cases</div>
          <h2 style={{ fontSize: 42, lineHeight: 1.08, letterSpacing: '-0.03em', fontWeight: 800, margin: '14px 0 0' }}>Charge for exactly what&apos;s used</h2>
          <p style={{ fontSize: 17.5, color: '#42546E', lineHeight: 1.55, margin: '16px auto 0', maxWidth: 560 }}>Three ways to meter value — each settled in USDC and batched by Circle, viable down to a hundredth of a cent.</p>
        </div>

        <div style={{ maxWidth: 1180, margin: '48px auto 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {[
            { icon: 'fn()', price: '$0.0008 / action', title: 'Pay per action',    desc: "Bill a single API request, a database write, an automation run, or an agent's tool call — one signature each.",    tags: ['API platforms', 'Automation', 'AI agents'] },
            { icon: 'ai',   price: '$0.0012 / run',    title: 'Pay per inference', desc: 'Charge each model call — text, image, or audio. Costs track real usage instead of flat subscriptions.',            tags: ['AI assistants', 'Image generation', 'Transcription'] },
            { icon: '0:01', price: '$0.0003 / sec',    title: 'Pay per second',    desc: 'Meter time consumed — seconds watched, streamed, or computed. Charging stops the instant they do.',                tags: ['Video & music streaming', 'Live audio', 'Cloud compute'] },
          ].map((c) => (
            <div key={c.title} className="xp-reveal">
              <div
                style={{ height: '100%', background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 20, padding: '30px 28px', boxShadow: '0 12px 30px rgba(15,45,82,0.06)', transition: 'transform .26s cubic-bezier(.2,.7,.3,1),box-shadow .26s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-7px)'; e.currentTarget.style.boxShadow = '0 26px 52px rgba(15,45,82,0.14)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 12px 30px rgba(15,45,82,0.06)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 13, background: '#EAF2FC', border: '1px solid rgba(39,117,202,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 14, color: '#2775CA' }}>{c.icon}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 700, color: '#1B5FA8', background: '#EAF2FC', borderRadius: 999, padding: '6px 12px' }}>{c.price}</div>
                </div>
                <h3 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', margin: '22px 0 6px' }}>{c.title}</h3>
                <p style={{ fontSize: 14.5, color: '#5B6B82', lineHeight: 1.55, margin: '0 0 20px' }}>{c.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {c.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: 12.5, fontWeight: 600, color: '#42546E', background: '#F1F5FA', border: '1px solid rgba(11,27,51,0.07)', borderRadius: 8, padding: '5px 10px', whiteSpace: 'nowrap' }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ CODE BLOCK ══════════════════════════════════════════════ */}
      <section style={{ padding: '80px 40px 0' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '0.92fr 1.08fr', gap: 48, alignItems: 'center' }}>
          <div className="xp-reveal">
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2775CA', fontWeight: 600 }}>Three lines</div>
            <h2 style={{ fontSize: 38, lineHeight: 1.1, letterSpacing: '-0.03em', fontWeight: 800, margin: '14px 0 0' }}>Charge for usage<br />in real time.</h2>
            <p style={{ fontSize: 16.5, color: '#42546E', lineHeight: 1.55, margin: '18px 0 0', maxWidth: 420 }}>
              Wrap any route. Each request carries an{' '}
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14.5, color: '#1B5FA8', background: '#EAF2FC', padding: '1px 6px', borderRadius: 5 }}>EIP-3009</span>
              {' '}signature — an offchain authorization, not a transaction. Circle batches thousands and settles in bulk, so sub-cent charges finally pencil out.
            </p>
            <div style={{ display: 'flex', gap: 30, marginTop: 30 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 30, fontWeight: 700, color: '#0B1B33' }}>$0.0001</div>
                <div style={{ fontSize: 13.5, color: '#5B6B82', marginTop: 2 }}>minimum viable charge</div>
              </div>
              <div style={{ width: 1, background: 'rgba(11,27,51,0.1)' }} />
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 30, fontWeight: 700, color: '#0B1B33' }}>0&nbsp;gas</div>
                <div style={{ fontSize: 13.5, color: '#5B6B82', marginTop: 2 }}>per individual charge</div>
              </div>
            </div>
          </div>

          {/* Editor chrome */}
          <div className="xp-reveal" style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 70px rgba(15,45,82,0.28)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', background: '#0a1526', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#7e93ad', marginLeft: 10 }}>server.ts</span>
              </div>
              <button
                onClick={copyCode}
                style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, color: copied ? '#3ddc97' : '#9cc6f3', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', transition: 'color .2s' }}
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <pre style={{ margin: 0, padding: '24px 22px', background: '#0c1830', fontFamily: "'JetBrains Mono',monospace", fontSize: 14.5, lineHeight: 1.85, overflowX: 'auto' }}>
              <code>
                <span style={{ color: '#5d7a9e' }}>{'// install: npm i @xanpay/sdk'}</span>{'\n'}
                <span style={{ color: '#c792ea' }}>import</span>
                <span style={{ color: '#e6edf3' }}>{' { xanpay } '}</span>
                <span style={{ color: '#c792ea' }}>from</span>
                <span style={{ color: '#9ece6a' }}>{" '@xanpay/sdk'"}</span>
                {'\n\n'}
                <span style={{ color: '#7aa2f7' }}>app</span>
                <span style={{ color: '#e6edf3' }}>.</span>
                <span style={{ color: '#7dcfff' }}>post</span>
                <span style={{ color: '#e6edf3' }}>(</span>
                <span style={{ color: '#9ece6a' }}>{`'/v1/infer'`}</span>
                <span style={{ color: '#e6edf3' }}>{', '}</span>
                <span style={{ color: '#7aa2f7' }}>xanpay</span>
                <span style={{ color: '#e6edf3' }}>.</span>
                <span style={{ color: '#7dcfff' }}>protect</span>
                <span style={{ color: '#e6edf3' }}>{'({ '}</span>
                <span style={{ color: '#bb9af7' }}>price</span>
                <span style={{ color: '#e6edf3' }}>: </span>
                <span style={{ color: '#ff9e64' }}>{`'$0.0008'`}</span>
                <span style={{ color: '#e6edf3' }}>{' }), '}</span>
                <span style={{ color: '#7aa2f7' }}>handler</span>
                <span style={{ color: '#e6edf3' }}>)</span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ═══════════════════════════════════════════════ */}
      <section style={{ padding: '96px 40px 90px' }}>
        <div className="xp-reveal" style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', borderRadius: 28, background: 'linear-gradient(135deg,#0B1B33 0%,#11305a 100%)', padding: '64px 56px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)', backgroundSize: '42px 42px', WebkitMaskImage: 'radial-gradient(circle at 80% 50%,#000,transparent 75%)', maskImage: 'radial-gradient(circle at 80% 50%,#000,transparent 75%)' }} />
          <div ref={ctaGlowRef} style={{ position: 'absolute', top: -100, right: -40, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle,rgba(39,117,202,0.4),transparent 65%)', willChange: 'transform', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 40, lineHeight: 1.08, letterSpacing: '-0.03em', fontWeight: 800, color: '#fff', margin: 0, maxWidth: 540 }}>Spend by the millisecond.<br />Settle in USDC.</h2>
              <p style={{ fontSize: 17, color: '#9fb3cc', margin: '16px 0 0', maxWidth: 480, lineHeight: 1.5 }}>Whether you hold a XanCard or build the platforms that charge it — start in minutes.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, minWidth: 230 }}>
              <button
                style={{ fontFamily: 'inherit', fontSize: 15.5, fontWeight: 700, color: '#fff', background: '#2775CA', border: 'none', borderRadius: 12, cursor: 'pointer', padding: '16px 26px', boxShadow: '0 12px 30px rgba(39,117,202,0.4)', transition: 'transform .2s ease,box-shadow .2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 18px 40px rgba(39,117,202,0.5)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 12px 30px rgba(39,117,202,0.4)'; }}
              >Create your XanCard</button>
              <button
                style={{ fontFamily: 'inherit', fontSize: 15.5, fontWeight: 600, color: '#fff', background: 'transparent', border: '1.5px solid rgba(255,255,255,0.28)', borderRadius: 12, cursor: 'pointer', padding: '16px 26px', transition: 'transform .2s ease,border-color .2s ease,background .2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'; e.currentTarget.style.background = 'transparent'; }}
              >Start charging</button>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════ */}
      <footer style={{ borderTop: '1px solid rgba(11,27,51,0.08)', padding: '40px 40px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <LogoMark size={24} />
            <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>XanPay</span>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: '#8194AC' }}>
            Nanopayments on Circle Gateway &amp; Arc · Settled in USDC
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 14, color: '#56657D', fontWeight: 500 }}>
            {['Docs', 'Privacy', 'Status'].map((l) => (
              <a key={l} href="#" style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer', transition: 'color .15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#2775CA')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#56657D')}
              >{l}</a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}
