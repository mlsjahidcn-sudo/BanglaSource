// scripts/translate-catalog.mts
//
// Backfill: translate title_zh → title_en, title_bn, description_en,
// description_bn for every active product where title_en still
// equals title_zh (the placeholder).
//
// Idempotent — products already translated are skipped. Re-running
// with the same input is free thanks to the ai_runs dedup index
// (kind='translate', source_id=products.source_id,
//  source_hash=sha256(title_zh)).
//
// Cost: ~$0.00006 per product. 166 products ≈ $0.01.
//
// Usage:
//   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/translate-catalog.mts [--limit=20] [--concurrency=4]

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local first. Top-level imports are hoisted by tsx/TS, so
// we dynamic-import the modules that read process.env at load time
// (deepseek.ts reads DEEPSEEK_API_KEY at top level).
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

const { deepseekJson, sha256 } = await import("../src/lib/deepseek");
const { getServiceRoleClient } = await import("../src/lib/supabase/server");

const argv = process.argv.slice(2);
const getArg = (k: string, def: number): number => {
  const m = argv.find((a) => a.startsWith(`--${k}=`));
  return m ? Number.parseInt(m.split("=")[1], 10) : def;
};
const LIMIT = Number.isFinite(getArg("limit", 500)) ? getArg("limit", 500) : 500;
const CONCURRENCY = Math.max(1, Math.min(8, getArg("concurrency", 4)));

const supabase = getServiceRoleClient();

type TransResult = {
  title_en: string;
  title_bn: string;
  description_en: string;
  description_bn: string;
  category_suggestion: string;
};

type TransRow = {
  id: number;
  source_id: string;
  title_zh: string;
  category: string;
  price_min_fen: number;
};

const SYSTEM = `You translate 1688.com (Chinese wholesale) product listings into English and Bengali for a Bangladesh B2B marketplace.

For each product, produce a JSON object with these fields:
- "title_en": string, ≤ 90 chars. Translate the Chinese title to natural English used by Bangladeshi importers. Drop brand codes, "新款" (new), "跨境" (cross-border), "工厂" (factory), and supplier-specific codes. Keep technical specs (TWS, ANC, USB-C, IP67, etc.) and color.
- "title_bn": string, ≤ 90 chars. Same meaning in Bengali script. Use natural Bangla for product type. Transliterate brand names phonetically (e.g. "Pro6" → "Pro6", "JBL" → "JBL"). Do not translate brand names.
- "description_en": 2-3 short sentences (≤ 280 chars total) describing what this product IS and its key selling point for a Bangladeshi buyer. No marketing fluff, no "high quality" / "best choice" / "factory price". Just facts: type, key feature, ideal use case.
- "description_bn": same content in Bengali.
- "category_suggestion": one of "gadgets|eyewear|shoes|bags|watches|beauty". Pick the closest. If the title is ambiguous, pick the one that matches how the buyer would search for it.

Output ONLY a JSON object. No prose.`;

async function translateOne(row: TransRow): Promise<{
  ok: boolean;
  costUsd: number;
  reason?: string;
  result?: TransResult;
}> {
  const userPrompt = `Category hint: ${row.category}. Title (Chinese): ${row.title_zh}. Min price (CNY fen, 100=¥1): ${row.price_min_fen}.`;

  // Compute dedup hash BEFORE the call
  const hash = await sha256(`${row.title_zh}|${row.category}`);

  // Check ai_runs cache
  const { data: cached } = await supabase
    .from("ai_runs")
    .select("output, cost_usd")
    .eq("kind", "translate")
    .eq("source_id", row.source_id)
    .eq("source_hash", hash)
    .maybeSingle();
  if (cached?.output) {
    return {
      ok: true,
      costUsd: cached.cost_usd ?? 0,
      result: cached.output as unknown as TransResult,
    };
  }

  try {
    const r = await deepseekJson<TransResult & { title_en: string; title_bn: string }>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 1500 },
    );

    // Sanity check
    if (!r.title_en || !r.title_bn) {
      return { ok: false, costUsd: r.costUsd, reason: "missing_fields" };
    }

    const result: TransResult = {
      title_en: r.title_en,
      title_bn: r.title_bn,
      description_en: r.description_en || "",
      description_bn: r.description_bn || "",
      category_suggestion: r.category_suggestion || row.category,
    };

    // Log the run
    await supabase.from("ai_runs").insert({
      kind: "translate",
      model: r.model,
      source_table: "products",
      source_id: row.source_id,
      source_hash: hash,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cost_usd: r.costUsd,
      output: result,
    });

    return { ok: true, costUsd: r.costUsd, result };
  } catch (e) {
    return { ok: false, costUsd: 0, reason: (e as Error).message };
  }
}

async function main() {
  // Use the SQL helper for fast fetch
  const { data: rows, error } = await supabase.rpc(
    "get_untranslated_products" as never,
    { limit_n: LIMIT } as never,
  );
  if (error) {
    console.error("rpc get_untranslated_products failed:", error.message);
    process.exit(1);
  }
  const list = (rows ?? []) as unknown as TransRow[];
  console.log(
    `\n[translate] ${list.length} products to translate (concurrency=${CONCURRENCY})\n`,
  );
  if (list.length === 0) {
    console.log("[translate] nothing to do");
    return;
  }

  let translated = 0;
  let cached = 0;
  let failed = 0;
  let totalCost = 0;
  let totalUpdatedCategory = 0;

  // Process with bounded concurrency using a simple worker pool
  const queue = [...list];

  async function worker(id: number) {
    while (queue.length > 0) {
      const row = queue.shift();
      if (!row) break;
      process.stdout.write(`  [w${id}] ${row.source_id} → `);
      const r = await translateOne(row);
      if (!r.ok) {
        failed += 1;
        process.stdout.write(`FAIL: ${r.reason}\n`);
        continue;
      }
      if (!r.result) {
        cached += 1;
        process.stdout.write("(cached) ?\n");
        continue;
      }

      // Update the product row
      const updates: Record<string, unknown> = {
        title_en: r.result.title_en,
        title_bn: r.result.title_bn,
        description_en: r.result.description_en || "",
        description_bn: r.result.description_bn || "",
      };
      // If the model suggests a different category, only adopt it
      // when the suggestion is in the allowed set
      const allowed = new Set([
        "gadgets",
        "eyewear",
        "shoes",
        "bags",
        "watches",
        "beauty",
      ]);
      if (
        r.result.category_suggestion &&
        allowed.has(r.result.category_suggestion) &&
        r.result.category_suggestion !== row.category
      ) {
        updates.category = r.result.category_suggestion;
        totalUpdatedCategory += 1;
      }

      const { error: updErr } = await supabase
        .from("products")
        // `updates` is `Record<string, unknown>` for incremental
        // narrowing, but the keys match the products Update shape
        // (validated above). Cast at the boundary.
        .update(updates as never)
        .eq("id", row.id);
      if (updErr) {
        failed += 1;
        process.stdout.write(`UPDATE FAIL: ${updErr.message}\n`);
        continue;
      }

      translated += 1;
      totalCost += r.costUsd;
      const bits: string[] = [];
      if (r.result.title_en) bits.push("en");
      if (r.result.title_bn) bits.push("bn");
      if (r.result.description_en) bits.push("desc-en");
      if (r.result.description_bn) bits.push("desc-bn");
      if (updates.category) bits.push(`→${updates.category}`);
      const preview = r.result.title_en.slice(0, 40);
      process.stdout.write(
        `✓ [${bits.join(",")}] "${preview}" ($${r.costUsd.toFixed(6)})\n`,
      );
    }
  }

  await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)),
  );

  console.log(`\n\n[translate] DONE`);
  console.log(`  ✓ translated:   ${translated}`);
  console.log(`  · cached:       ${cached}`);
  console.log(`  ✗ failed:       ${failed}`);
  console.log(`  → recategorized: ${totalUpdatedCategory}`);
  console.log(`  $ total cost:   $${totalCost.toFixed(6)}`);
}

main().catch((e) => {
  console.error("translate-catalog failed:", e);
  process.exit(1);
});
