'use client';

import { useState } from 'react';

/* ─────────────────────────────────────────────────────────────────
   Types & fixtures
───────────────────────────────────────────────────────────────── */
interface Rules {
  monthly: number;
  perCharge: string;
  daily: string;
  velocity: string;
  autopause: boolean;
  approve: boolean;
  frozen: boolean;
  platforms: string[];
}
interface CardT {
  id: string;
  groupId: string;
  name: string;
  last4: string;
  balance: number;
  spent: number;
  rules: Rules;
}
interface GroupT {
  id: string;
  name: string;
  accent: string;
  glyph: string;
}
interface Draft {
  name: string;
  groupId: string;
  limit: number;
  accent: string;
}
interface GroupDraft {
  name: string;
  glyph: string;
  accent: string;
}

const GLYPH_COLORS = [
  { glyph: '◆', accent: '#2775CA' },
  { glyph: '✦', accent: '#14B8A6' },
  { glyph: '▶', accent: '#6366F1' },
  { glyph: '⚡', accent: '#E0801B' },
];
const ACCENTS = ['#2775CA', '#14B8A6', '#6366F1', '#E0801B'];
const LIMITS = [40, 80, 150, 300];

const NAV_ITEMS = [
  { label: 'Overview', glyph: '◉', active: true },
  { label: 'Cards', glyph: '■', active: false },
  { label: 'Activity', glyph: '≡', active: false },
  { label: 'Platforms', glyph: '⧉', active: false },
  { label: 'Settings', glyph: '⚙', active: false },
];

const INITIAL_GROUPS: GroupT[] = [
  { id: 'streaming', name: 'Streaming', accent: '#2775CA', glyph: '▶' },
  { id: 'ai', name: 'AI & Inference', accent: '#14B8A6', glyph: '✦' },
  { id: 'data', name: 'Data & APIs', accent: '#6366F1', glyph: '≡' },
];

const INITIAL_CARDS: CardT[] = [
  { id: 'c1', groupId: 'streaming', name: 'Video & Music', last4: '4820', balance: 124.50, spent: 38.20, rules: { monthly: 80, perCharge: '2.00', daily: '10.00', velocity: '25', autopause: true, approve: false, frozen: false, platforms: ['video-stream.io', 'audio-cast.fm'] } },
  { id: 'c2', groupId: 'streaming', name: 'Live Sports', last4: '1190', balance: 60.00, spent: 12.75, rules: { monthly: 40, perCharge: '1.50', daily: '8.00', velocity: '15', autopause: true, approve: false, frozen: false, platforms: ['live-sports.tv'] } },
  { id: 'c3', groupId: 'ai', name: 'AI Assistant', last4: '7731', balance: 300.00, spent: 184.60, rules: { monthly: 250, perCharge: '5.00', daily: '40.00', velocity: '50', autopause: false, approve: true, frozen: false, platforms: ['ai-inference.dev', 'vector-search.dev'] } },
  { id: 'c4', groupId: 'ai', name: 'Image Gen', last4: '2204', balance: 90.00, spent: 71.30, rules: { monthly: 75, perCharge: '3.00', daily: '15.00', velocity: '20', autopause: true, approve: false, frozen: true, platforms: ['render-farm.cloud'] } },
  { id: 'c5', groupId: 'data', name: 'Geo & Lookups', last4: '5567', balance: 48.00, spent: 9.10, rules: { monthly: 60, perCharge: '1.00', daily: '6.00', velocity: '40', autopause: false, approve: false, frozen: false, platforms: ['geo-lookup.api', 'data-query.app'] } },
];

const ACTIVITY = [
  { platform: 'ai-inference.dev', card: 'AI Assistant', note: 'inference', amount: '0.0012', ago: '2ms', accent: '#14B8A6', glyph: '✦' },
  { platform: 'video-stream.io', card: 'Video & Music', note: '1s stream', amount: '0.0003', ago: '1s', accent: '#2775CA', glyph: '▶' },
  { platform: 'data-query.app', card: 'Geo & Lookups', note: 'query', amount: '0.0012', ago: '1s', accent: '#6366F1', glyph: '≡' },
  { platform: 'render-farm.cloud', card: 'Image Gen', note: 'render', amount: '0.0021', ago: '3s', accent: '#14B8A6', glyph: '✦' },
  { platform: 'audio-cast.fm', card: 'Video & Music', note: '1s stream', amount: '0.0003', ago: '4s', accent: '#2775CA', glyph: '▶' },
  { platform: 'geo-lookup.api', card: 'Geo & Lookups', note: 'lookup', amount: '0.0001', ago: '6s', accent: '#6366F1', glyph: '≡' },
];

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function fmt(n: number | string) {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function stop(e: React.MouseEvent) {
  e.stopPropagation();
}

/* ─────────────────────────────────────────────────────────────────
   Rules drawer
───────────────────────────────────────────────────────────────── */
function RulesDrawer({
  card, group, onClose, onMonthly, onPerCharge, onDaily, onVelocity, onToggle, onRemovePlatform, onToggleFreeze,
}: {
  card: CardT;
  group: GroupT;
  onClose: () => void;
  onMonthly: (v: number) => void;
  onPerCharge: (v: string) => void;
  onDaily: (v: string) => void;
  onVelocity: (v: string) => void;
  onToggle: (key: 'autopause' | 'approve') => void;
  onRemovePlatform: (i: number) => void;
  onToggleFreeze: () => void;
}) {
  const r = card.rules;
  const toggles: { key: 'autopause' | 'approve'; label: string; desc: string }[] = [
    { key: 'autopause', label: 'Auto-pause at limit', desc: 'Stop charges when the monthly cap is hit' },
    { key: 'approve', label: 'Require approval', desc: 'Notify me before charges over the per-charge cap' },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(11,27,51,0.42)', backdropFilter: 'blur(2px)', animation: 'db-fade .25s ease' }} />
      <div className="db-drawer db-scroll" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61, width: 440, maxWidth: '100vw', background: '#F4F7FB', boxShadow: '-30px 0 80px rgba(15,45,82,0.28)', overflowY: 'auto', animation: 'db-slide .34s cubic-bezier(.2,.8,.25,1)' }}>
        <div style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2775CA', fontWeight: 600 }}>Card rules</div>
            <button onClick={onClose} style={{ fontFamily: 'inherit', width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(11,27,51,0.12)', background: '#fff', cursor: 'pointer', fontSize: 17, color: '#42546E', lineHeight: 1 }}>&times;</button>
          </div>

          {/* mini preview */}
          <div style={{ marginTop: 16, borderRadius: 16, padding: 18, background: 'linear-gradient(140deg,#11305a,#0B1B33)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -20, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle,${hexA(group.accent, 0.45)},transparent 70%)` }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>{card.name}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#9fb3cc', marginTop: 3 }}>&bull;&bull;&bull;&bull; {card.last4} &middot; {group.name}</div>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 700, color: r.frozen ? '#9fb3cc' : '#3ddc97', background: r.frozen ? 'rgba(129,148,172,0.2)' : 'rgba(61,220,151,0.18)', borderRadius: 999, padding: '4px 9px' }}>{r.frozen ? 'Frozen' : 'Active'}</span>
            </div>
            <div style={{ position: 'relative', fontFamily: "'JetBrains Mono',monospace", fontSize: 21, fontWeight: 700, marginTop: 18 }}>${fmt(card.balance)} <span style={{ fontSize: 12, color: '#6cb0f5' }}>USDC</span></div>
          </div>

          {/* spending limits */}
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8194AC', margin: '24px 0 11px' }}>Spending limits</div>
          <div style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '15px 17px', borderBottom: '1px solid rgba(11,27,51,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Monthly cap</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: '#2775CA' }}>${fmt(r.monthly)}</span>
              </div>
              <input type="range" min={10} max={2000} step={10} value={r.monthly} onChange={(e) => onMonthly(Number(e.target.value))} style={{ width: '100%', marginTop: 11, accentColor: '#2775CA' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8194AC', marginTop: 2 }}><span>$10</span><span>$2,000</span></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 17px', borderBottom: '1px solid rgba(11,27,51,0.06)' }}>
              <div><div style={{ fontSize: 14, fontWeight: 600 }}>Per-charge cap</div><div style={{ fontSize: 12, color: '#8194AC', marginTop: 1 }}>Reject any single charge above this</div></div>
              <div style={{ position: 'relative', width: 108 }}>
                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#8194AC' }}>$</span>
                <input className="db-fld" value={r.perCharge} onChange={(e) => onPerCharge(e.target.value.replace(/[^0-9.]/g, ''))} style={{ fontFamily: "'JetBrains Mono',monospace", width: '100%', padding: '9px 10px 9px 22px', fontSize: 13.5, fontWeight: 600, borderRadius: 9, border: '1.5px solid rgba(11,27,51,0.15)', background: '#fff', transition: 'border-color .2s, box-shadow .2s' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 17px' }}>
              <div><div style={{ fontSize: 14, fontWeight: 600 }}>Daily limit</div><div style={{ fontSize: 12, color: '#8194AC', marginTop: 1 }}>Resets at midnight UTC</div></div>
              <div style={{ position: 'relative', width: 108 }}>
                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#8194AC' }}>$</span>
                <input className="db-fld" value={r.daily} onChange={(e) => onDaily(e.target.value.replace(/[^0-9.]/g, ''))} style={{ fontFamily: "'JetBrains Mono',monospace", width: '100%', padding: '9px 10px 9px 22px', fontSize: 13.5, fontWeight: 600, borderRadius: 9, border: '1.5px solid rgba(11,27,51,0.15)', background: '#fff', transition: 'border-color .2s, box-shadow .2s' }} />
              </div>
            </div>
          </div>

          {/* controls */}
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8194AC', margin: '22px 0 11px' }}>Controls</div>
          <div style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 14, overflow: 'hidden' }}>
            {toggles.map((t) => (
              <div key={t.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px 17px', borderBottom: '1px solid rgba(11,27,51,0.06)' }}>
                <div><div style={{ fontSize: 14, fontWeight: 600 }}>{t.label}</div><div style={{ fontSize: 12, color: '#8194AC', marginTop: 1 }}>{t.desc}</div></div>
                <div onClick={() => onToggle(t.key)} style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 999, cursor: 'pointer', position: 'relative', transition: 'background .22s', background: r[t.key] ? '#2775CA' : 'rgba(11,27,51,0.16)' }}>
                  <div style={{ position: 'absolute', top: 3, left: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', transition: 'transform .22s', transform: r[t.key] ? 'translateX(18px)' : 'translateX(0)' }} />
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px 17px' }}>
              <div><div style={{ fontSize: 14, fontWeight: 600 }}>Velocity limit</div><div style={{ fontSize: 12, color: '#8194AC', marginTop: 1 }}>Max charges per second</div></div>
              <div style={{ position: 'relative', width: 108 }}>
                <input className="db-fld" value={r.velocity} onChange={(e) => onVelocity(e.target.value.replace(/[^0-9]/g, ''))} style={{ fontFamily: "'JetBrains Mono',monospace", width: '100%', padding: '9px 10px', fontSize: 13.5, fontWeight: 600, textAlign: 'center', borderRadius: 9, border: '1.5px solid rgba(11,27,51,0.15)', background: '#fff', transition: 'border-color .2s, box-shadow .2s' }} />
              </div>
            </div>
          </div>

          {/* allowed platforms */}
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8194AC', margin: '22px 0 11px' }}>Allowed platforms</div>
          <div style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 14, padding: '15px 17px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {r.platforms.map((p, i) => (
                <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, fontWeight: 500, color: '#1B5FA8', background: '#EAF2FC', border: '1px solid rgba(39,117,202,0.18)', borderRadius: 8, padding: '6px 11px' }}>
                  {p}
                  <span onClick={() => onRemovePlatform(i)} style={{ cursor: 'pointer', color: '#7591b3', fontSize: 14, lineHeight: 1 }}>&times;</span>
                </span>
              ))}
              <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: '#42546E', background: '#F1F5FA', border: '1px dashed rgba(11,27,51,0.18)', borderRadius: 8, padding: '6px 11px', cursor: 'pointer' }}>+ Add platform</span>
            </div>
            <div style={{ fontSize: 12, color: '#8194AC', marginTop: 11, lineHeight: 1.45 }}>Only these platforms can charge this card. Any other request is rejected before it settles.</div>
          </div>

          {/* danger zone */}
          <div style={{ display: 'flex', gap: 11, marginTop: 24 }}>
            <button onClick={onToggleFreeze} style={{ fontFamily: 'inherit', flex: 1, fontSize: 14, fontWeight: 700, borderRadius: 12, cursor: 'pointer', padding: 13, border: `1.5px solid ${r.frozen ? 'rgba(39,117,202,0.3)' : 'rgba(11,27,51,0.15)'}`, background: r.frozen ? '#EAF2FC' : '#fff', color: r.frozen ? '#1B5FA8' : '#42546E', transition: 'all .2s' }}>{r.frozen ? 'Unfreeze card' : 'Freeze card'}</button>
            <button className="db-close-card" style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 700, borderRadius: 12, cursor: 'pointer', padding: '13px 18px', border: '1.5px solid rgba(219,74,74,0.3)', background: '#fff', color: '#C53030', transition: 'all .2s' }}>Close card</button>
          </div>
          <div style={{ height: 8 }} />
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   New card modal
───────────────────────────────────────────────────────────────── */
function NewCardModal({
  groups, draft, onClose, onNameChange, onPickGroup, onPickLimit, onPickAccent, onCreate,
}: {
  groups: GroupT[];
  draft: Draft;
  onClose: () => void;
  onNameChange: (v: string) => void;
  onPickGroup: (g: GroupT) => void;
  onPickLimit: (v: number) => void;
  onPickAccent: (v: string) => void;
  onCreate: () => void;
}) {
  const blocked = draft.name.trim().length < 2;
  const nameDisplay = draft.name.trim() ? draft.name.trim().toUpperCase() : 'CARD NAME';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(11,27,51,0.5)', backdropFilter: 'blur(3px)', animation: 'db-fade .25s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="db-modal db-scroll" onClick={stop} style={{ width: 760, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', background: '#F4F7FB', borderRadius: 22, boxShadow: '0 40px 100px rgba(15,45,82,0.4)', animation: 'db-pop .3s cubic-bezier(.2,.8,.25,1)', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {/* live preview */}
        <div style={{ background: 'linear-gradient(150deg,#0B1B33,#11305a)', padding: '32px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 380, height: 380, borderRadius: '50%', background: `radial-gradient(circle,${hexA(draft.accent, 0.4)},transparent 65%)`, filter: 'blur(12px)', transition: 'background .3s' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.12em', color: '#9fb3cc', marginBottom: 16 }}>PREVIEW</div>
            <div style={{ borderRadius: 18, padding: 20, background: 'linear-gradient(140deg,rgba(255,255,255,0.62),rgba(214,232,250,0.32) 48%,rgba(39,117,202,0.22))', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 24px 56px rgba(15,45,82,0.4)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 4, background: draft.accent }} />
              <div style={{ position: 'absolute', right: 18, top: 18, width: 34, height: 34, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%,#3a8ce0,#2775CA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(39,117,202,0.7)' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 14, color: '#fff' }}>$</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 15, height: 15, borderRadius: 4, background: draft.accent }} />
                <span style={{ fontWeight: 800, fontSize: 14, color: '#0B1B33' }}>XanCard</span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 600, color: '#0B1B33', marginTop: 34, minHeight: 18 }}>{nameDisplay}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 }}>
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '0.1em', color: '#3a5074', opacity: 0.7 }}>MONTHLY CAP</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 700, color: '#0B1B33' }}>${fmt(draft.limit)}</div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#3a5074', textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: '#1B5FA8' }}>ARC</div>
                  <div style={{ opacity: 0.7 }}>via Circle</div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: '#9fb3cc', lineHeight: 1.5, marginTop: 18 }}>Your card is created instantly and secured by Circle MPC. Limits and rules can change anytime.</div>
          </div>
        </div>

        {/* form */}
        <div style={{ padding: '30px 30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Create a card</h2>
            <button onClick={onClose} style={{ fontFamily: 'inherit', width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(11,27,51,0.12)', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#42546E', lineHeight: 1 }}>&times;</button>
          </div>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#42546E', margin: '20px 0 7px' }}>Card name</label>
          <input className="db-fld" value={draft.name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Streaming wallet" style={{ fontFamily: 'inherit', width: '100%', padding: '12px 14px', fontSize: 14.5, borderRadius: 11, border: '1.5px solid rgba(11,27,51,0.15)', background: '#fff', transition: 'border-color .2s, box-shadow .2s' }} />

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#42546E', margin: '18px 0 7px' }}>Group</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {groups.map((g) => {
              const sel = draft.groupId === g.id;
              return (
                <button key={g.id} onClick={() => onPickGroup(g)} style={{ fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, borderRadius: 10, cursor: 'pointer', padding: '9px 13px', transition: 'all .18s', background: sel ? '#EAF2FC' : '#fff', color: sel ? '#1B5FA8' : '#42546E', border: `1.5px solid ${sel ? '#2775CA' : 'rgba(11,27,51,0.13)'}` }}>
                  <span style={{ fontSize: 12 }}>{g.glyph}</span>{g.name}
                </button>
              );
            })}
          </div>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#42546E', margin: '18px 0 7px' }}>Monthly cap</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {LIMITS.map((v) => {
              const sel = draft.limit === v;
              return (
                <button key={v} onClick={() => onPickLimit(v)} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, borderRadius: 10, cursor: 'pointer', padding: '11px 0', transition: 'all .18s', background: sel ? '#EAF2FC' : '#fff', color: sel ? '#1B5FA8' : '#42546E', border: `1.5px solid ${sel ? '#2775CA' : 'rgba(11,27,51,0.13)'}` }}>${v}</button>
              );
            })}
          </div>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#42546E', margin: '18px 0 7px' }}>Accent</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {ACCENTS.map((col) => {
              const sel = draft.accent === col;
              return (
                <div key={col} onClick={() => onPickAccent(col)} style={{ width: 34, height: 34, borderRadius: 10, cursor: 'pointer', background: col, boxShadow: `0 0 0 ${sel ? 3 : 0}px rgba(39,117,202,0.25)`, border: `2px solid ${sel ? '#fff' : 'transparent'}`, transition: 'all .18s' }} />
              );
            })}
          </div>

          <button className="db-primary-btn" onClick={onCreate} disabled={blocked} style={{ fontFamily: 'inherit', width: '100%', marginTop: 26, fontSize: 15, fontWeight: 700, color: '#fff', background: blocked ? '#9db8d6' : '#2775CA', border: 'none', borderRadius: 12, cursor: blocked ? 'not-allowed' : 'pointer', padding: 14, boxShadow: '0 10px 26px rgba(39,117,202,0.3)', transition: 'transform .2s' }}>Create card</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   New group modal
───────────────────────────────────────────────────────────────── */
function NewGroupModal({
  draft, onClose, onNameChange, onPickGlyph, onCreate,
}: {
  draft: GroupDraft;
  onClose: () => void;
  onNameChange: (v: string) => void;
  onPickGlyph: (gc: { glyph: string; accent: string }) => void;
  onCreate: () => void;
}) {
  const blocked = draft.name.trim().length < 2;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(11,27,51,0.5)', backdropFilter: 'blur(3px)', animation: 'db-fade .25s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={stop} style={{ width: 420, maxWidth: '96vw', background: '#fff', borderRadius: 20, boxShadow: '0 40px 100px rgba(15,45,82,0.4)', animation: 'db-pop .3s cubic-bezier(.2,.8,.25,1)', padding: '26px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>New group</h2>
          <button onClick={onClose} style={{ fontFamily: 'inherit', width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(11,27,51,0.12)', background: '#fff', cursor: 'pointer', fontSize: 16, color: '#42546E', lineHeight: 1 }}>&times;</button>
        </div>
        <p style={{ fontSize: 13.5, color: '#5B6B82', lineHeight: 1.5, margin: '8px 0 20px' }}>Group cards by what they pay for &mdash; streaming, AI, data, or anything you like.</p>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#42546E', marginBottom: 7 }}>Group name</label>
        <input className="db-fld" value={draft.name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Gaming" style={{ fontFamily: 'inherit', width: '100%', padding: '12px 14px', fontSize: 14.5, borderRadius: 11, border: '1.5px solid rgba(11,27,51,0.15)', background: '#fff', transition: 'border-color .2s, box-shadow .2s' }} />

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#42546E', margin: '18px 0 7px' }}>Icon &amp; color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {GLYPH_COLORS.map((gc) => {
              const sel = draft.glyph === gc.glyph && draft.accent === gc.accent;
              return (
                <div key={gc.glyph} onClick={() => onPickGlyph(gc)} style={{ width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff', cursor: 'pointer', background: gc.accent, border: `2px solid ${sel ? '#0B1B33' : 'transparent'}`, transition: 'all .18s' }}>{gc.glyph}</div>
              );
            })}
          </div>
        </div>

        <button className="db-primary-btn" onClick={onCreate} disabled={blocked} style={{ fontFamily: 'inherit', width: '100%', marginTop: 24, fontSize: 15, fontWeight: 700, color: '#fff', background: blocked ? '#9db8d6' : '#2775CA', border: 'none', borderRadius: 12, cursor: blocked ? 'not-allowed' : 'pointer', padding: 14, boxShadow: '0 10px 26px rgba(39,117,202,0.3)', transition: 'transform .2s' }}>Create group</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Dashboard
───────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [groups, setGroups] = useState<GroupT[]>(INITIAL_GROUPS);
  const [cards, setCards] = useState<CardT[]>(INITIAL_CARDS);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ name: '', groupId: 'streaming', limit: 80, accent: '#2775CA' });
  const [groupDraft, setGroupDraft] = useState<GroupDraft>({ name: '', glyph: '◆', accent: '#2775CA' });

  const groupById = (id: string) => groups.find((g) => g.id === id) || groups[0];

  function setRule<K extends keyof Rules>(id: string, key: K, val: Rules[K]) {
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, rules: { ...c.rules, [key]: val } } : c)));
  }

  const openNewCard = (groupId?: string, accent?: string) => {
    setDraft({ name: '', groupId: groupId ?? 'streaming', limit: 80, accent: accent ?? '#2775CA' });
    setNewOpen(true);
  };

  const onPickGroup = (g: GroupT) => {
    setDraft((d) => {
      const prevAccent = groupById(d.groupId).accent;
      return { ...d, groupId: g.id, accent: d.accent === prevAccent ? g.accent : d.accent };
    });
  };

  const createCard = () => {
    if (draft.name.trim().length < 2) return;
    const id = 'c' + Date.now();
    const last4 = String(1000 + Math.floor(Math.random() * 8999));
    const card: CardT = {
      id, groupId: draft.groupId, name: draft.name.trim(), last4, balance: 0, spent: 0,
      rules: { monthly: draft.limit, perCharge: '2.00', daily: String(Math.round(draft.limit / 8)) + '.00', velocity: '25', autopause: true, approve: false, frozen: false, platforms: [] },
    };
    setCards((cs) => [...cs, card]);
    setNewOpen(false);
    setDrawerId(id);
  };

  const createGroup = () => {
    if (groupDraft.name.trim().length < 2) return;
    const id = 'g' + Date.now();
    setGroups((gs) => [...gs, { id, name: groupDraft.name.trim(), accent: groupDraft.accent, glyph: groupDraft.glyph }]);
    setGroupOpen(false);
  };

  const totalBalance = cards.reduce((a, c) => a + c.balance, 0);
  const monthlySpend = cards.reduce((a, c) => a + c.spent, 0);
  const activeCount = cards.filter((c) => !c.rules.frozen).length;
  const drawerCard = cards.find((c) => c.id === drawerId) || null;

  const stats = [
    { label: 'Total balance', value: '$' + fmt(totalBalance), delta: 'USDC', deltaColor: '#1B5FA8', deltaBg: '#EAF2FC' },
    { label: 'Spent this month', value: '$' + fmt(monthlySpend), delta: '+12%', deltaColor: '#C53030', deltaBg: '#FDECEC' },
    { label: 'Active cards', value: `${activeCount}/${cards.length}`, delta: 'live', deltaColor: '#1B7A4B', deltaBg: 'rgba(61,220,151,0.16)' },
    { label: 'Charges today', value: '3,418', delta: '+5%', deltaColor: '#1B7A4B', deltaBg: 'rgba(61,220,151,0.16)' },
  ];

  return (
    <div style={{ fontFamily: "'Hanken Grotesk',sans-serif", color: '#0B1B33', background: '#F4F7FB', WebkitFontSmoothing: 'antialiased' }}>
      <div className="db-shell">

        {/* ═══ SIDEBAR ═══ */}
        <aside className="db-side" style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '1px solid rgba(11,27,51,0.08)', padding: '22px 16px', position: 'sticky', top: 0, height: '100vh' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 8px' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#2775CA,#1B5FA8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(39,117,202,0.35)' }}>
              <div style={{ width: 11, height: 11, borderRadius: 3, background: '#fff', opacity: 0.92 }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>XanPay</span>
          </div>

          <nav className="db-side-nav" style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 26 }}>
            {NAV_ITEMS.map((n) => (
              <div key={n.label} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 11, cursor: 'pointer', fontSize: 14.5, fontWeight: 600, background: n.active ? '#EAF2FC' : 'transparent', color: n.active ? '#1B5FA8' : '#56657D', transition: 'background .18s' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, width: 16, textAlign: 'center', opacity: 0.9 }}>{n.glyph}</span>
                <span className="db-navlabel">{n.label}</span>
              </div>
            ))}
          </nav>

          <div className="db-side-foot" style={{ marginTop: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#2775CA,#1B5FA8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>A</div>
              <div style={{ lineHeight: 1.25 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Ada Lovelace</div>
                <div style={{ fontSize: 11.5, color: '#8194AC' }}>ada@xanpay.com</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ═══ MAIN ═══ */}
        <main className="db-scroll" style={{ overflowY: 'auto', maxHeight: '100vh' }}>
          <div className="db-main-pad">

            {/* topbar */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 26 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2775CA', fontWeight: 600 }}>Overview</div>
                <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', margin: '7px 0 0' }}>Good morning, Ada</h1>
                <div style={{ marginTop: 14, display: 'inline-block', minWidth: 200, background: 'linear-gradient(140deg,#0B1B33,#11305a)', borderRadius: 14, padding: 16, color: '#fff', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(39,117,202,0.4),transparent 70%)' }} />
                  <div style={{ position: 'relative' }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.12em', color: '#9fb3cc' }}>TOTAL BALANCE</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, marginTop: 3 }}>${fmt(totalBalance)}</div>
                    <div style={{ fontSize: 11.5, color: '#9fb3cc', marginTop: 2 }}>across {cards.length} cards</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 11 }}>
                <button className="db-outline-btn" onClick={() => setGroupOpen(true)} style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#0B1B33', background: '#fff', border: '1.5px solid rgba(11,27,51,0.15)', borderRadius: 11, cursor: 'pointer', padding: '11px 17px', transition: 'border-color .2s, transform .2s' }}>+ New group</button>
                <button className="db-primary-btn" onClick={() => openNewCard()} style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#fff', background: '#2775CA', border: 'none', borderRadius: 11, cursor: 'pointer', padding: '11px 18px', boxShadow: '0 8px 22px rgba(39,117,202,0.3)', transition: 'transform .2s' }}>+ New card</button>
              </div>
            </div>

            {/* stat tiles */}
            <div className="db-stats" style={{ marginBottom: 30 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 30 }}>
              {/* grouped cards */}
              <div>
                {groups.map((g) => {
                  const groupCards = cards.filter((c) => c.groupId === g.id);
                  const total = groupCards.reduce((a, c) => a + c.balance, 0);
                  return (
                    <div key={g.id} style={{ marginBottom: 30 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 15 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', background: g.accent, boxShadow: `0 4px 12px ${hexA(g.accent, 0.5)}` }}>{g.glyph}</div>
                        <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>{g.name}</h2>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, color: '#8194AC' }}>{groupCards.length} cards</span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(11,27,51,0.08)' }} />
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: '#42546E' }}>${fmt(total)}<span style={{ color: '#8194AC', fontWeight: 500 }}> bal</span></span>
                      </div>
                      <div className="db-cardgrid">
                        {groupCards.map((c) => {
                          const pct = Math.min(100, Math.round((c.spent / c.rules.monthly) * 100));
                          const frozen = c.rules.frozen;
                          const near = pct >= 85;
                          return (
                            <div key={c.id} className="db-card-tile" onClick={() => setDrawerId(c.id)} style={{ position: 'relative', borderRadius: 18, padding: 18, cursor: 'pointer', background: 'linear-gradient(140deg,rgba(255,255,255,0.9),rgba(231,240,250,0.7))', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 10px 26px rgba(15,45,82,0.07)', overflow: 'hidden', transition: 'transform .22s cubic-bezier(.2,.7,.3,1), box-shadow .22s' }}>
                              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 3, background: g.accent, opacity: 0.85 }} />
                              <div style={{ position: 'absolute', top: '-30%', left: 0, width: '45%', height: '160%', background: 'linear-gradient(105deg,transparent,rgba(255,255,255,0.45),transparent)', animation: 'xp-sheen 6s ease-in-out infinite', pointerEvents: 'none' }} />
                              <div style={{ position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                  <div>
                                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>{c.name}</div>
                                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#5B6B82', marginTop: 3 }}>&bull;&bull;&bull;&bull; {c.last4}</div>
                                  </div>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 700, color: frozen ? '#8194AC' : '#1B7A4B', background: frozen ? 'rgba(129,148,172,0.16)' : 'rgba(61,220,151,0.16)', borderRadius: 999, padding: '4px 9px' }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: frozen ? '#8194AC' : '#1B7A4B' }} />{frozen ? 'Frozen' : 'Active'}
                                  </span>
                                </div>
                                <div style={{ marginTop: 20 }}>
                                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8194AC' }}>SPENT THIS MONTH</span>
                                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, color: '#42546E' }}>${fmt(c.spent)} / ${fmt(c.rules.monthly)}</span>
                                  </div>
                                  <div style={{ marginTop: 7, height: 7, borderRadius: 5, background: 'rgba(11,27,51,0.08)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: frozen ? '#8194AC' : near ? '#E0801B' : g.accent, borderRadius: 5, transition: 'width .4s ease' }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div className="db-addcard" onClick={() => openNewCard(g.id, g.accent)} style={{ borderRadius: 18, border: '1.5px dashed rgba(39,117,202,0.35)', background: 'rgba(39,117,202,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer', minHeight: 128, color: '#2775CA', transition: 'background .2s, border-color .2s' }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#2775CA', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1 }}>+</div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>Add card</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* activity */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ddc97', boxShadow: '0 0 9px #3ddc97', animation: 'db-fade 1.4s infinite alternate' }} />
                  <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Live activity</h2>
                </div>
                <div style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 22px rgba(15,45,82,0.04)' }}>
                  {ACTIVITY.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: '1px solid rgba(11,27,51,0.06)' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', background: a.accent, flexShrink: 0 }}>{a.glyph}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 500, color: '#0B1B33', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.platform}</div>
                        <div style={{ fontSize: 12, color: '#8194AC' }}>{a.card} &middot; {a.note}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13.5, fontWeight: 700, color: '#0B1B33' }}>-${a.amount}</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8194AC' }}>{a.ago}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: '13px 18px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#2775CA', cursor: 'pointer' }}>View all activity &rarr;</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ═══ RULES DRAWER ═══ */}
      {drawerCard && (
        <RulesDrawer
          card={drawerCard}
          group={groupById(drawerCard.groupId)}
          onClose={() => setDrawerId(null)}
          onMonthly={(v) => setRule(drawerCard.id, 'monthly', v)}
          onPerCharge={(v) => setRule(drawerCard.id, 'perCharge', v)}
          onDaily={(v) => setRule(drawerCard.id, 'daily', v)}
          onVelocity={(v) => setRule(drawerCard.id, 'velocity', v)}
          onToggle={(key) => setRule(drawerCard.id, key, !drawerCard.rules[key])}
          onRemovePlatform={(i) => setRule(drawerCard.id, 'platforms', drawerCard.rules.platforms.filter((_, j) => j !== i))}
          onToggleFreeze={() => setRule(drawerCard.id, 'frozen', !drawerCard.rules.frozen)}
        />
      )}

      {/* ═══ NEW CARD MODAL ═══ */}
      {newOpen && (
        <NewCardModal
          groups={groups}
          draft={draft}
          onClose={() => setNewOpen(false)}
          onNameChange={(v) => setDraft((d) => ({ ...d, name: v }))}
          onPickGroup={onPickGroup}
          onPickLimit={(v) => setDraft((d) => ({ ...d, limit: v }))}
          onPickAccent={(v) => setDraft((d) => ({ ...d, accent: v }))}
          onCreate={createCard}
        />
      )}

      {/* ═══ NEW GROUP MODAL ═══ */}
      {groupOpen && (
        <NewGroupModal
          draft={groupDraft}
          onClose={() => setGroupOpen(false)}
          onNameChange={(v) => setGroupDraft((d) => ({ ...d, name: v }))}
          onPickGlyph={(gc) => setGroupDraft((d) => ({ ...d, glyph: gc.glyph, accent: gc.accent }))}
          onCreate={createGroup}
        />
      )}
    </div>
  );
}
