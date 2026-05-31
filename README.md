# ◊ fallinvoice

**Single-file sovereign invoice generator with one-click pay buttons.**
Built to maximise the speed your buyer actually pays — the PYMNTS "hierarchy of convenience" applied to AR.

Live: **<https://sjgant80-hub.github.io/fallinvoice/>**

---

## For people who get paid late (the end-user pitch)

You know the feeling. You send the invoice. You wait. You wait some more. You send a "just checking" email. They reply "sorry, when was it due?". You die a little inside.

Bluevine surveyed 1,052 small businesses in February 2026:

- **59%** experience late payments routinely
- **28%** have **$5,000+** currently stuck in unpaid invoices
- **17%** have nearly missed payroll because of it

The fix isn't sending sharper emails. It's removing every excuse the buyer has not to pay you *right now*.

**fallinvoice** does that:

- **One-click pay buttons** on the invoice itself — PayPal, Stripe link, Wise, bank transfer, BTC, USDC. They click. They pay. Done.
- **The invoice is a payment landing page**, not a PDF the buyer has to print and then forget about.
- **Pre-written 3-stage chase emails** (day 0, +14, +30) with copy-to-clipboard buttons — for when buttons aren't enough.
- **Client list** so you never re-type the same address.
- **Stats**: total billed · total paid · days-late histogram so you can *see* which clients are the slow payers.

### Get it (60 seconds)

1. Open <https://sjgant80-hub.github.io/fallinvoice/>
2. Settings → enter your business name, address, and turn on the pay methods you use
3. New invoice → fill it in → Save & view pay page → send the link

Or save the page to your phone home screen (Add to Home Screen) — it works offline.

### What it costs

- **Self-hosted single-file** (this build, from GitHub Pages or saved to disk): **free, no caps, no watermark, forever**.
- **Pro licence** (unlimited / branded / multi-client / MTD export): available from <https://www.ai-nativesolutions.com>.

Your data never leaves your device. There's no account. No server. No analytics. No "free trial then surprise bill". You own the tool.

---

## For developers (the architecture)

### One file. ~30KB-ish. Vanilla.

```
fallinvoice/
├── index.html       — the entire tool (HTML + CSS + JS, single file)
├── README.md        — this file
├── LICENSE          — MIT
└── .nojekyll        — required for GitHub Pages serve-as-is
```

No build step. No npm. No frameworks. No CDN dependencies except Google Fonts (graceful fallback to system fonts if blocked).

### Architecture

| Layer | Choice | Why |
|---|---|---|
| **Shell** | Single HTML file, vanilla JS | Sovereign · forkable · runs from `file://` |
| **Storage** | IndexedDB primary, localStorage fallback | Survives reload; no server |
| **Routing** | Hash-free view switcher | Simpler; `#pay=…` reserved for share-link payload |
| **State** | Plain objects, no observable lib | YAGNI |
| **PWA** | Manifest via `data:` URL | One file still |
| **Mesh** | `BroadcastChannel('fall-signal')` · prime **349** | Inter-app event bus across the Fall* estate |
| **Licence** | `window.Konomi` shim | Sovereign tier = free; Pro tier = Ed25519-signed key |

### The Konomi shim

```js
window.Konomi = {
  tier: 'sovereign' | 'free' | 'pro',
  cap: { invoices: 5, clients: 1 } | null,    // null on sovereign/pro
  license: null | <signed-key>,
  deviceId: <uuid>,
  install(ed25519Sig): boolean,
  canCreateInvoice(n), canCreateClient(n),
  showWatermark()
};
```

The shim is intentionally minimal (~50 lines). Sovereign-tier (self-hosted single file) sees no caps and no watermark. The free-tier path is reserved for a future hosted variant — call `Konomi.forceFree()` to test it. Pro install is a placeholder for proper Ed25519 verification — wire your verification logic to the `install(sig)` call.

### Data shapes

```js
// invoice
{
  id: uuid,
  number: 'INV-001',
  client_id: uuid,
  date: 'YYYY-MM-DD',
  due:  'YYYY-MM-DD',
  currency: 'GBP'|'EUR'|'USD'|...,
  status: 'draft'|'sent'|'paid',
  vat: 20,                             // percentage
  lines: [{ desc, qty, rate }],
  notes: '...',
  createdAt: ts
}

// client
{ id, name, email, phone, address, vat, createdAt }

// settings  (key 'main' in store 'settings')
{
  biz_name, biz_email, biz_phone, biz_address, biz_vat, biz_company, prefix,
  pay_paypal_on, pay_paypal,
  pay_stripe_on, pay_stripe,
  pay_wise_on, pay_wise,
  pay_bank_on, pay_bank_name, pay_bank_sort, pay_bank_acct, pay_bank_iban,
  pay_btc_on, pay_btc,
  pay_usdc_on, pay_usdc
}
```

### Pay-button rendering

The pay landing page only renders a button when **both** the `pay_<method>_on` flag is true AND the corresponding value is non-empty. This is intentional — fewer options means faster decisions (the "hierarchy of convenience").

PayPal URL is auto-constructed: `paypal.me/<handle>/<amount><currency>` if the user supplied just a handle.

BTC button uses the `bitcoin:` URI scheme with `?amount=` and `?label=` parameters, and falls back to clipboard copy.

USDC button always copies the wallet — the user can paste into their wallet of choice (chain is per-user, mentioned in invoice notes).

### Reminder emails

Three stages, all written cold without templates so they sound human:

- **Day 0** — "here's the invoice, easiest way to pay is the buttons"
- **Day +14** — "gentle nudge, no drama"
- **Day +30** — "firm, statutory interest mentioned, 7-day deadline"

Each has a Copy button that puts subject + body on the clipboard. Paste into Gmail / Outlook / wherever.

### fallmesh events

```js
emit('app_loaded',     { invoices, clients });
emit('invoice_created',{ id });
emit('invoice_paid',   { id, total });
```

Other Fall* tools listening on `BroadcastChannel('fall-signal')` can react — e.g. fallaccount can ingest paid invoices into accounting.

### Brand palette

```
--ox:    #8b1a1a   /* oxblood       */
--brass: #b8974a   /* aged brass    */
--cream: #c4bfb2   /* parchment     */
--void:  #0b0a0f   /* deep void     */
--gold:  #d4a853   /* highlight     */
```

Fonts: Libre Baskerville (serif headings), Syne (sans accent), DM Mono (mono details), DM Sans (body). Luxury brutalist — serious tools for serious money.

### Share-link payload

`#pay=<base64>` carries a snapshot `{invoice, client, settings}` so you can copy a link and the receiving device renders the pay landing page without needing the data locally. Best-effort — fits in URL bar fine for normal invoices.

### Deploying your fork

1. Fork or copy this repo
2. Edit `index.html` — change `biz_name` defaults, swap palette, add pay methods, whatever
3. Enable Pages: Settings → Pages → branch `main` / path `/` → Save
4. `.nojekyll` is already there — keep it

### Verification

```bash
# Size check (should be well under 400KB)
ls -lh index.html

# Open locally
open index.html       # mac
start index.html      # win
xdg-open index.html   # linux
```

### Sovereignty checklist (the 14-point gate)

- [x] Single HTML file · works from `file://`
- [x] < 400KB
- [x] Domain-appropriate views (invoices, pay landing page, clients, stats, settings)
- [x] T0 fully works offline (T1+ pay buttons need the user's network for the redirect)
- [x] Input routes to right view · no LLM-required paths
- [x] IndexedDB primary · localStorage fallback · JSON export/import
- [x] Mobile-first · one-thumb usable
- [x] Empty state is helpful (pre-filled example invoice)
- [x] Konomi licence shim baked (sovereign tier · no gate)
- [x] fallmesh hook (BroadcastChannel · prime 349)
- [x] PWA manifest baked via `data:` URL
- [x] README · two-audience · MIT LICENSE
- [x] Pushed to GitHub Pages

### Roadmap (Pro tier additions)

- MTD (Making Tax Digital) export for UK VAT-registered users
- Recurring invoices
- Currency-mix stats with per-currency breakdown
- Stripe Checkout session creation (proper, not just link)
- HMRC API integration

---

**MIT licence · 2026 Simon Gant · sjgant80 / AI Native Solutions**

Part of the [Fall* sovereign estate](https://www.ai-nativesolutions.com). Your data stays on your device. Always.
