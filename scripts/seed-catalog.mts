// scripts/seed-catalog.mts
//
// One-shot seed: run 1688 discovery on 14 keywords (2 per category
// matching the original 21-mock catalog), auto-import every
// discovery that passes a quality gate via autoImportOrQueue().
//
// Usage:
//   pnpm tsx scripts/seed-catalog.mts
//
// Reads APIFY_TOKEN, NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY from .env.local.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local
try {
  const envLocal = readFileSync(resolve(".env.local"), "utf8");
  for (const line of envLocal.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // no .env.local; rely on system env
}

import { createClient as createSupabase } from "@supabase/supabase-js";
import { startRun, pollRun, fetchDataset } from "../src/lib/ingest/apify";
import { type ApifyProduct } from "../src/lib/ingest/1688";
import { autoImportOrQueue } from "../src/lib/ingest/auto-import";

// ── Keyword plan: 2 per category, matching the original 21-mock catalog
const KEYWORDS: Record<string, string[]> = {
  apparel: [
    "ice silk hijab muslim women scarf",
    "cotton kurti for women long",
  ],
  electronics: [
    "tws wireless bluetooth earbuds",
    "iphone 15 transparent magsafe case",
  ],
  home: [
    "led smart bulb rgb bluetooth",
    "kitchen storage container plastic",
  ],
  beauty: [
    "aloe vera moisturizing facial spray",
    "electric eyelash curler usb",
  ],
  toys: [
    "children diy clay tools",
    "color gel pens student set",
  ],
  automotive: [
    "motorcycle phone holder waterproof",
    "car phone charger dual usb",
  ],
};

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createSupabase(url, key, { auth: { persistSession: false } });
}

async function main() {
  const supabase = db();
  const totalKeywords = Object.values(KEYWORDS).flat().length;
  console.log(
    `\n[seed] ${totalKeywords} keywords across ${Object.keys(KEYWORDS).length} categories\n`,
  );

  // Open a sync_run for the whole seed
  const { data: runRow } = await supabase
    .from("sync_runs")
    .insert({
      source: "apify-1688-scraper",
      trigger: "seed-script",
      metadata: { keywords: Object.values(KEYWORDS).flat(), mode: "seed" },
    })
    .select("id")
    .single();
  const syncRunId = (runRow?.id ??
    "00000000-0000-0000-0000-000000000000") as string;

  let totalRuns = 0;
  let totalApiCost = 0;
  let totalSeen = 0;
  let imported = 0;
  let queued = 0;
  let duplicates = 0;
  let errors = 0;
  const reviewQueue: Array<{
    offer_id: string;
    title: string;
    reason: string;
  }> = [];

  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    console.log(
      `\n[seed] category: ${category} (${keywords.length} keywords)`,
    );
    for (const keyword of keywords) {
      console.log(`  → Apify run for: "${keyword}"`);
      let runId: string;
      let datasetId: string | null;
      try {
        const started = await startRun({
          mode: "by-keyword",
          keywords: [keyword],
          maxResults: 12,
          tieredPrices: true,
        });
        runId = started.runId;
        datasetId = started.datasetId;
      } catch (e) {
        console.error(`  startRun failed:`, (e as Error).message);
        continue;
      }

      const result = await pollRun(runId, { timeoutMs: 180_000 });
      totalRuns += 1;
      totalApiCost +=
        result.computeUnits * 0.004 + 0.0005; // compute + per-run start
      if (result.status !== "SUCCEEDED" || !datasetId) {
        console.warn(`  run ${runId} → ${result.status}`);
        continue;
      }
      const items = await fetchDataset<ApifyProduct>(datasetId);
      totalApiCost += items.length * 0.00499;
      totalSeen += items.length;
      console.log(
        `  ${items.length} items, $${(items.length * 0.00499).toFixed(4)} Apify`,
      );

      for (const item of items) {
        if (!item.offerId) continue;
        const r = await autoImportOrQueue(item, syncRunId, keyword, category);
        if (r.outcome === "imported") {
          imported += 1;
          console.log(
            `    ✓ ${item.offerId} → ${item.title?.slice(0, 40) ?? ""}…`,
          );
        } else if (r.outcome === "duplicate") {
          duplicates += 1;
          console.log(`    · ${item.offerId} dup`);
        } else if (r.outcome === "queued_for_review") {
          queued += 1;
          reviewQueue.push({
            offer_id: r.offer_id,
            title: item.title?.slice(0, 40) ?? "(no title)",
            reason: r.reason ?? "unknown",
          });
          console.log(
            `    ⚠ ${item.offerId} → review (${r.reason ?? "?"})`,
          );
        } else {
          errors += 1;
          console.log(`    ✗ ${item.offerId} → error: ${r.reason}`);
        }
      }
    }
  }

  // Close out the sync_run
  await supabase
    .from("sync_runs")
    .update({
      finished_at: new Date().toISOString(),
      products_seen: totalSeen,
      products_added: imported,
      api_cost_usd: Number(totalApiCost.toFixed(4)),
      metadata: {
        mode: "seed",
        imported,
        queued_for_review: queued,
        duplicates,
        errors,
        apify_runs: totalRuns,
      },
    })
    .eq("id", syncRunId);

  console.log(`\n\n[seed] DONE`);
  console.log(`  Apify runs:           ${totalRuns}`);
  console.log(`  Total Apify cost:     $${totalApiCost.toFixed(4)}`);
  console.log(`  Items seen:            ${totalSeen}`);
  console.log(`  ✓ auto-imported:      ${imported}`);
  console.log(`  ⚠ needs review:       ${queued}`);
  console.log(`  · duplicates:         ${duplicates}`);
  console.log(`  ✗ errors:              ${errors}`);
  console.log(`  sync_run:             ${syncRunId}`);

  if (reviewQueue.length > 0) {
    console.log(`\n  First 10 review-queue items:`);
    for (const r of reviewQueue.slice(0, 10)) {
      console.log(`    ${r.offer_id} — ${r.title} (${r.reason})`);
    }
  }
}

main().catch((e) => {
  console.error("seed failed:", e);
  process.exit(1);
});
