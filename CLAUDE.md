# Doña Fuego investor site

## Copywriting rules
- The site always reads as the definitive original version. Never use phrasing that reveals revision history: no "now modelled", "now includes", "updated from", "previously", "no longer", or similar. Every edit lands as if the copy was always written that way.
- Signature phrases ("No BS") appear exactly once, where they land hardest.
- Specific numbers over adjectives; projections always framed as projections.
- South African English; local retail context (Checkers, Sixty60).

## Deploy
- Work on branch claude/dona-fuego-investor-site-wn6hxj, fast-forward main to deploy (Vercel: investdonafuego.vercel.app).
- Bump the ?v= asset query on any CSS/JS change (long browser caches).
- Private dataroom link: /dataroom?key=... (hash in assets/js/dataroom.js); rotate by replacing KEY_HASH.

## Numbers
- All site figures must trace to site/downloads/Dona-Fuego-Brand-Pro-Forma.xlsx; verify workbook outputs by formula evaluation before shipping (LibreOffice recalc is broken in this environment).
