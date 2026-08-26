# Doña Fuego investor site

## Copywriting rules
- The site always reads as the definitive original version. Never use phrasing that reveals revision history: no "now modelled", "now includes", "updated from", "previously", "no longer", or similar. Every edit lands as if the copy was always written that way.
- Signature phrases ("No BS") appear exactly once, where they land hardest.
- Specific numbers over adjectives; projections always framed as projections.
- South African English; local retail context (Checkers, Sixty60).

## Deploy
- Fast-forward main to deploy (Vercel: investdonafuego.vercel.app).
- Bump the ?v= asset query on any CSS/JS change (long browser caches).
- Private dataroom link: /dataroom?key=... (hash in assets/js/dataroom.js); rotate by replacing KEY_HASH.

## Numbers
- All site figures must trace to site/downloads/Dona-Fuego-Brand-Pro-Forma.xlsx; verify workbook outputs by formula evaluation before shipping (LibreOffice recalc is broken in this environment).

## Live dashboard
- `/dashboard` is private and token-gated server-side: `/api/dashboard` returns 401 without `DASHBOARD_TOKEN`. Never move cost, margin or allocation figures onto a client-gated page.
- Danielle's source of truth is the "Doña Fuego — Live Data" Google Sheet. It holds no formulas — Drive's xlsx import drops them — so all arithmetic lives in `api/_lib/transform.js`.
- Change parsing or aggregation? Run `node tools/test-transform.js` (51 checks against the real Checkers email) before shipping.
- Chart primitives are shared: `assets/js/charts.js` serves both the dataroom and the dashboard. Don't add a second SVG layer.
- Full setup and env vars: `docs/DASHBOARD.md`.
