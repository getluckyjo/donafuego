'use strict';

/**
 * GET /api/dashboard?key=...
 *
 * Reads the Live Data sheet, folds it into the shape the dashboard renders and
 * hands it back as JSON. Unlike /dataroom, where the gated content ships inside
 * the HTML, nothing here reaches the browser without a valid token.
 */

const { batchGet } = require('./_lib/sheets.js');
const { build } = require('./_lib/transform.js');
const crypto = require('crypto');

/**
 * Sample mode.
 *
 * A review deployment has no sheet and no service account behind it, so it
 * serves the sample workbook instead of failing. Deliberately narrow: it needs
 * BOTH an unconfigured sheet AND a review hostname, so sample figures can never
 * surface on the investor site, whatever its configuration.
 *
 * Matching on the request's own Host means one project can serve both: add
 * donadashboard.vercel.app as a domain and that hostname shows sample data,
 * while investdonafuego.vercel.app keeps waiting for the real sheet.
 */
const REVIEW_HOSTS = ['donadashboard'];

function isReviewHost(name) {
  return REVIEW_HOSTS.some(function (h) { return String(name || '').indexOf(h) === 0; });
}

function sampleMode(req) {
  if (process.env.SHEET_ID) return false;
  return isReviewHost(req && req.headers && req.headers.host)
    || isReviewHost(process.env.VERCEL_PROJECT_PRODUCTION_URL);
}

const RANGES = [
  "'1 Checkers Emails'!A1:F400",
  "'2 Checkers Sales Out'!A1:E400",
  "'3 DC Sales In'!A1:F400",
  "'4 Cost of Sales'!A1:D40",
  "'5 Bulk Allocation'!A1:C400",
  "'6 Assumptions'!A1:D60",
];

/** Constant-time compare, so the token cannot be probed a character at a time. */
function tokenMatches(supplied, expected) {
  if (!supplied || !expected) return false;
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  const expected = process.env.DASHBOARD_TOKEN;
  const supplied = (req.query && req.query.key) || req.headers['x-dashboard-key'];

  if (!expected && !sampleMode(req)) {
    res.status(500).json({ error: 'DASHBOARD_TOKEN is not configured.' });
    return;
  }
  if (expected && !tokenMatches(supplied, expected)) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(401).json({ error: 'Unauthorised' });
    return;
  }

  if (sampleMode(req)) {
    const demo = require('./_lib/demo-data.js');
    const data = build(demo, new Date());
    data.sample = true;
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify(data));
    return;
  }

  const sheetId = process.env.SHEET_ID;
  const email = process.env.GOOGLE_SA_EMAIL;
  const privateKey = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (!sheetId || !email || !privateKey) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({ error: 'Missing SHEET_ID, GOOGLE_SA_EMAIL or GOOGLE_SA_PRIVATE_KEY.' });
    return;
  }

  try {
    const [emails, salesOut, salesIn, cogs, allocation, assumptions] =
      await batchGet(sheetId, RANGES, { email, privateKey });

    const data = build({ emails, salesOut, salesIn, cogs, allocation, assumptions }, new Date());

    // Five minutes at the edge: the sheet changes weekly, so this is plenty
    // fresh while keeping the Sheets API well clear of its quota.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify(data));
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: String((err && err.message) || err) });
  }
};
