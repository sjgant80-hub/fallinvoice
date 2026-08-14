// invoice.test.mjs — PROOF-OF-PLAY for a document somebody is going to check and pay.
import { currencyOf, minorUnits, decimalsOf, minor, major, quantityOf,
         lineTotal, vatRateOf, totalsOf, formatAmount, payAmount, payLinkAgrees } from './invoice.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };

const inv = (lines, extra = {}) => ({ number: 'INV-1', currency: 'GBP', vat: 20, lines, ...extra });

console.log('\n=== §1 · ⚑ THE COLUMN MUST ADD UP TO THE SUBTOTAL ===');
{
  // The exact invoice that gave it away: three lines the app printed as £0.34 each, over a subtotal
  // it printed as £1.01. A customer adds up the column and gets £1.02.
  const t = totalsOf(inv([{ qty: 1, rate: 0.335 }, { qty: 1, rate: 0.335 }, { qty: 1, rate: 0.335 }]));
  const printed = t.lines.map(l => l.total);
  ok(printed.join() === '34,34,34', 'each line comes to 34p');
  ok(t.subtotal === 102,
     '⚑ and the subtotal is £1.02 — the sum of what is PRINTED. Summing the raw values gave £1.01, and the document argued with itself');
  ok(printed.reduce((a, b) => a + b, 0) === t.subtotal,
     '⚑ the printed column always adds up to the printed subtotal, because the subtotal IS that column');
  ok(formatAmount(t.subtotal, 'GBP') === '1.02', 'and it is written the way money is written');
}

console.log('\n=== §2 · ⚑ A COMMA IS NOT A FREE LINE ===');
{
  const t = totalsOf(inv([{ qty: 1, rate: '1,000' }]));
  ok(t.subtotal === 100000, '⚑ a rate typed "1,000" is a thousand pounds — Number("1,000") is NaN, and `||0` made the line free');
  ok(totalsOf(inv([{ qty: '2', rate: '£1,000.50' }])).subtotal === 200100, 'and "£1,000.50" times two is £2,001.00');
  ok(minor('1,000', 'GBP') === 100000 && minor(1000, 'GBP') === 100000, 'typed or passed');
  ok(minor('abc', 'GBP') === null && minor('', 'GBP') === null && minor('1e5', 'GBP') === null, 'letters, emptiness and exponents are not amounts');
  ok(major(100050, 'GBP') === 1000.5, 'and minor units convert back');
}

console.log('\n=== §3 · ⚑ A YEN INVOICE HAS NO PENNIES ===');
{
  const t = totalsOf(inv([{ qty: 1, rate: 5000 }], { currency: 'JPY', vat: 10 }));
  ok(minorUnits('JPY') === 1 && decimalsOf('JPY') === 0, 'yen has no smaller unit');
  ok(t.subtotal === 5000 && t.vat === 500 && t.total === 5500, 'the totals are whole yen');
  ok(payAmount(inv([{ qty: 1, rate: 5000 }], { currency: 'JPY', vat: 10 })) === '5500',
     '⚑ and the PAY LINK asks for 5500, not 5500.00 — the old link used toFixed(2) whatever the currency, asking for a fraction of a yen');
  ok(payAmount(inv([{ qty: 1, rate: 100 }])) === '120.00', 'a sterling invoice still asks in pounds and pence');
  ok(decimalsOf('EUR') === 2 && minorUnits('USD') === 100, 'and the ordinary currencies are unchanged');
  ok(currencyOf('gbp') === 'GBP' && currencyOf(null) === 'GBP' && currencyOf('nonsense') === 'GBP', 'a currency is three letters or it is sterling');
}

console.log('\n=== §4 · ⚑ THE LINK ASKS FOR WHAT THE DOCUMENT SAYS ===');
{
  const i = inv([{ qty: 1, rate: 100 }]);
  ok(payAmount(i) === '120.00', 'the invoice comes to £120.00');
  ok(payLinkAgrees('https://paypal.me/me/120.00GBP', i).ok === true, 'a link asking for 120.00 agrees');
  const wrong = payLinkAgrees('https://paypal.me/me/100.00GBP', i);
  ok(wrong.ok === false, '⚑ a link asking for £100 against a £120 invoice is caught — the link was built from its own copy of the sum');
  ok(/asks for 100.00 but the invoice says 120.00/.test(wrong.reason), 'and it says both numbers, because on screen both look plausible');
  ok(payLinkAgrees('https://stripe.com/pay/abc', i).ok === true, 'a link carrying no amount is not a disagreement');
  ok(payLinkAgrees(null, i).ok === true, 'and neither is no link at all');
}

console.log('\n=== §5 · ⚑ A BROKEN INVOICE GETS NO PAYMENT LINK ===');
{
  const broken = inv([{ qty: 1, rate: 'abc' }]);
  ok(payAmount(broken) === null,
     '⚑ an invoice that cannot be totalled produces NO link — better none than one asking for the wrong amount');
  ok(payLinkAgrees('https://paypal.me/me/5.00', broken).ok === false, 'and a link offered anyway is refused');
  ok(totalsOf(broken).unusable.length === 1, 'the line that could not be counted is named');
  ok(totalsOf(broken).unusable[0].index === 0, 'with its position');
  ok(totalsOf(broken).complete === false, 'and the invoice knows it is incomplete');
  ok(totalsOf(inv([{ qty: 1, rate: 10 }])).complete === true, 'a clean one knows it is clean');
}

console.log('\n=== §6 · quantities and rates ===');
{
  ok(quantityOf(undefined) === 1 && quantityOf('') === 1, '⚑ no quantity means ONE — a line with a rate and no quantity is one of the thing');
  ok(quantityOf(0) === 0, 'but a quantity of zero was typed on purpose and is kept');
  ok(quantityOf('1,000') === 1000, 'a typed thousand is a thousand');
  ok(quantityOf(-1) === null && quantityOf('x') === null, 'a negative or unreadable quantity is refused');
  ok(quantityOf(2.5) === 2.5, 'and half-days are a real thing');
  ok(lineTotal({ qty: 2.5, rate: 100 }, 'GBP') === 25000, 'two and a half at £100 is £250');
  ok(lineTotal({ qty: 3, rate: 0.335 }, 'GBP') === 101,
     '⚑ 3 at £0.335 is £1.01 — a RATE is a price per unit, not money. Round it to the penny first and you get £1.02; do it in binary floats and 1.0049999… rounds DOWN to £1.00');
  ok(lineTotal({ qty: 3, rate: '0.335' }, 'GBP') === 101, 'typed or passed, the same answer');
  ok(lineTotal({ qty: 1000, rate: 0.0125 }, 'GBP') === 1250, 'a per-word rate of 1.25p over a thousand words is £12.50');
  ok(lineTotal({ rate: 50 }, 'GBP') === 5000, 'a line with no quantity is one of it');
  ok(lineTotal({ qty: 1 }, 'GBP') === 0, 'and a line with no rate is free, which is a real thing on an invoice');
  ok(lineTotal(null, 'GBP') === null,
     '⚑ a row that is not an object is NOT a free line — treating it as zero hides it inside a total that then looks correct');
}

console.log('\n=== §7 · VAT ===');
{
  ok(totalsOf(inv([{ qty: 1, rate: 100 }], { vat: 20 })).vat === 2000, '20% of £100 is £20');
  ok(totalsOf(inv([{ qty: 1, rate: 100 }], { vat: 0 })).vat === 0, 'zero-rated is zero, not missing');
  ok(totalsOf(inv([{ qty: 1, rate: 100 }], { vat: undefined })).vat === 0, 'and no rate at all means none');
  ok(vatRateOf('20%') === 20, 'a typed % sign is not a mistake');
  ok(vatRateOf(101) === null && vatRateOf(-1) === null,
     '⚑ a VAT rate above 100% or below zero is refused — it is a typo, and it would be charged');
  ok(totalsOf(inv([{ qty: 1, rate: 100 }], { vat: 200 })).complete === false, 'and an invoice carrying one is incomplete');
  ok(payAmount(inv([{ qty: 1, rate: 100 }], { vat: 200 })) === null, 'so it gets no payment link either');
  // VAT rounds once, on the rounded subtotal
  const t = totalsOf(inv([{ qty: 1, rate: 0.335 }, { qty: 1, rate: 0.335 }], { vat: 20 }));
  ok(t.subtotal === 68 && t.vat === 14 && t.total === 82, 'VAT is taken on the printed subtotal, and the three figures add up exactly');
  ok(t.subtotal + t.vat === t.total, '⚑ subtotal + VAT is ALWAYS the total, with nothing hiding in the rounding');
}

console.log('\n=== §8 · pure under garbage ===');
{
  const junk = [null, undefined, '', 0, [], {}, NaN, 'x', [null], { lines: 'no' }, { lines: [null] }, { lines: [{ qty: {} }] }];
  let threw = null;
  for (const j of junk) {
    try {
      currencyOf(j); minorUnits(j); decimalsOf(j); minor(j, j); major(j, j); quantityOf(j);
      lineTotal(j, j); vatRateOf(j); totalsOf(j, j); formatAmount(j, j); payAmount(j, j); payLinkAgrees(j, j, j);
    } catch (e) { threw = `${JSON.stringify(j)} → ${e.message}`; }
  }
  ok(threw === null, 'no input throws' + (threw ? ' — ' + threw : ''));
  ok(totalsOf(null).subtotal === 0 && totalsOf(null).total === 0, 'nothing totals to nothing, never NaN');
  ok(Number.isFinite(totalsOf({ lines: [null, 'x', { qty: 1, rate: 5 }] }).subtotal), 'and rubbish among real lines still gives a number');
  ok(totalsOf({ lines: [null, { qty: 1, rate: 5 }] }).unusable.length === 1, 'with the rubbish named');
  ok(formatAmount('x', 'GBP') === null, 'and an amount that is not one formats to nothing');
}

console.log('\n=== §9 · ⚑ WHAT EACH ROW CARRIES ===');
{
  // Every test so far checked the numbers. A row also has to say what it is FOR — an invoice line
  // with the right amount and no description is not a line anybody can approve.
  const t = totalsOf(inv([{ desc: 'Design work', qty: 2, rate: 250 }]));
  ok(t.lines[0].desc === 'Design work', '⚑ a line carries its description, not the object it came from');
  ok(t.lines[0].qty === 2 && t.lines[0].rate === 25000, 'and its quantity and rate, in minor units');
  ok(t.lines[0].total === 50000, 'and what it comes to');
  ok(totalsOf(inv([{ qty: 1, rate: 5 }])).lines[0].desc === '', 'a line with no description gets empty text, not "undefined"');

  const bad = totalsOf(inv([{ desc: 'Broken line', qty: 1, rate: 'abc' }]));
  ok(bad.unusable[0].desc === 'Broken line',
     '⚑ and a line that could NOT be counted is named by its description — "line 1 is wrong" sends nobody to the right row');
}

console.log('\n=== §10 · a discount is a negative line ===');
{
  ok(lineTotal({ qty: 1, rate: -50 }, 'GBP') === -5000,
     '⚑ a negative rate is a discount line, and its sign is kept — dropping it turns money off the bill into money on it');
  ok(lineTotal({ qty: 2, rate: '-1.50' }, 'GBP') === -300, 'typed as text too');
  const t = totalsOf(inv([{ desc: 'Work', qty: 1, rate: 100 }, { desc: 'Discount', qty: 1, rate: -20 }], { vat: 20 }));
  ok(t.subtotal === 8000 && t.vat === 1600 && t.total === 9600, 'and it comes off the subtotal before VAT is taken');
  ok(t.subtotal + t.vat === t.total, 'with the three figures still adding up exactly');
}

console.log('\n=== §11 · the edges the gate went looking for ===');
{
  ok(vatRateOf(100) === 100, '⚑ a VAT rate of exactly 100% is allowed — it is the boundary, and the boundary is a real rate');
  ok(vatRateOf(100.01) === null, 'and a hair over it is not');
  ok(vatRateOf(null) === 0, 'an explicitly empty rate is none, the same as absent');
  ok(vatRateOf(0) === 0, 'and zero-rated stays zero');

  ok(lineTotal({ qty: 1, rate: null }, 'GBP') === 0, 'an explicitly empty rate is a free line, not a broken one');
  ok(lineTotal({ qty: 1, rate: '' }, 'GBP') === 0, 'and so is an empty string');
  ok(lineTotal({ qty: 1, rate: undefined }, 'GBP') === 0, 'and an absent one');
  ok(lineTotal({ qty: 1, rate: 'abc' }, 'GBP') === null, 'but junk is refused, not treated as free');

  // a figure too large to hold exactly is refused rather than quietly approximated
  ok(lineTotal({ qty: 1, rate: '999999999999999999999' }, 'GBP') === null,
     '⚑ an amount too large to hold exactly is refused — approximating it would put a number on an invoice that nobody can reproduce');
  ok(lineTotal({ qty: 100000000, rate: '99999999.99' }, 'GBP') === null,
     '⚑ and so is a product that overflows even though BOTH ends were safe on their own — checking only the inputs, or only that the result is finite, lets it straight through');
  ok(lineTotal({ qty: 1000000, rate: '0.001' }, 'GBP') === 100000, 'while an ordinary large-but-exact line still works: a million at a tenth of a penny is £1,000');
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
