'use client';

import { useState } from 'react';

/* ─────────────────────────────────────────────────────────────────
   Shared bits
───────────────────────────────────────────────────────────────── */
const TOC = [
  { id: 'quickstart', label: 'Quickstart' },
  { id: 'auth', label: 'Authentication' },
  { id: 'linking', label: 'Linking a card' },
  { id: 'charging', label: 'Charging' },
  { id: 'reading', label: 'Reading data' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'errors', label: 'Errors' },
  { id: 'rest', label: 'REST reference' },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard?.writeText(code); } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 22px rgba(15,45,82,0.08)', margin: '12px 0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: '#0a1526', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: '#7e93ad' }}>{label ?? 'ts'}</span>
        <button onClick={copy} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: copied ? '#3ddc97' : '#9cc6f3', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '16px 18px', background: '#0c1830', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, lineHeight: 1.7, overflowX: 'auto', color: '#e6edf3' }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Card({ id, title, kicker, children }: { id: string; title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ background: '#fff', border: '1px solid rgba(11,27,51,0.08)', borderRadius: 18, padding: '24px 26px', boxShadow: '0 8px 22px rgba(15,45,82,0.04)', marginBottom: 20, scrollMarginTop: 20 }}>
      {kicker && <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2775CA', fontWeight: 700 }}>{kicker}</div>}
      <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', margin: '5px 0 12px' }}>{title}</h2>
      <div style={{ fontSize: 13.8, color: '#42546E', lineHeight: 1.65 }}>{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 10px' }}>{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '0.92em', background: '#F1F5FA', color: '#1B5FA8', borderRadius: 5, padding: '1.5px 5px' }}>{children}</code>;
}

function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '10px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.8 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: '#8194AC', fontWeight: 700, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid rgba(11,27,51,0.1)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(11,27,51,0.06)', verticalAlign: 'top', fontFamily: j === 0 ? "'JetBrains Mono',monospace" : 'inherit' }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 14px', borderRadius: 11, background: 'rgba(224,128,27,0.1)', border: '1px solid rgba(224,128,27,0.28)', margin: '12px 0', fontSize: 12.8, color: '#a86a1e', lineHeight: 1.5 }}>
      <span style={{ fontSize: 14 }}>⚠️</span>
      <span>{children}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Docs
───────────────────────────────────────────────────────────────── */
export default function DeveloperDocs() {
  return (
    <div>
      {/* in-page nav */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        {TOC.map((t) => (
          <button key={t.id} onClick={() => scrollToId(t.id)} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, color: '#1B5FA8', background: '#EAF2FC', border: '1px solid rgba(39,117,202,0.2)', borderRadius: 999, padding: '7px 14px', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      <Card id="quickstart" kicker="Get started" title="Quickstart">
        <P>Install the SDK. It ships two entry points — a server package holding your secret key, and a secret-free browser package for the card-linking modal.</P>
        <CodeBlock label="shell" code={'npm install @xanpay/sdk'} />
        <P>Server-side — charge a linked card:</P>
        <CodeBlock code={`import { XanPay } from '@xanpay/sdk';

const xanpay = new XanPay({
  apiKey: process.env.XANPAY_API_KEY!,      // sk_xan_...
  platformId: platformId,
});

const receipt = await xanpay.charge({
  billingKey,       // from exchangeLinkToken() — see "Linking a card"
  amount: 0.0008,   // USDC
  reason: 'API call to /v1/infer',
});`} />
        <P>Client-side — let a user link their XanCard:</P>
        <CodeBlock code={`import { XanPayBrowser } from '@xanpay/sdk/browser';

const xanpay = new XanPayBrowser({ platformId: platformId });

xanpay.link({
  onSuccess: (linkToken) => fetch('/api/save-xancard', {
    method: 'POST',
    body: JSON.stringify({ linkToken }),
  }),
});`} />
      </Card>

      <Card id="auth" kicker="Security" title="Authentication">
        <P>Every server-side call is authenticated with a platform API key as a bearer token:</P>
        <CodeBlock label="http" code={'Authorization: Bearer sk_xan_...'} />
        <P>Manage keys from the <b>API keys</b> tab. Each key carries one or more scopes — a request with a key missing the required scope gets <Code>403</Code>.</P>
        <Table
          head={['Scope', 'Grants']}
          rows={[
            [<Code key="w">charges:write</Code>, 'Submit charges (charge())'],
            [<Code key="r">charges:read</Code>, 'Read balance & charge history (getBalance(), getChargeHistory())'],
            [<Code key="l">link:exchange</Code>, 'Exchange a linkToken for a billingKey, and disconnect a linked card'],
          ]}
        />
        <P>New keys get every scope by default unless you request a subset when creating one.</P>
      </Card>

      <Card id="linking" kicker="Onboarding a user" title="Linking a card">
        <P>XanPay never hands your platform a raw card id. The flow always goes through an opaque, single-use <Code>linkToken</Code> that your backend immediately exchanges for an encrypted <Code>billingKey</Code> — the only thing you store, and the only thing you ever pass back to charge that card.</P>
        <ol style={{ margin: '0 0 10px', paddingLeft: 18 }}>
          <li>Open the connect modal with <Code>XanPayBrowser.link()</Code> (browser).</li>
          <li>The user approves a card inside the modal; <Code>onSuccess(linkToken)</Code> fires.</li>
          <li>Send the <Code>linkToken</Code> to your own backend immediately — it expires in 10 minutes and can only be used once.</li>
          <li>Your backend calls <Code>exchangeLinkToken()</Code> and stores the resulting <Code>billingKey</Code> against that user.</li>
        </ol>
        <CodeBlock code={`// your backend route, e.g. POST /api/save-xancard
const { billingKey } = await xanpay.exchangeLinkToken(linkToken);
await db.users.update(currentUser.id, { xanBillingKey: billingKey });`} />
        <Callout>Store the billingKey server-side only, the same way you&apos;d store any other secret credential — never send it to a browser.</Callout>
        <P>To let a user unlink a card from your platform&apos;s own settings page:</P>
        <CodeBlock code={'await xanpay.disconnect(billingKey); // revokes it — future charges with it fail'} />
      </Card>

      <Card id="charging" kicker="Taking payment" title="Charging">
        <P><Code>charge()</Code> is the foundation everything else builds on:</P>
        <CodeBlock code={`const receipt = await xanpay.charge({
  billingKey,
  amount: 0.0008,           // USDC
  reason: 'API call to /v1/infer',
  routeId: route.id,        // optional — see "Routes" tab
});
// receipt: { chargeId, txId, amount, timestamp }`} />
        <P>If you priced an endpoint in the <b>Routes</b> tab, pass its <Code>routeId</Code> — the amount you charge must exactly match that route&apos;s configured price, which stops a bug or compromised client from charging arbitrary amounts under that route&apos;s name.</P>
        <P>For the common &quot;charge a fixed price per request&quot; pattern, <Code>protect()</Code> wraps <Code>charge()</Code> as Express middleware:</P>
        <CodeBlock code={`app.post(
  '/v1/infer',
  lookupBillingKey,   // your own middleware: sets req.xanpay = { billingKey }
  xanpay.protect({ price: 0.0008, reason: 'AI inference call' }),
  handler,
);`} />
        <P>It reads the billingKey from <Code>req.xanpay.billingKey</Code> by default (set that upstream from whatever you stored at link time), or pass <Code>getBillingKey: (req) =&gt; ...</Code> to source it differently. The request is rejected — the real handler never runs — if the billingKey is missing or the charge fails.</P>
      </Card>

      <Card id="reading" kicker="Balances & history" title="Reading data">
        <CodeBlock code={`const { available, currency } = await xanpay.getBalance(billingKey);

const { charges, hasMore } = await xanpay.getChargeHistory({
  billingKey,
  limit: 50,
  startAfter: previousPage.charges.at(-1)?.chargeId,
});`} />
        <P>Both are scoped to charges <i>your platform</i> made — a card linked to several platforms keeps each platform&apos;s view separate.</P>
      </Card>

      <Card id="webhooks" kicker="Async events" title="Webhooks">
        <P>Configure a webhook endpoint from the dashboard (coming soon to this UI — for now, <Code>PUT /platform/webhooks</Code> with <Code>{'{ url }'}</Code>, must be <Code>https://</Code>) to receive:</P>
        <Table
          head={['Event', 'Fires when']}
          rows={[
            [<Code key="cs">charge.settled</Code>, 'Every successful charge()'],
            [<Code key="st">card.spend_threshold</Code>, "A charge crosses 80% of a card's daily or monthly limit (once per period)"],
          ]}
        />
        <P>Verify every delivery — it&apos;s signed with your webhook secret over the raw body:</P>
        <CodeBlock code={`import { constructEvent } from '@xanpay/sdk';

app.post('/webhooks/xanpay', express.raw({ type: 'application/json' }), (req, res) => {
  const event = constructEvent(
    req.body,
    req.headers['x-xanpay-signature'] as string,
    process.env.XANPAY_WEBHOOK_SECRET!,
  );
  if (event.type === 'charge.settled') { /* ... */ }
  res.sendStatus(200);
});`} />
        <Callout>Deliveries are best-effort with no retry queue — treat webhooks as a convenience signal, not the only place you record a charge (the return value of charge()/protect() is authoritative).</Callout>
      </Card>

      <Card id="errors" kicker="Handling failure" title="Errors">
        <P>Every SDK call throws <Code>XanPayError</Code> on failure: <Code>.code</Code> (a stable string), <Code>.message</Code> (the specific reason), <Code>.statusCode</Code> (the underlying HTTP status).</P>
        <CodeBlock code={`import { XanPayError } from '@xanpay/sdk';

try {
  await xanpay.charge({ billingKey, amount, reason });
} catch (err) {
  if (err instanceof XanPayError) {
    if (err.code === 'charge_declined') { /* insufficient balance or over a spend limit */ }
    if (err.code === 'card_not_approved') { /* card paused/frozen, or not linked to you */ }
  }
  throw err;
}`} />
        <Table
          head={['code', 'statusCode', 'Meaning']}
          rows={[
            [<Code key="1">invalid_request</Code>, '400', 'Malformed request, or a route/price mismatch'],
            [<Code key="2">invalid_key</Code>, '401', 'billingKey is invalid, belongs to another platform, or was revoked'],
            [<Code key="3">charge_declined</Code>, '402', "Insufficient balance, or over the card's per-charge/daily/monthly limit"],
            [<Code key="4">card_not_approved</Code>, '403', 'Card is paused, frozen, or not on your allowlist'],
            [<Code key="5">card_not_found</Code>, '404', 'No such card'],
            [<Code key="6">rate_limited</Code>, '429', "Card's velocity (charges/sec) limit exceeded"],
            [<Code key="7">settlement_failed</Code>, '502', 'Funds were reserved but on-chain settlement failed (automatically refunded)'],
            [<Code key="8">token_expired</Code>, '400', 'linkToken has expired (exchangeLinkToken only)'],
            [<Code key="9">token_mismatch</Code>, '401', "linkToken wasn't issued for this platform (exchangeLinkToken only)"],
            [<Code key="10">token_not_found</Code>, '404', 'Unknown linkToken (exchangeLinkToken only)'],
            [<Code key="11">token_used</Code>, '410', 'linkToken was already exchanged (exchangeLinkToken only)'],
            [<Code key="12">network_error</Code>, '—', 'The request never reached XanPay'],
          ]}
        />
      </Card>

      <Card id="rest" kicker="Not using Node?" title="REST API reference">
        <P>The SDK is a thin wrapper — call the REST API directly from any language with the same bearer-token auth.</P>
        <Table
          head={['Method & path', 'Scope', 'Body / query']}
          rows={[
            ['POST /platform/charge', 'charges:write', 'billingKey, amount, reason, routeId?'],
            ['GET /platform/balance', 'charges:read', '?billingKey='],
            ['GET /platform/charges/by-key', 'charges:read', '?billingKey=&limit=&startAfter='],
            ['POST /platform/link/exchange', 'link:exchange', 'linkToken'],
            ['POST /platform/disconnect', 'link:exchange', 'billingKey'],
          ]}
        />
        <P>Base URL: <Code>https://api.xanpay.com</Code>. Full request/response shapes and every error case are documented in the project&apos;s <Code>backend/docs.md</Code>.</P>
      </Card>
    </div>
  );
}
