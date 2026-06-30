'use client';

import { useState, useEffect, useRef } from 'react';

interface Tilt {
  x: number;
  y: number;
}

export default function LandingPage() {
  const [tilt, setTilt] = useState<Tilt>({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('xp-revealed');
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.xp-reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const onCardMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: y * -22, y: x * 22 });
  };

  const onCardLeave = () => setTilt({ x: 0, y: 0 });

  const copyCode = async () => {
    await navigator.clipboard.writeText(
      `app.use(xanpay.charge('/v1/infer', { price: '$0.0008' }))`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parallaxStyle = {
    transform: `translateY(${scrollY * 0.25}px)`,
  };

  return (
    <div className="bg-[#F4F7FB] text-[#0B1B33] font-sans overflow-x-hidden">
      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 top-0 z-50 bg-[#F4F7FB]/90 backdrop-blur-md border-b border-[#0B1B33]/[0.08]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-xl font-bold tracking-tight select-none">
            Xan<span className="text-[#2775CA]">Pay</span>
          </a>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#0B1B33]/60">
            <a href="#how-it-works" className="hover:text-[#2775CA] transition-colors">How it works</a>
            <a href="#developers"   className="hover:text-[#2775CA] transition-colors">For developers</a>
            <a href="#pricing"      className="hover:text-[#2775CA] transition-colors">Pricing</a>
            <a href="#"             className="hover:text-[#2775CA] transition-colors">Docs</a>
          </div>

          <div className="flex items-center gap-3">
            <a href="#" className="text-sm font-medium text-[#0B1B33]/60 hover:text-[#0B1B33] transition-colors hidden sm:block">
              Sign in
            </a>
            <a href="#" className="bg-[#2775CA] text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-[#1d5fa8] transition-all hover:shadow-lg hover:shadow-[#2775CA]/30">
              Get a XanCard
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-16">
        {/* Ambient blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={parallaxStyle}>
          <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-[#2775CA]/[0.12] rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#2775CA]/[0.07] rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-6 py-28 grid md:grid-cols-2 gap-16 items-center relative">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#2775CA]/10 text-[#2775CA] text-xs font-semibold px-3 py-1.5 rounded-full mb-7">
              <span
                className="w-1.5 h-1.5 bg-[#2775CA] rounded-full"
                style={{ animation: 'xp-pulse 2s ease-in-out infinite' }}
              />
              Powered by USDC on Base
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-[1.08] tracking-tight text-[#0B1B33] mb-6">
              One card.<br />
              <span className="text-[#2775CA]">Charged by the</span><br />
              millisecond.
            </h1>

            <p className="text-lg text-[#0B1B33]/55 mb-9 leading-relaxed max-w-md">
              XanPay lets you spend and earn in fractions of a cent — perfect for
              AI APIs, streaming services, and any usage-based product.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href="#" className="bg-[#2775CA] text-white font-semibold px-6 py-3.5 rounded-full hover:bg-[#1d5fa8] transition-all hover:shadow-xl hover:shadow-[#2775CA]/35 text-center">
                Get your XanCard
              </a>
              <a href="#how-it-works" className="border border-[#0B1B33]/[0.18] text-[#0B1B33] font-semibold px-6 py-3.5 rounded-full hover:bg-[#0B1B33]/5 transition-colors text-center">
                See how it works
              </a>
            </div>

            {/* Trust strip */}
            <div className="mt-12 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#0B1B33]/35 font-medium mr-1">Built with</span>
              {['Circle', 'USDC', 'x402', 'Arc'].map((p) => (
                <span key={p} className="text-xs font-semibold px-3 py-1.5 bg-white border border-[#0B1B33]/10 rounded-full text-[#0B1B33]/50 shadow-sm">
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* 3D Card */}
          <div className="relative flex items-center justify-center">
            <div className="relative" style={{ perspective: '1200px' }}>
              {/* Floating charge bubbles */}
              <Bubble
                label="-$0.0008"
                dot="bg-emerald-400"
                style={{ top: '-2rem', right: '-2rem', animation: 'xp-float 3s ease-in-out infinite' }}
              />
              <Bubble
                label="-$0.0012"
                dot="bg-blue-400"
                style={{ bottom: '-1.5rem', left: '-2rem', animation: 'xp-float 3.5s ease-in-out infinite 0.6s' }}
              />
              <Bubble
                label="-$0.0003"
                dot="bg-violet-400"
                style={{ top: '50%', right: '-3rem', transform: 'translateY(-50%)', animation: 'xp-float 4s ease-in-out infinite 1.2s' }}
              />

              {/* Card face */}
              <div
                className="w-72 h-44 rounded-[1.4rem] cursor-pointer select-none"
                onMouseMove={onCardMove}
                onMouseLeave={onCardLeave}
              >
                <div
                  className="w-full h-full rounded-[1.4rem] relative overflow-hidden shadow-2xl shadow-[#0B1B33]/40"
                  style={{
                    background: 'linear-gradient(135deg, #0B1B33 0%, #163058 55%, #2775CA 100%)',
                    transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                    transition: 'transform 0.12s ease-out',
                  }}
                >
                  {/* Sheen sweep */}
                  <div className="absolute inset-0 overflow-hidden rounded-[1.4rem] pointer-events-none">
                    <div
                      className="absolute top-0 bottom-0 w-14 -skew-x-12"
                      style={{
                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.28), transparent)',
                        animation: 'xp-sheen 4s ease-in-out infinite 0.5s',
                      }}
                    />
                  </div>

                  {/* Card content */}
                  <div className="absolute inset-0 p-6 flex flex-col justify-between text-white">
                    <div className="flex justify-between items-start">
                      <span className="text-lg font-bold tracking-tight">XanPay</span>
                      <span className="text-[10px] font-mono opacity-60 bg-white/10 px-2 py-0.5 rounded-full">USDC</span>
                    </div>

                    {/* EMV chip */}
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 w-8 h-6 rounded-sm bg-gradient-to-br from-yellow-300/80 to-yellow-400/60 opacity-70" />

                    <div>
                      <div className="text-sm font-mono opacity-40 mb-1 tracking-widest">•••• •••• •••• 4291</div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-50">XanCard Holder</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Glow beneath card */}
              <div className="absolute inset-x-8 bottom-0 h-8 bg-[#2775CA]/30 blur-2xl rounded-full -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 xp-reveal">
            <h2 className="text-4xl font-bold text-[#0B1B33] mb-3">How it works</h2>
            <p className="text-[#0B1B33]/55 text-lg">Simple for users. Powerful for developers.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Users panel */}
            <div className="bg-[#F4F7FB] rounded-3xl p-8 xp-reveal">
              <div className="text-[10px] font-bold text-[#2775CA] uppercase tracking-[0.15em] mb-7">For users</div>
              <div className="space-y-7">
                {[
                  { n: '01', title: 'Sign up',       desc: 'Create your account in seconds — just an email.' },
                  { n: '02', title: 'Fund your card', desc: 'Deposit USDC to your XanCard. No bank account needed.' },
                  { n: '03', title: 'Link & pay',     desc: 'Connect to any XanPay-enabled service and pay by the millisecond.' },
                ].map((s) => (
                  <div key={s.n} className="flex gap-4">
                    <span className="text-[10px] font-mono font-bold text-[#2775CA]/40 w-6 shrink-0 pt-0.5">{s.n}</span>
                    <div>
                      <div className="font-semibold text-[#0B1B33] mb-1">{s.title}</div>
                      <div className="text-sm text-[#0B1B33]/55 leading-relaxed">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Developers panel */}
            <div id="developers" className="bg-[#0B1B33] rounded-3xl p-8 xp-reveal">
              <div className="text-[10px] font-bold text-[#2775CA] uppercase tracking-[0.15em] mb-7">For developers</div>
              <div className="space-y-7">
                {[
                  { n: '01', title: 'Install SDK',     desc: 'npm install @xanpay/sdk — one command to get started.' },
                  { n: '02', title: 'Protect a route', desc: 'Wrap any endpoint with xanpay.charge() and set your price.' },
                  { n: '03', title: 'Earn per call',   desc: 'Receive USDC for every request — automatically, in real time.' },
                ].map((s) => (
                  <div key={s.n} className="flex gap-4">
                    <span className="text-[10px] font-mono font-bold text-[#2775CA]/50 w-6 shrink-0 pt-0.5">{s.n}</span>
                    <div>
                      <div className="font-semibold text-white mb-1">{s.title}</div>
                      <div className="text-sm text-white/45 leading-relaxed">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Use cases / Pricing ──────────────────────────────────────── */}
      <section id="pricing" className="py-28 bg-[#F4F7FB]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 xp-reveal">
            <h2 className="text-4xl font-bold text-[#0B1B33] mb-3">Pay only for what you use</h2>
            <p className="text-[#0B1B33]/55 text-lg">Micro-payments that make sense at scale.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                price: '$0.0008', unit: '/action',
                title: 'Pay per action',
                desc: 'Every click, search, or API call billed exactly as it happens.',
              },
              {
                price: '$0.0012', unit: '/run',
                title: 'Pay per inference',
                desc: 'AI model calls charged per inference — no monthly seats required.',
              },
              {
                price: '$0.0003', unit: '/sec',
                title: 'Pay per second',
                desc: 'Stream video, audio, or data and pay only for what you consume.',
              },
            ].map((c, i) => (
              <div
                key={i}
                className="bg-white rounded-3xl p-8 border border-[#0B1B33]/[0.06] hover:border-[#2775CA]/30 hover:shadow-2xl hover:shadow-[#2775CA]/10 transition-all duration-300 xp-reveal group"
              >
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-3xl font-bold font-mono text-[#0B1B33] group-hover:text-[#2775CA] transition-colors">{c.price}</span>
                  <span className="text-sm text-[#0B1B33]/35 font-mono">{c.unit}</span>
                </div>
                <div className="font-semibold text-[#0B1B33] mb-2">{c.title}</div>
                <div className="text-sm text-[#0B1B33]/55 leading-relaxed">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Code block ───────────────────────────────────────────────── */}
      <section className="py-28 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-xl mx-auto xp-reveal">
            <div className="text-[10px] font-bold text-[#2775CA] uppercase tracking-[0.15em] mb-4">Developer SDK</div>
            <h2 className="text-3xl font-bold text-[#0B1B33] mb-3">Three lines of code.</h2>
            <p className="text-[#0B1B33]/55 mb-8 leading-relaxed">
              Add micro-payments to any Node.js API in minutes. No subscriptions, no billing logic.
            </p>

            <div className="bg-[#0B1B33] rounded-2xl p-6 relative">
              <button
                onClick={copyCode}
                className="absolute top-4 right-4 text-xs text-white/40 hover:text-white/80 transition-colors bg-white/[0.06] hover:bg-white/[0.12] px-2.5 py-1 rounded-md font-medium"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>

              <pre className="text-sm leading-7 overflow-x-auto">
                <code className="font-mono">
                  <span className="text-white/35">{`// npm install @xanpay/sdk`}</span>{'\n'}
                  <span className="text-white/35">{`// Protect any route:`}</span>{'\n'}
                  <span className="text-[#2775CA]">app</span>
                  <span className="text-white/80">.use(</span>
                  <span className="text-emerald-400">xanpay</span>
                  <span className="text-white/80">.charge(</span>
                  <span className="text-amber-300">{`'/v1/infer'`}</span>
                  <span className="text-white/80">{`, { `}</span>
                  <span className="text-orange-300">price</span>
                  <span className="text-white/80">{`: `}</span>
                  <span className="text-amber-300">{`'$0.0008'`}</span>
                  <span className="text-white/80">{` }))`}</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────── */}
      <section className="py-28 bg-[#0B1B33] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] bg-[#2775CA]/[0.18] rounded-full blur-[6rem]" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[#2775CA]/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto px-6 text-center relative xp-reveal">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Start charging by the<br />
            <span className="text-[#2775CA]">millisecond</span> today.
          </h2>
          <p className="text-white/50 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Join developers and users building the next generation of usage-based payments.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#" className="bg-[#2775CA] text-white font-semibold px-8 py-4 rounded-full hover:bg-[#1d5fa8] transition-all hover:shadow-xl hover:shadow-[#2775CA]/40">
              Get your XanCard
            </a>
            <a href="#" className="border border-white/20 text-white font-semibold px-8 py-4 rounded-full hover:bg-white/10 transition-colors">
              Read the docs
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="bg-[#0B1B33] border-t border-white/[0.08] py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10">
            <div>
              <div className="text-xl font-bold text-white mb-2">
                Xan<span className="text-[#2775CA]">Pay</span>
              </div>
              <div className="text-sm text-white/35">Charged by the millisecond.</div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 text-sm">
              {[
                { heading: 'Product',    links: ['How it works', 'Pricing', 'XanCard'] },
                { heading: 'Developers', links: ['Docs', 'SDK', 'API Reference'] },
                { heading: 'Company',    links: ['Blog', 'Twitter', 'GitHub'] },
              ].map((col) => (
                <div key={col.heading}>
                  <div className="text-white/55 font-semibold mb-4">{col.heading}</div>
                  <div className="space-y-2.5">
                    {col.links.map((l) => (
                      <a key={l} href="#" className="block text-white/35 hover:text-white/65 transition-colors">
                        {l}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/[0.08] mt-12 pt-6 text-xs text-white/25 text-center">
            © 2025 XanPay. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Bubble ─────────────────────────────────────────────────────────── */
function Bubble({
  label,
  dot,
  style,
}: {
  label: string;
  dot: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="absolute bg-white/95 shadow-lg shadow-black/10 rounded-2xl px-3 py-2 flex items-center gap-2 text-xs font-mono font-semibold text-[#0B1B33] z-10 border border-white/60"
      style={style}
    >
      <span className={`w-2 h-2 ${dot} rounded-full`} />
      {label}
    </div>
  );
}
