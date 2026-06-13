// POST /api/admin/products/[id]/ai-translate
//
// Translate ONLY the title (English + Bengali). Doesn't touch
// description. Useful when the descriptions are already good and
// you just need a fresh title.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { deepseekJson, sha256 } from "@/lib/deepseek";

const SYSTEM = `Translate a Chinese product title to natural English and Bengali for a Bangladesh B2B marketplace.

Output JSON with fields:
- "title_en": ≤ 90 chars. English title a Bangladeshi importer would use. Drop "新款" (new), "跨境" (cross-border), "工厂" (factory), supplier-specific codes. Keep technical specs and brand names.
- "title_bn": ≤ 90 chars. Bengali transliteration (sound-it-out, NOT translate literally). Brand names stay as Latin.

No prose, no markdown fences. JSON only.`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status },
    );
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "deepseek_not_configured" },
      { status: 503 },
    );
  }

  const { id: idStr } = await params;
  const productId = Number.parseInt(idStr, 10);
  if (!Number.isFinite(productId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_id" },
      { status: 400 },
    );
  }

  const supabase = getServiceRoleClient();
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id,source_id,title_zh,category")
    .eq("id", productId)
    .single();
  if (prodErr || !product) {
    return NextResponse.json(
      { ok: false, error: prodErr?.message ?? "not_found" },
      { status: prodErr ? 500 : 404 },
    );
  }

  const userPrompt = `Category: ${product.category}\nTitle (Chinese): ${product.title_zh}`;
  const hash = await sha256(`translate|${product.title_zh}|${product.category}`);

  const { data: cached } = await supabase
    .from("ai_runs")
    .select("output, cost_usd")
    .eq("kind", "translate")
    .eq("source_id", product.source_id)
    .eq("source_hash", hash)
    .maybeSingle();
  if (cached?.output) {
    const c = cached.output as { title_en: string; title_bn: string };
    return NextResponse.json({
      ok: true,
      result: { title_en: c.title_en, title_bn: c.title_bn },
      cached: true,
      costUsd: cached.cost_usd ?? 0,
    });
  }

  try {
    const r = await deepseekJson<{ title_en: string; title_bn: string }>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 1024 },
    );

    const result = { title_en: r.title_en, title_bn: r.title_bn };

    await supabase.from("ai_runs").insert({
      kind: "translate",
      model: r.model,
      source_table: "products",
      source_id: product.source_id,
      source_hash: hash,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cost_usd: r.costUsd,
      output: result,
    });

    return NextResponse.json({
      ok: true,
      result,
      cached: false,
      costUsd: r.costUsd,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
