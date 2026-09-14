# Fuego On Demand — Meta Ads Advisor

A read-only weekly check-in for the campaign in `Fuego On Demand`: pulls ad-set
performance from the Meta Marketing API, adds this week's Sixty60 order count
(logged by hand — Meta can't see those), and asks Claude for a scale/hold/kill
call on each ad set against the brief's KPI targets.

**It never touches Meta.** No pausing, no budget changes, no writes — every
recommendation is something you read and execute yourself in Ads Manager.
That's deliberate: worth automating writes only once you trust the calls,
which takes more than one week's data.

## Setup

```bash
npm install
cp .env.example .env
cp orders.example.json orders.json
```

Fill in `.env`:

- `META_ACCESS_TOKEN` — a long-lived System User token with `ads_read` on the
  account (Business Settings > Users > System Users). A personal user token
  works too but expires in ~60 days and you'll have to keep replacing it.
- `META_AD_ACCOUNT_ID` — the numeric id from the Ads Manager account
  dropdown, without the `act_` prefix.
- `ANTHROPIC_API_KEY` — or leave blank if you're logged in locally via
  `ant auth login`.

Fill in `orders.json` each week with the actual order count from the
Sixty60/Checkers seller dashboard for the same window — this is the one
number Meta genuinely cannot see, and without it Claude will flag orders and
ROAS as unknown rather than guess.

## Run

```bash
npm start
```

Prints a report to the terminal and saves a copy to `reports/<date>.json`
(git-ignored — these hold real spend and sales figures).

## What it checks

The targets in `advisor.mjs` mirror the campaign brief:

- Link CTR ≥ 1.2%
- Click-to-order conversion ≥ 4%
- Break-even ≈ 80 orders/month (≈18/week) at a ~R100 blended AOV
- Direct ROAS ≥ 1.5× by month 3 — month 1 is expected to run below this

Update these in `CAMPAIGN_TARGETS` if the brief changes.

## When to go beyond read-only

Once you've got a few weeks of data and trust the recommendations, the
natural next step is letting Claude actually pause an underperforming ad set
or shift budget — that needs a Meta app review and tighter guardrails
(a spend ceiling, a human approval step) and is a deliberate escalation, not
a default.
