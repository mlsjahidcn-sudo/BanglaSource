// scripts/fix-english-only-titles.mts
//
// For products where title_zh is mostly ASCII (i.e. the source
// already came in English from 1688), we still need title_bn and
// the descriptions. Just copy title_zh → title_en (no translation
// needed) and ask DeepSeek to generate only title_bn + descriptions.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

try {
  const env = readFileSync(resolve(".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const { deepseekJson, sha256 } = await import("../src/lib/deepseek");
const { getServiceRoleClient } = await import("../src/lib/supabase/server");
const supabase = getServiceRoleClient();

const SYSTEM = `You translate product titles. The English title is given as-is. Your job is to:
1. Generate a Bengali transliteration of the English title (NOT a translation; just sound it out in Bengali script).
2. Write a 2-sentence English description (≤ 280 chars) describing the product for a Bangladesh B2B buyer.
3. Write the same description in Bengali.

Return JSON with fields: title_bn, description_en, description_bn. The title_en is given and not changed.`;

const { data: rows, error } = await supabase
  .from("products")
  .select("id, source_id, title_zh, title_en, category")
  .eq("title_en", "title_zh"); // SQL: title_en IS the same as title_zh
//  ^ this is approximate — for accuracy fetch all and filter in JS

const { data: all } = await supabase
  .from("products")
  .select("id, source_id, title_zh, title_en, category, description_en, description_bn");

const needFix = (all ?? []).filter(
  (p) => p.title_en === p.title_zh || !p.title_en,
);
console.log(`Found ${needFix.length} products with title_en === title_zh`);

for (const row of needFix) {
  const userPrompt = `English title (keep as-is): ${row.title_zh}\nCategory: ${row.category}`;
  const hash = await sha256(`english-only|${row.title_zh}|${row.category}`);

  const { data: cached } = await supabase
    .from("ai_runs")
    .select("output, cost_usd")
    .eq("kind", "translate_en_only")
    .eq("source_id", row.source_id)
    .eq("source_hash", hash)
    .maybeSingle();
  let payload: { title_bn: string; description_en: string; description_bn: string };
  let cost = 0;
  if (cached?.output) {
    payload = cached.output as typeof payload;
    cost = cached.cost_usd ?? 0;
  } else {
    const r = await deepseekJson<{ title_bn: string; description_en: string; description_bn: string }>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 1200 },
    );
    payload = {
      title_bn: r.title_bn,
      description_en: r.description_en || "",
      description_bn: r.description_bn || "",
    };
    cost = r.costUsd;
    await supabase.from("ai_runs").insert({
      kind: "translate_en_only",
      model: r.model,
      source_table: "products",
      source_id: row.source_id,
      source_hash: hash,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cost_usd: r.costUsd,
      output: payload,
    });
  }

  const updates: Record<string, unknown> = {
    title_en: row.title_zh, // English title stays as-is
    title_bn: payload.title_bn,
    description_en: row.description_en || payload.description_en,
    description_bn: row.description_bn || payload.description_bn,
  };
  const { error: upErr } = await supabase
    .from("products")
    .update(updates)
    .eq("id", row.id);
  if (upErr) {
    console.log(`  ✗ id=${row.id}: ${upErr.message}`);
  } else {
    console.log(`  ✓ id=${row.id} "${row.title_zh.slice(0, 50)}..." bn="${payload.title_bn.slice(0, 30)}..." ($${cost.toFixed(6)})`);
  }
}
console.log("\nDone.");
