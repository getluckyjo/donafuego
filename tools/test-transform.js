'use strict';
/* Exercises api/_lib/transform.js against the real Checkers email FORMAT.
   Amounts are invented — this repository is public. Run: node tools/test-transform.js */
const t = require('../api/_lib/transform.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); }
}
function eq(name, actual, expected) {
  ok(name, actual === expected, 'got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected));
}
function close(name, actual, expected, tol) {
  ok(name, actual !== null && Math.abs(actual - expected) <= tol,
     'got ' + actual + ', want ~' + expected);
}

const NOW = new Date('2026-08-26T00:00:00Z');

console.log('\nparseCheckersEmails — plain-text paste (real email shape)');
const plain = [
  ['Subject: Sales (Last Week: 17th Aug - 23rd Aug)'],
  ['000000000010969424 : COOLER DONA FUEGO 250ML, MARGARITA'],
  ['R-'],
  [' R138,000'],
  ['000000000010969425 : COOLER DONA FUEGO 250ML, SPCY MARGARITA'],
  ['R-'],
  [' R99,000'],
  ['000000000010969426 : COOLER DONA FUEGO 250ML, PALOMA'],
  ['R-'],
  [' R91,000'],
];
let rows = t.parseCheckersEmails(plain, NOW);
eq('three rows', rows.length, 3);
eq('week resolves to 2026-08-23', rows[0].weekEnd, '2026-08-23');
eq('margarita value', rows[0].rand, 138000);
eq('spicy value', rows[1].rand, 99000);
eq('paloma value', rows[2].rand, 91000);
ok('R- never taken as a value', rows.every(r => r.rand > 0));

console.log('\nparseCheckersEmails — table paste from the HTML mail');
const table = [
  ['Subject: Sales (Last Week: 17th Aug - 23rd Aug)'],
  ['000000000010969424 : COOLER DONA FUEGO 250ML, MARGARITA', 'R-', ' R138,000'],
  ['000000000010969425 : COOLER DONA FUEGO 250ML, SPCY MARGARITA', 'R-', ' R99,000'],
  ['000000000010969426 : COOLER DONA FUEGO 250ML, PALOMA', 'R-', ' R91,000'],
];
rows = t.parseCheckersEmails(table, NOW);
eq('three rows', rows.length, 3);
eq('same values as plain-text', rows.map(r => r.rand).join(','), '138000,99000,91000');

console.log('\nparseCheckersEmails — a pasted thread quoting earlier weeks');
const thread = plain.concat([
  ['Subject: Sales (Last Week: 10th Aug - 16th Aug)'],
  ['000000000010969424 : COOLER DONA FUEGO 250ML, MARGARITA'], ['R-'], [' R62,000'],
  ['000000000010969425 : COOLER DONA FUEGO 250ML, SPCY MARGARITA'], ['R-'], [' R46,000'],
  ['000000000010969426 : COOLER DONA FUEGO 250ML, PALOMA'], ['R-'], [' R39,000'],
]);
rows = t.parseCheckersEmails(thread, NOW);
eq('picks up both weeks', rows.length, 6);
eq('older week dated correctly', rows[3].weekEnd, '2026-08-16');
const twice = t.parseCheckersEmails(thread.concat(thread), NOW);
eq('re-pasting the same thread changes nothing', twice.length, 6);

console.log('\nparseCheckersEmails — space-separated rands');
const spaced = [
  ['Subject: Sales (Last Week: 17th Aug - 23rd Aug)'],
  ['000000000010969424 : COOLER DONA FUEGO 250ML, MARGARITA'], ['R-'], [' R138 000'],
  ['000000000010969425 : COOLER DONA FUEGO 250ML, SPCY MARGARITA'], ['R-'], ['R99\u00A0000'],
];
rows = t.parseCheckersEmails(spaced, NOW);
eq('space separator parsed', rows.length && rows[0].rand, 138000);
eq('non-breaking space parsed', rows.length > 1 && rows[1].rand, 99000);

console.log('\nresolveYear — a week either side of new year');
const jan = [['Sales (Last Week: 28th Dec - 3rd Jan)'],
             ['000000000010969424 : X'], [' R1,000']];
eq('early-Jan week takes the new year',
   t.parseCheckersEmails(jan, new Date('2027-01-05T00:00:00Z'))[0].weekEnd, '2027-01-03');
const dec = [['Sales (Last Week: 21st Dec - 27th Dec)'],
             ['000000000010969424 : X'], [' R1,000']];
eq('late-Dec week does not jump forward a year',
   t.parseCheckersEmails(dec, new Date('2027-01-05T00:00:00Z'))[0].weekEnd, '2026-12-27');

console.log('\nweekEndFor — deliveries bucket to their Sunday');
eq('Monday  -> Sunday', t.weekEndFor('2026-08-17'), '2026-08-23');
eq('Sunday  -> itself',  t.weekEndFor('2026-08-23'), '2026-08-23');

console.log('\ntoNumber / toISODate');
eq('rand string', t.toNumber('R138,000'), 138000);
eq('accounting zero is not a number', t.toNumber('R-'), null);
eq('sheets serial -> date', t.toISODate(46257), '2026-08-23');
eq('iso passthrough', t.toISODate('2026-08-09'), '2026-08-09');

console.log('\nbuild — full pipeline on the three real weeks');
const sheets = {
  emails: thread,
  salesOut: [
    ['Checkers till sales — typed in by hand'], [],
    ['week_end', 'sku', 'rand_incl_vat'],
    ['2026-08-09', 'Margarita', 12500],
    ['2026-08-09', 'Spicy Margarita', 8000],
    ['2026-08-09', 'Paloma', 8500],
  ],
  salesIn: [
    ['date', 'order_ref', 'sku', 'cases', 'rand_ex_vat', 'notes'],
    ['2026-08-03', 'PO1', 'Margarita', 1080, 803520, ''],
    ['2026-08-03', 'PO1', 'Spicy Margarita', 1080, 803520, ''],
    ['2026-08-03', 'PO1', 'Paloma', 1080, 803520, ''],
  ],
  cogs: [
    ['cost_line', 'plan_pct_of_revenue', 'actual_cost_per_case'],
    ['Tequila (allocation)', 0.18, 133.92],
    ['Additional wet goods', 0.10, 74.40],
    ['Packaging (cans, printing, pallets)', 0.135, 100.44],
    ['Co-pack production', 0.1204, 89.58],
    ['Distribution (Chep + provlog)', 0.04, 29.76],
    ['SARS excise', 0.185, 137.64],
  ],
  allocation: [
    ['Total allocation (litres)', 50000],
    ['Litres per case', 6],
    ['date', 'litres_drawn', 'reference'],
    ['2026-07-15', 12000, 'first draw'],
  ],
  assumptions: [
    ['Checkers shelf price, incl VAT (per 250ml can)'],
    ['Margarita', 42.25], ['Spicy Margarita', 42.25], ['Paloma', 42.25],
    ['Units per case', 24],
    ['Wholesale price per case, ex VAT', 744],
    ['Stores in Checkers listing', 360],
    ['month', 'plan_cases'],
    ['2026-08-01', 3240], ['2026-09-01', 0], ['2026-10-01', 1260],
  ],
};
const d = t.build(sheets, NOW);

eq('three weeks of sell-out', d.salesOut.length, 3);
eq('weeks in order', d.salesOut.map(w => w.weekEnd).join(','), '2026-08-09,2026-08-16,2026-08-23');
eq('week 1 total  R29,000', Math.round(d.salesOut[0].rand), 29000);
eq('week 2 total  R147,000', Math.round(d.salesOut[1].rand), 147000);
eq('week 3 total  R328,000', Math.round(d.salesOut[2].rand), 328000);
eq('latest week is the KPI week', d.kpi.lastWeekEnd, '2026-08-23');
close('week-on-week +123%', d.kpi.wowPct, 1.2313, 0.001);
close('cases in the latest week', d.salesOut[2].cases, 328000 / 42.25 / 24, 0.01);
eq('shelf prices present', d.assumptions.haveShelf, true);

close('cost per case', d.cogs.costPerCase, 565.74, 0.01);
close('plan COGS ratio 76.04%', d.cogs.planPct, 0.7604, 0.0001);
close('gross margin ~24%', d.cogs.grossMarginPct, 1 - 565.74 / 744, 0.0001);

eq('allocation drawn', d.allocation.drawn, 12000);
eq('allocation remaining', d.allocation.remaining, 38000);
ok('weeks of cover computed', d.allocation.weeksCover > 0);

eq('sell-in bucketed to a week', d.salesIn.length, 1);
eq('sell-in week', d.salesIn[0].weekEnd, '2026-08-09');
eq('sell-in cases', d.salesIn[0].cases, 3240);
ok('stock still sitting in the Checkers system', d.kpi.inChannelCases > 0);

eq('plan rows carried through', d.planVsActual.length, 3);
eq('August plan is the initial fill', d.planVsActual[0].planCases, 3240);
ok('August actual sell-out recorded', d.planVsActual[0].actualCasesOut > 0);

console.log('\nbuild — degrades cleanly with nothing filled in');
const empty = t.build({ emails: [], salesOut: [], salesIn: [], cogs: [], allocation: [], assumptions: [] }, NOW);
eq('no weeks', empty.salesOut.length, 0);
eq('no KPI week', empty.kpi.lastWeekEnd, null);
eq('allocation unknown', empty.allocation.remaining, null);
ok('still returns a usable object', typeof empty.kpi === 'object');

console.log('\nbuild — no shelf prices yet: rand still works, cases stay null');
const noShelf = JSON.parse(JSON.stringify(sheets));
noShelf.assumptions = noShelf.assumptions.filter(r => !['Margarita','Spicy Margarita','Paloma'].includes(r[0]));
const ns = t.build(noShelf, NOW);
eq('rand still totalled', Math.round(ns.salesOut[2].rand), 328000);
eq('cases withheld', ns.salesOut[2].cases, null);
eq('flagged as missing', ns.assumptions.haveShelf, false);

console.log('\nbuild — manual entry overrides a parsed week');
const override = JSON.parse(JSON.stringify(sheets));
override.salesOut.push(['2026-08-23', 'Margarita', 999]);
const ov = t.build(override, NOW);
eq('typed value wins', ov.salesOut[2].bySku['Margarita'], 999);

console.log('\n' + (fail ? 'FAILED ' + fail + ' of ' + (pass + fail) : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
