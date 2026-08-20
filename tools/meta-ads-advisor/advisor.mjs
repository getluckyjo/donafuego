// Fuego On Demand — weekly Meta Ads advisor.
//
// Read-only: pulls ad-set-level insights from the Meta Marketing API,
// combines them with a manually logged Sixty60 order count (Meta can't see
// those), and asks Claude for a scale/hold/kill recommendation per ad set.
// It never writes back to Meta — every action is something a human executes
// in Ads Manager.
//
// Usage: npm install && npm start

import "dotenv/config";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

const __dirname = dirname(fileURLToPath(import.meta.url));

const {
  META_ACCESS_TOKEN,
  META_AD_ACCOUNT_ID,
  META_API_VERSION = "v21.0",
  META_DATE_PRESET = "last_7d",
} = process.env;

// --- KPI targets, pulled from the Fuego On Demand campaign brief ---------
const CAMPAIGN_TARGETS = {
  linkCtrTargetPct: 1.2,
  clickToOrderConversionTargetPct: 4,
  breakEvenOrdersPerMonth: 80,
  breakEvenOrdersPerWeek: 18, // 80 / ~4.3 weeks, rounded up
  blendedAovZar: 100,
  directRoasTargetMonth3Plus: 1.5,
};

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing ${name} — copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

async function fetchAdSetInsights() {
  const token = requireEnv("META_ACCESS_TOKEN", META_ACCESS_TOKEN);
  const accountId = requireEnv("META_AD_ACCOUNT_ID", META_AD_ACCOUNT_ID);

  const fields = [
    "adset_name",
    "spend",
    "impressions",
    "reach",
    "clicks",
    "ctr",
    "cpc",
    "inline_link_clicks",
    "cost_per_inline_link_click",
    "actions",
  ].join(",");

  const url = new URL(
    `https://graph.facebook.com/${META_API_VERSION}/act_${accountId}/insights`,
  );
  url.searchParams.set("level", "adset");
  url.searchParams.set("date_preset", META_DATE_PRESET);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", token);

  const res = await fetch(url);
  const body = await res.json();

  if (!res.ok || body.error) {
    const message = body?.error?.message ?? res.statusText;
    throw new Error(`Meta Insights API error: ${message}`);
  }

  return (body.data ?? []).map((row) => ({
    adSetName: row.adset_name,
    spendZar: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    reach: Number(row.reach ?? 0),
    clicks: Number(row.clicks ?? 0),
    ctrPct: Number(row.ctr ?? 0),
    cpcZar: Number(row.cpc ?? 0),
    linkClicks: Number(row.inline_link_clicks ?? 0),
    costPerLinkClickZar: Number(row.cost_per_inline_link_click ?? 0),
  }));
}

async function loadManualOrders() {
  const path = join(__dirname, "orders.json");
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.orders) return null;
    return parsed;
  } catch {
    console.warn(
      "No orders.json found (copy orders.example.json and fill in this week's Sixty60 order count) — recommendations will be based on ad-side metrics only.",
    );
    return null;
  }
}

const RecommendationSchema = z.object({
  period: z.string().describe("The date range this recommendation covers"),
  overall_verdict: z.enum([
    "ahead_of_target",
    "on_track",
    "below_target",
    "insufficient_data",
  ]),
  summary: z
    .string()
    .describe("2-3 sentence plain-English summary for a founder skimming on their phone"),
  ad_sets: z.array(
    z.object({
      name: z.string(),
      action: z.enum(["scale", "hold", "watch", "kill"]),
      reason: z.string().describe("One sentence — the specific number that drove this call"),
    }),
  ),
  kpi_flags: z
    .array(z.string())
    .describe("Any KPI target that was missed this period, stated with the actual vs. target number — empty array if none"),
  next_week_focus: z.string().describe("The single highest-leverage thing to change or check next"),
});

async function getRecommendation({ adSets, orders, targets }) {
  const client = new Anthropic();

  const system = `You are a media-buying advisor for Doña Fuego's "Fuego On Demand" Instagram campaign — a R10,000/month push (R8,000 paid media) driving margarita and paloma orders to Checkers Sixty60 for delivery inside 60 minutes.

Two ad angles run always-on:
- Margarita — "To your door in 60 min" — weekend/braai occasion, Thu-Sat
- Paloma — "On demand — order now" — weekday sundowner, 17:00-19:00

KPI targets from the campaign brief:
- Link CTR >= ${targets.linkCtrTargetPct}%
- Click-to-order conversion >= ${targets.clickToOrderConversionTargetPct}%
- Break-even orders ~${targets.breakEvenOrdersPerMonth}/month (~${targets.breakEvenOrdersPerWeek}/week) at a blended AOV of ~R${targets.blendedAovZar}
- Direct ROAS target 1.5x+ by month 3 (month 1 is expected to run below this while the funnel calibrates)

Give a specific, numbers-first recommendation per ad set: scale, hold, watch, or kill. Reason from the actual figures given, not from general best practice. If Sixty60 order data wasn't provided, say so plainly in kpi_flags rather than guessing at orders or ROAS.`;

  const userPayload = {
    date_range: META_DATE_PRESET,
    ad_set_insights: adSets,
    sixty60_orders: orders,
  };

  const response = await client.beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4000,
    system,
    messages: [
      {
        role: "user",
        content: `Here is this period's data:\n\n${JSON.stringify(userPayload, null, 2)}`,
      },
    ],
    output_format: betaZodOutputFormat(RecommendationSchema),
  });

  if (!response.parsed) {
    throw new Error("Claude's response didn't parse against the recommendation schema.");
  }
  return response.parsed;
}

function printReport(rec, adSets) {
  const line = "─".repeat(60);
  console.log(`\n${line}\nFUEGO ON DEMAND — WEEKLY AD REPORT (${rec.period})\n${line}`);
  console.log(`\nVerdict: ${rec.overall_verdict.replace(/_/g, " ").toUpperCase()}\n`);
  console.log(rec.summary);

  console.log(`\nAd sets:`);
  for (const adSet of rec.ad_sets) {
    const raw = adSets.find((a) => a.adSetName === adSet.name);
    const stats = raw
      ? ` (spend R${raw.spendZar.toFixed(0)}, CTR ${raw.ctrPct.toFixed(2)}%, ${raw.linkClicks} link clicks)`
      : "";
    console.log(`  [${adSet.action.toUpperCase()}] ${adSet.name}${stats}`);
    console.log(`    ${adSet.reason}`);
  }

  if (rec.kpi_flags.length > 0) {
    console.log(`\nKPI flags:`);
    for (const flag of rec.kpi_flags) console.log(`  - ${flag}`);
  }

  console.log(`\nNext week's focus: ${rec.next_week_focus}\n${line}\n`);
}

async function saveReport(rec) {
  const dir = join(__dirname, "reports");
  await mkdir(dir, { recursive: true });
  const filename = `${new Date().toISOString().slice(0, 10)}.json`;
  await writeFile(join(dir, filename), JSON.stringify(rec, null, 2));
  console.log(`Saved to reports/${filename}`);
}

async function main() {
  console.log(`Pulling Meta Ads insights (${META_DATE_PRESET})...`);
  const adSets = await fetchAdSetInsights();

  if (adSets.length === 0) {
    console.log("No ad set activity in this window — nothing to recommend on yet.");
    return;
  }

  const orders = await loadManualOrders();
  console.log("Asking Claude for a recommendation...");
  const rec = await getRecommendation({ adSets, orders, targets: CAMPAIGN_TARGETS });

  printReport(rec, adSets);
  await saveReport(rec);
}

main().catch((err) => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
