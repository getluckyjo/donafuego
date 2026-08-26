'use strict';
/* Local harness: serves site/ and /api/dashboard with the real handler,
   backed by fixture sheet data instead of Google. Run: node tools/dev-server.js */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'site');
const PORT = process.env.PORT || 4321;
process.env.DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || 'local-dev-key';
process.env.SHEET_ID = 'fixture';
process.env.GOOGLE_SA_EMAIL = 'fixture@example.com';
process.env.GOOGLE_SA_PRIVATE_KEY = 'fixture';

// Stand in for Google before the handler pulls the module in.
const sheets = require('../api/_lib/sheets.js');
const fixture = require('./fixture-sheets.js');
sheets.batchGet = async () => [
  fixture.emails, fixture.salesOut, fixture.salesIn,
  fixture.cogs, fixture.allocation, fixture.assumptions,
];
const handler = require('../api/dashboard.js');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.woff2': 'font/woff2',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/dashboard') {
    const q = {}; url.searchParams.forEach((v, k) => { q[k] = v; });
    return handler({ query: q, headers: req.headers }, {
      setHeader: (k, v) => res.setHeader(k, v),
      status(c) { res.statusCode = c; return this; },
      json(o) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return this; },
      send(s) { res.end(s); return this; },
    });
  }

  if (pathname === '/') pathname = '/index.html';
  let file = path.join(ROOT, pathname);
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';   // cleanUrls
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404; res.end('not found'); return;
  }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
}).listen(PORT, () => console.log('dev server on http://localhost:' + PORT));
