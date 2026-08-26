'use strict';

/**
 * Pure transforms behind the Doña Fuego dashboard.
 *
 * Everything here is deliberately free of network and environment access so it
 * can be exercised directly by tools/test-transform.js against the real
 * Checkers email.
 */

/** Article number -> SKU name, from the Checkers listing. */
const SKU_BY_ARTICLE = {
  '10969424': 'Margarita',
  '10969425': 'Spicy Margarita',
  '10969426': 'Paloma',
};
const SKUS = ['Margarita', 'Spicy Margarita', 'Paloma'];

/**
 * A rand amount as Checkers writes it: "R130,464", " R85,838".
 * Deliberately requires a digit straight after the R, which is what separates a
 * real value from the accounting-format zero ("R-") sitting in the column
 * beside it.
 */
// Accepts both separators seen in the wild: R130,464 and R130 464
// (South African formatting, including non-breaking spaces from HTML mail).
const MONEY_RE = /^\s*R\s*[0-9][0-9,\s\u00A0]*(\.[0-9]+)?\s*$/;
const WEEK_RE = /Last\s*Week:[^)\n]*?[-–—]\s*([0-9]{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})/i;

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const SHEET_EPOCH = Date.UTC(1899, 11, 30);

function iso(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Sheets hands back dates as serial numbers under UNFORMATTED_VALUE, but a
 * hand-typed cell can arrive as text. Accept both, reject anything else.
 */
function toISODate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && isFinite(v)) {
    return iso(new Date(SHEET_EPOCH + Math.round(v) * 86400000));
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return iso(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);       // dd/mm/yyyy, SA convention
  if (m) return iso(new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])));
  const t = Date.parse(s);
  return isNaN(t) ? null : iso(new Date(t));
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

/**
 * The email dates a week as "23rd Aug" with no year. Pick the most recent such
 * date that is not meaningfully in the future, so weeks either side of a new
 * year resolve correctly without anyone maintaining a year cell.
 */
function resolveYear(day, monthIdx, now) {
  const y = now.getUTCFullYear();
  let d = new Date(Date.UTC(y, monthIdx, day));
  if (d.getTime() - now.getTime() > 30 * 86400000) {
    d = new Date(Date.UTC(y - 1, monthIdx, day));
  }
  return d;
}

/**
 * Pull weekly till sales out of whatever has been pasted into the email tab.
 *
 * Handles both shapes a paste can take: plain text, where the article number,
 * the "R-" and the value land on three consecutive lines, and a table paste
 * from the HTML mail, where they land in three columns of one row. In both
 * cases the value is found by scanning a small window for the one cell that
 * reads as a rand amount.
 *
 * SKU lines are attributed to the nearest "Last Week:" heading above them, and
 * the first reading of a given week and SKU wins — so re-pasting a thread that
 * quotes earlier weeks is harmless.
 */
function parseCheckersEmails(grid, now = new Date()) {
  const rows = [];
  let current = null;
  const seen = new Set();

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    const joined = row.map((c) => (c === null || c === undefined ? '' : String(c))).join(' ');

    const wk = joined.match(WEEK_RE);
    if (wk) {
      const monthIdx = MONTHS[wk[2].slice(0, 3).toLowerCase()];
      if (monthIdx !== undefined) current = iso(resolveYear(+wk[1], monthIdx, now));
    }

    const first = row[0] === null || row[0] === undefined ? '' : String(row[0]);
    const article = Object.keys(SKU_BY_ARTICLE).find((a) => first.includes(a));
    if (!article || !current) continue;

    let value = null;
    for (let rr = r; rr < Math.min(r + 3, grid.length); rr++) {
      for (const cell of grid[rr] || []) {
        const s = cell === null || cell === undefined ? '' : String(cell);
        if (MONEY_RE.test(s)) {
          const n = toNumber(s);
          if (n !== null && (value === null || n > value)) value = n;
        } else if (typeof cell === 'number' && rr > r && cell > 0 && value === null) {
          value = cell;   // a table paste can hand the amount back already numeric
        }
      }
      if (value !== null) break;
    }
    if (value === null) continue;

    const key = current + '|' + SKU_BY_ARTICLE[article];
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ weekEnd: current, sku: SKU_BY_ARTICLE[article], rand: value, source: 'email' });
  }
  return rows;
}

/**
 * Locate a table by its header names rather than a fixed row, so inserting a
 * title row or an extra column upstream cannot break the read.
 */
function readTable(grid, headers) {
  if (!grid || !grid.length) return [];
  const want = headers.map((h) => h.toLowerCase());
  let headerRow = -1;
  let cols = null;

  for (let r = 0; r < Math.min(grid.length, 30); r++) {
    const row = (grid[r] || []).map((c) => String(c === null || c === undefined ? '' : c).trim().toLowerCase());
    const found = want.map((w) => row.indexOf(w));
    if (found.every((i) => i >= 0)) {
      headerRow = r;
      cols = found;
      break;
    }
  }
  if (headerRow < 0) return [];

  const out = [];
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    const rec = {};
    let any = false;
    headers.forEach((h, i) => {
      const v = row[cols[i]];
      rec[h] = v === undefined ? null : v;
      if (v !== null && v !== undefined && String(v).trim() !== '') any = true;
    });
    if (any) out.push(rec);
  }
  return out;
}

/** Read the label/value pairs on the assumptions tab, by label. */
function readLabelled(grid, label) {
  const target = label.toLowerCase();
  for (const row of grid || []) {
    for (let c = 0; c < (row || []).length - 1; c++) {
      const cell = String(row[c] === null || row[c] === undefined ? '' : row[c]).trim().toLowerCase();
      if (cell === target) {
        const v = toNumber(row[c + 1]);
        if (v !== null) return v;
      }
    }
  }
  return null;
}

function weekEndFor(isoDate) {
  // Checkers weeks run Monday-Sunday; bucket a delivery date to its Sunday.
  const d = new Date(isoDate + 'T00:00:00Z');
  const dow = d.getUTCDay();                 // 0 = Sunday
  const add = dow === 0 ? 0 : 7 - dow;
  return iso(new Date(d.getTime() + add * 86400000));
}

function monthKey(isoDate) {
  return isoDate.slice(0, 7) + '-01';
}

/**
 * Fold every feed into the single shape the dashboard renders.
 */
function build(sheets, now = new Date()) {
  const assumptions = sheets.assumptions || [];

  const shelf = {};
  for (const sku of SKUS) shelf[sku] = readLabelled(assumptions, sku);
  const haveShelf = SKUS.every((s) => shelf[s] !== null && shelf[s] > 0);

  const unitsPerCase = readLabelled(assumptions, 'units per case') || 24;
  const wholesalePerCase = readLabelled(assumptions, 'wholesale price per case, ex vat') || 744;
  const stores = readLabelled(assumptions, 'stores in checkers listing') || 360;

  // ---- Checkers till sales: parsed email, overridden by anything typed by hand
  const parsed = parseCheckersEmails(sheets.emails || [], now);
  const manual = readTable(sheets.salesOut || [], ['week_end', 'sku', 'rand_incl_vat'])
    .map((r) => ({
      weekEnd: toISODate(r.week_end),
      sku: String(r.sku || '').trim(),
      rand: toNumber(r.rand_incl_vat),
      source: 'manual',
    }))
    .filter((r) => r.weekEnd && SKUS.includes(r.sku) && r.rand !== null);

  const byKey = new Map();
  for (const r of parsed) byKey.set(r.weekEnd + '|' + r.sku, r);
  for (const r of manual) byKey.set(r.weekEnd + '|' + r.sku, r);   // typed wins

  const weekMap = new Map();
  for (const r of byKey.values()) {
    if (!weekMap.has(r.weekEnd)) {
      weekMap.set(r.weekEnd, { weekEnd: r.weekEnd, bySku: {}, rand: 0, units: null, cases: null });
    }
    const w = weekMap.get(r.weekEnd);
    w.bySku[r.sku] = (w.bySku[r.sku] || 0) + r.rand;
    w.rand += r.rand;
  }
  const salesOut = [...weekMap.values()].sort((a, b) => a.weekEnd.localeCompare(b.weekEnd));
  for (const w of salesOut) {
    if (!haveShelf) continue;
    let units = 0;
    for (const sku of SKUS) units += (w.bySku[sku] || 0) / shelf[sku];
    w.units = units;
    w.cases = units / unitsPerCase;
  }

  // ---- DC sales in
  const dcRows = readTable(sheets.salesIn || [], ['date', 'sku', 'cases', 'rand_ex_vat'])
    .map((r) => ({
      date: toISODate(r.date),
      sku: String(r.sku || '').trim(),
      cases: toNumber(r.cases),
      rand: toNumber(r.rand_ex_vat),
    }))
    .filter((r) => r.date);

  const inMap = new Map();
  for (const r of dcRows) {
    const wk = weekEndFor(r.date);
    if (!inMap.has(wk)) inMap.set(wk, { weekEnd: wk, cases: 0, rand: 0 });
    const w = inMap.get(wk);
    w.cases += r.cases || 0;
    w.rand += r.rand || 0;
  }
  const salesIn = [...inMap.values()].sort((a, b) => a.weekEnd.localeCompare(b.weekEnd));

  // ---- Sell-in vs sell-out, cumulative. The gap is stock inside Checkers.
  const weeks = [...new Set([...salesOut.map((w) => w.weekEnd), ...salesIn.map((w) => w.weekEnd)])].sort();
  let cumIn = 0;
  let cumOut = 0;
  const flow = weeks.map((wk) => {
    const o = salesOut.find((w) => w.weekEnd === wk);
    const i = salesIn.find((w) => w.weekEnd === wk);
    cumIn += i ? i.cases : 0;
    cumOut += o && o.cases !== null ? o.cases : 0;
    return {
      weekEnd: wk,
      casesIn: i ? i.cases : null,
      casesOut: o && o.cases !== null ? o.cases : null,
      randOut: o ? o.rand : null,
      randIn: i ? i.rand : null,
      inChannel: haveShelf ? cumIn - cumOut : null,
    };
  });

  // ---- Cost of sales
  const cogsRows = readTable(sheets.cogs || [], ['cost_line', 'plan_pct_of_revenue', 'actual_cost_per_case'])
    .map((r) => ({
      line: String(r.cost_line || '').trim(),
      planPct: toNumber(r.plan_pct_of_revenue),
      costPerCase: toNumber(r.actual_cost_per_case),
    }))
    .filter((r) => r.line);
  for (const r of cogsRows) {
    r.actualPct = r.costPerCase !== null && wholesalePerCase ? r.costPerCase / wholesalePerCase : null;
    r.variancePct = r.actualPct !== null && r.planPct !== null ? r.actualPct - r.planPct : null;
  }
  const costPerCase = cogsRows.reduce((s, r) => s + (r.costPerCase || 0), 0);
  const planPct = cogsRows.reduce((s, r) => s + (r.planPct || 0), 0);
  const cogs = {
    lines: cogsRows,
    costPerCase,
    actualPct: wholesalePerCase ? costPerCase / wholesalePerCase : null,
    planPct,
    grossMarginPerCase: wholesalePerCase - costPerCase,
    grossMarginPct: wholesalePerCase ? (wholesalePerCase - costPerCase) / wholesalePerCase : null,
    planGrossMarginPct: 1 - planPct,
  };

  // ---- Bulk tequila allocation
  const allocGrid = sheets.allocation || [];
  const totalLitres = readLabelled(allocGrid, 'total allocation (litres)');
  const litresPerCase = readLabelled(allocGrid, 'litres per case');
  const draws = readTable(allocGrid, ['date', 'litres_drawn'])
    .map((r) => ({ date: toISODate(r.date), litres: toNumber(r.litres_drawn) }))
    .filter((r) => r.date && r.litres !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const drawn = draws.reduce((s, r) => s + r.litres, 0);

  const recent = salesOut.slice(-4);
  const avgCasesPerWeek = recent.length && haveShelf
    ? recent.reduce((s, w) => s + (w.cases || 0), 0) / recent.length
    : null;
  const allocation = {
    totalLitres,
    litresPerCase,
    drawn,
    draws,
    remaining: totalLitres !== null ? totalLitres - drawn : null,
    casesCovered: totalLitres !== null && litresPerCase ? (totalLitres - drawn) / litresPerCase : null,
    weeksCover: totalLitres !== null && litresPerCase && avgCasesPerWeek
      ? (totalLitres - drawn) / litresPerCase / avgCasesPerWeek
      : null,
  };

  // ---- Live run rate against the pro forma plan
  const plan = readTable(assumptions, ['month', 'plan_cases'])
    .map((r) => ({ month: toISODate(r.month), planCases: toNumber(r.plan_cases) }))
    .filter((r) => r.month);

  const actualByMonth = new Map();
  for (const w of salesOut) {
    if (w.cases === null) continue;
    const k = monthKey(w.weekEnd);
    actualByMonth.set(k, (actualByMonth.get(k) || 0) + w.cases);
  }
  const inByMonth = new Map();
  for (const r of dcRows) {
    const k = monthKey(r.date);
    inByMonth.set(k, (inByMonth.get(k) || 0) + (r.cases || 0));
  }
  const planVsActual = plan.map((p) => ({
    month: p.month,
    planCases: p.planCases,
    actualCasesOut: actualByMonth.has(p.month) ? actualByMonth.get(p.month) : null,
    actualCasesIn: inByMonth.has(p.month) ? inByMonth.get(p.month) : null,
  }));

  const last = salesOut.length ? salesOut[salesOut.length - 1] : null;
  const prev = salesOut.length > 1 ? salesOut[salesOut.length - 2] : null;
  const avgRandPerWeek = recent.length
    ? recent.reduce((s, w) => s + w.rand, 0) / recent.length
    : null;

  const daysStale = last
    ? Math.floor((Date.parse(now.toISOString().slice(0, 10)) - Date.parse(last.weekEnd)) / 86400000)
    : null;

  return {
    generatedAt: now.toISOString(),
    assumptions: { shelf, haveShelf, unitsPerCase, wholesalePerCase, stores },
    kpi: {
      lastWeekEnd: last ? last.weekEnd : null,
      lastWeekRand: last ? last.rand : null,
      wowPct: last && prev && prev.rand ? (last.rand - prev.rand) / prev.rand : null,
      runRateAnnualRand: avgRandPerWeek !== null ? avgRandPerWeek * 52 : null,
      avgCasesPerWeek,
      inChannelCases: flow.length ? flow[flow.length - 1].inChannel : null,
      grossMarginPct: cogs.grossMarginPct,
      allocationRemaining: allocation.remaining,
      allocationWeeksCover: allocation.weeksCover,
      daysStale,
      stale: daysStale !== null && daysStale > 8,
    },
    salesOut,
    salesIn,
    flow,
    cogs,
    allocation,
    planVsActual,
    skus: SKUS,
  };
}

module.exports = {
  SKUS,
  SKU_BY_ARTICLE,
  parseCheckersEmails,
  readTable,
  readLabelled,
  toISODate,
  toNumber,
  weekEndFor,
  build,
};
