'use strict';
/* Sample data standing in for the Live Data sheet, used by the review
   deployment and by the local dev server and tests.
   
   EVERY FIGURE HERE IS INVENTED. It is shaped like a launch ramp so the charts
   read correctly, but no real number belongs in this file: this repository is
   public, and the review deployment serves it without authentication. Real
   Checkers sell-through reaches the dashboard only through the Live Data
   sheet, behind the token gate. */
const emailWeek = (heading, m, s, p) => [
  [heading],
  ['000000000010969424 : COOLER DONA FUEGO 250ML, MARGARITA'], ['R-'], [' R' + m.toLocaleString('en-US')],
  ['000000000010969425 : COOLER DONA FUEGO 250ML, SPCY MARGARITA'], ['R-'], [' R' + s.toLocaleString('en-US')],
  ['000000000010969426 : COOLER DONA FUEGO 250ML, PALOMA'], ['R-'], [' R' + p.toLocaleString('en-US')],
  [''],
];

module.exports = {
  emails: [
    ['Checkers till sales — paste the weekly email here'], [], ['Paste below this line'],
  ].concat(
    emailWeek('Subject: Sales (Last Week: 17th Aug - 23rd Aug)', 138000, 99000, 91000),
    emailWeek('Subject: Sales (Last Week: 10th Aug - 16th Aug)', 62000, 46000, 39000),
  ),
  salesOut: [
    ['Checkers till sales — typed in by hand'], [],
    ['week_end', 'sku', 'rand_incl_vat'],
    ['2026-08-09', 'Margarita', 12500],
    ['2026-08-09', 'Spicy Margarita', 8000],
    ['2026-08-09', 'Paloma', 8500],
  ],
  salesIn: [
    ['DC sales in'], [],
    ['date', 'order_ref', 'sku', 'cases', 'rand_ex_vat', 'notes'],
    ['2026-08-03', 'PO-1001', 'Margarita', 1080, 803520, 'Opening order'],
    ['2026-08-03', 'PO-1001', 'Spicy Margarita', 1080, 803520, 'Opening order'],
    ['2026-08-03', 'PO-1001', 'Paloma', 1080, 803520, 'Opening order'],
    ['2026-08-17', 'PO-1042', 'Margarita', 240, 178560, 'Replen'],
    ['2026-08-17', 'PO-1042', 'Spicy Margarita', 180, 133920, 'Replen'],
    ['2026-08-17', 'PO-1042', 'Paloma', 160, 119040, 'Replen'],
  ],
  cogs: [
    ['Cost of sales'], [],
    ['cost_line', 'plan_pct_of_revenue', 'actual_cost_per_case'],
    ['Tequila (allocation)', 0.18, 133.92],
    ['Additional wet goods', 0.10, 78.20],
    ['Packaging (cans, printing, pallets)', 0.135, 100.44],
    ['Co-pack production', 0.1204, 89.58],
    ['Distribution (Chep + provlog)', 0.04, 31.10],
    ['SARS excise', 0.185, 137.64],
  ],
  allocation: [
    ['Bulk tequila allocation'], [],
    ['Total allocation (litres)', 48000],
    ['Litres per case', 6],
    [],
    ['date', 'litres_drawn', 'reference'],
    ['2026-07-10', 19440, 'Opening production run'],
    ['2026-08-14', 3480, 'Replen run'],
  ],
  assumptions: [
    ['Assumptions'], [],
    ['Checkers shelf price, incl VAT (per 250ml can)'],
    ['Margarita', 42.25], ['Spicy Margarita', 42.25], ['Paloma', 42.25],
    [],
    ['Units per case', 24],
    ['Wholesale price per case, ex VAT', 744],
    ['VAT rate', 0.15],
    ['Stores in Checkers listing', 360],
    [],
    ['month', 'plan_cases', 'note'],
    ['2026-08-01', 3240, 'Initial fill'],
    ['2026-09-01', 0, 'No delivery'],
    ['2026-10-01', 1260, 'Restock'],
    ['2026-11-01', 1109, 'Summer'],
    ['2026-12-01', 1109, 'Summer'],
    ['2027-01-01', 1109, 'Summer'],
    ['2027-02-01', 1109, 'Summer'],
    ['2027-03-01', 1109, 'Summer'],
  ],
};
