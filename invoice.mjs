// invoice.mjs — the number at the bottom of a document somebody is going to pay.
//
// ⚑ THE PRINTED LINES DID NOT ADD UP TO THE PRINTED SUBTOTAL. Each line was displayed rounded to the
// penny, and the subtotal summed the unrounded values. Three lines of 1 × 0.335 print as £0.34, £0.34,
// £0.34 — and the subtotal prints as £1.01. The customer adds up the column and gets £1.02. On a
// document whose entire job is to be checked and paid, a total that disagrees with its own lines is
// the worst possible defect: it is not wrong enough to crash, only wrong enough to be argued about.
//
// ⚑ AND THE SAME SUM WAS WRITTEN THREE TIMES. invoiceTotal(), the live editor preview, and the pay
// landing page each computed subtotal, VAT and total independently, in three places. Three copies of
// one calculation is how they come to disagree — and one of the three is the pay link, which is the
// copy the customer's money actually follows.
//
// ⚑ THE PAY LINK CARRIED PENNIES THAT DO NOT EXIST. The amount was written into a paypal.me URL with
// toFixed(2) regardless of currency, so a ¥ invoice — which the app itself displays with no decimal
// places — asked for an amount in a denomination the currency does not have.
//
// ⚑ AND A COMMA SILENTLY BECAME ZERO, the same fault as the ledger: amounts read as Number(x)||0, and
// Number of "1,000" is NaN. A rate typed the way money is written became a free line.
//
// Pure: no DOM, no storage. Money is integer minor units throughout — pence, cents, whole yen.

/** Currencies whose smallest unit is the unit itself. Everything else is assumed to have 100. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'XAF', 'XOF']);

export function currencyOf(value) {
  return typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim()) ? value.trim().toUpperCase() : 'GBP';
}

/** How many minor units make one of this currency: 100 for pence and cents, 1 for yen. */
export function minorUnits(currency) {
  return ZERO_DECIMAL.has(currencyOf(currency)) ? 1 : 100;
}

/** How many decimal places this currency is written with. */
export function decimalsOf(currency) {
  return ZERO_DECIMAL.has(currencyOf(currency)) ? 0 : 2;
}

/**
 * An amount in minor units, or null.
 *
 * Accepts what people type — "1,000", "£1,000.50", " 1000 " — and refuses what nobody means.
 */
export function minor(value, currency) {
  const units = minorUnits(currency);
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * units) : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[£$€¥,\s]/g, '');
  if (cleaned === '' || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * units) : null;
}

/** Minor units back to a display number. */
export function major(m, currency) {
  const n = Number(m);
  return Number.isFinite(n) ? n / minorUnits(currency) : null;
}

/** A quantity: a finite number, not negative. Absent means one, because that is what a line is. */
export function quantityOf(value) {
  if (value === undefined || value === null || value === '') return 1;
  const raw = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
  const n = Number(raw);
  return (Number.isFinite(n) && n >= 0) ? n : null;
}

/**
 * ⚑ A RATE IS NOT MONEY. It is a price per unit, and per-unit pricing is routinely finer than a
 * penny — per word, per sheet, per litre, per mile. Rounding the RATE to the penny before multiplying
 * throws that away: 3 at £0.335 becomes 3 × 34p = £1.02 when the answer is £1.005, which is £1.01.
 *
 * So the rate is held as an exact decimal — digits and a scale, never a float — and only the LINE is
 * money.
 *
 * ⚑ And this is why no floating point appears anywhere in the money path. In binary, 3 × 0.335 comes
 * out as 1.0050000000000001 and rounds UP, while 0.335 + 0.335 + 0.335 comes out as
 * 1.0049999999999999 and rounds DOWN. The same three lines, a penny apart, decided by whether the
 * code happened to multiply or to add. Exact decimals give 100.5 either way, and one rule decides.
 */
function exactDecimal(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return exactDecimal(String(value));
  }
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[£$€¥,\s]/g, '');
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(cleaned);
  if (!m) return null;
  const frac = m[3] || '';
  const digits = Number(m[2] + frac);
  // ⚑ Past the largest safe integer, whole numbers stop being exact and arithmetic starts silently
  // returning neighbours. A figure that cannot be held exactly is refused rather than approximated:
  // an invoice total nobody can reproduce is not a total.
  if (!Number.isSafeInteger(digits)) return null;
  return { digits: (m[1] === '-' ? -digits : digits), scale: Math.pow(10, frac.length) };
}

/**
 * ⚑ ONE LINE, ROUNDED ONCE.
 *
 * The rounding happens here and nowhere else. That is what makes the printed column add up to the
 * printed subtotal: the subtotal is the sum of these, not a second sum of the raw numbers.
 */
export function lineTotal(line, currency) {
  // ⚑ A row that is not an object is not a line worth nothing — it is not a line. Treating it as a
  // free line hides it inside a total that then looks correct.
  if (!line || typeof line !== 'object') return null;
  const qty = quantityOf(line.qty);
  const raw = line.rate === undefined || line.rate === null || line.rate === '' ? 0 : line.rate;
  const rate = exactDecimal(raw);
  if (qty === null || rate === null) return null;

  const q = exactDecimal(qty);
  if (q === null) return null;
  // (qty.digits × rate.digits) / (qty.scale × rate.scale) units of currency, in minor units.
  const units = minorUnits(currency);
  const numerator = q.digits * rate.digits * units;
  const denominator = q.scale * rate.scale;
  // ⚑ Both ends have to stay exact, not just the inputs. Two figures that are each safe can multiply
  // into one that is not — a large quantity at a fine rate — and from there the arithmetic returns
  // near-misses. Checking only that the result is finite lets that straight through.
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) return null;
  return Math.round(numerator / denominator);
}

/** A VAT rate as a percentage, or null. Absent means none. */
export function vatRateOf(value) {
  if (value === undefined || value === null || value === '') return 0;
  const raw = typeof value === 'string' ? value.replace(/[%\s,]/g, '') : value;
  const n = Number(raw);
  return (Number.isFinite(n) && n >= 0 && n <= 100) ? n : null;
}

/**
 * ⚑ THE ONE PLACE THE TOTALS ARE WORKED OUT. Everything — the list, the editor, the printed document,
 * the pay link — reads these, so they cannot drift apart.
 *
 * `unusable` names the lines that could not be counted, rather than treating them as free.
 */
export function totalsOf(invoice, opts) {
  const inv = (invoice && typeof invoice === 'object') ? invoice : {};
  const o = (opts && typeof opts === 'object') ? opts : {};
  const currency = currencyOf(inv.currency || o.currency);
  const rawLines = Array.isArray(inv.lines) ? inv.lines : [];

  const lines = [];
  const unusable = [];
  let subtotal = 0;
  rawLines.forEach((l, i) => {
    const t = lineTotal(l, currency);
    if (t === null) { unusable.push({ index: i, desc: (l && l.desc) || '', why: 'the quantity or the rate is not a number' }); return; }
    lines.push({ index: i, desc: (l && l.desc) || '', qty: quantityOf(l && l.qty), rate: minor((l && l.rate) || 0, currency), total: t });
    subtotal += t;
  });

  const rate = vatRateOf(inv.vat);
  const vat = rate === null ? null : Math.round(subtotal * rate / 100);
  const total = vat === null ? null : subtotal + vat;

  return {
    currency, decimals: decimalsOf(currency),
    lines, subtotal, vatRate: rate, vat, total,
    unusable, complete: unusable.length === 0 && rate !== null,
  };
}

/** The amount written the way this currency is written. */
export function formatAmount(m, currency) {
  const n = Number(m);
  if (!Number.isFinite(n)) return null;
  return (n / minorUnits(currency)).toFixed(decimalsOf(currency));
}

/**
 * ⚑ WHAT THE CUSTOMER IS ASKED TO PAY.
 *
 * Derived from the same totals as the document, with the right number of decimals for the currency —
 * a yen invoice must not ask for a fraction of a yen. Returns null when the invoice cannot be totalled,
 * so a broken invoice produces no payment link rather than a link to the wrong amount.
 */
export function payAmount(invoice, opts) {
  const t = totalsOf(invoice, opts);
  if (!t.complete || t.total === null) return null;
  return formatAmount(t.total, t.currency);
}

/**
 * Does a payment link ask for what the invoice says?
 *
 * ⚑ The check exists because the link was built from its own copy of the sum. A link that asks for a
 * different figure from the document beside it is the one bug on an invoice that costs real money —
 * and it is invisible on screen, because both numbers look plausible.
 */
export function payLinkAgrees(href, invoice, opts) {
  const expected = payAmount(invoice, opts);
  if (expected === null) return { ok: false, expected: null, found: null, reason: 'this invoice cannot be totalled, so no link should be offered' };
  const text = typeof href === 'string' ? href : '';
  const found = (text.match(/(\d+(?:\.\d+)?)/g) || []).slice(-1)[0] || null;
  if (found === null) return { ok: true, expected, found: null, reason: 'the link carries no amount' };
  if (found !== expected) return { ok: false, expected, found, reason: `the link asks for ${found} but the invoice says ${expected}` };
  return { ok: true, expected, found, reason: 'the link matches the invoice' };
}

export default {
  currencyOf, minorUnits, decimalsOf, minor, major, quantityOf,
  lineTotal, vatRateOf, totalsOf, formatAmount, payAmount, payLinkAgrees,
};
