// POST /api/admin/products/[id]/ai-regenerate
//
// Uses DeepSeek V4-Flash to rewrite the entire listing (title_en,
// title_bn, description_en, description_bn) based on the original
// Chinese title + supplier info.
//
// Idempotent on (kind='regenerate', source_id, source_hash). Saves
// the result to ai_runs. Does NOT auto-save the product — admin
// must click "Save changes" to persist.
//
// Auth: admin only.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { deepseekJson, sha256 } from "@/lib/deepseek";

const SYSTEM = `You rewrite 1688.com (Chinese wholesale) product listings for a Bangladesh B2B marketplace.

Given a Chinese title + supplier + price range, produce a JSON object with:
- "title_en": string ≤ 90 chars. Natural English a Bangladeshi importer would use. Drop brand codes, "新款", "跨境", "工厂", and supplier-specific codes. Keep technical specs (TWS, ANC, USB-C, IP67, etc.) and color.
- "title_bn": string ≤ 90 chars. Bengali transliteration of the English title. Brand names stay as Latin (Pro6, JBL, etc.).
- "description_en": 2-3 short sentences (≤ 280 chars total) describing what the product IS and its key selling point. No marketing fluff.
- "description_bn": same in Bengali.
- "tags": array of 3-6 short keyword phrases (lowercase, ≤ 24 chars each) for search/filtering. Examples: "wireless earbuds", "bluetooth 5.3", "ipx7 waterproof", "rgb lighting".

Output ONLY a valid JSON object. No prose, no markdown fences.`;

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
    .select(
      "id,source_id,title_zh,category,supplier_name,supplier_city,factory_moq",
    )
    .eq("id", productId)
    .single();
  if (prodErr || !product) {
    return NextResponse.json(
      { ok: false, error: prodErr?.message ?? "not_found" },
      { status: prodErr ? 500 : 404 },
    );
  }

  // Get the price range from price_tiers
  const { data: tiers } = await supabase
    .from("price_tiers")
    .select("price_cny_fen")
    .eq("product_id", productId)
    .order("price_cny_fen", { ascending: true })
    .limit(50);
  const pricesFen = (tiers ?? []).map(
    (t) => (t as { price_cny_fen: number }).price_cny_fen,
  );
  const minPrice = pricesFen.length > 0 ? Math.min(...pricesFen) : 0;
  const maxPrice = pricesFen.length > 0 ? Math.max(...pricesFen) : 0;

  const userPrompt = `Category: ${product.category}
Title (Chinese): ${product.title_zh}
Supplier: ${product.supplier_name}${product.supplier_city ? ` (${product.supplier_city})` : ""}
MOQ: ${product.factory_moq}
Price range: ¥${(minPrice / 100).toFixed(2)} – ¥${(maxPrice / 100).toFixed(2)} per piece`;

  const inputStr = `${product.title_zh}|${product.category}|${product.factory_moq}|${minPrice}-${maxPrice}`;
  const hash = await sha256(inputStr);

  // Cache check
  const { data: cached } = await supabase
    .from("ai_runs")
    .select("output, cost_usd")
    .eq("kind", "regenerate")
    .eq("source_id", product.source_id)
    .eq("source_hash", hash)
    .maybeSingle();
  if (cached?.output) {
    return NextResponse.json({
      ok: true,
      result: cached.output,
      cached: true,
      costUsd: cached.cost_usd ?? 0,
    });
  }

  try {
    const r = await deepseekJson<{
      title_en: string;
      title_bn: string;
      description_en: string;
      description_bn: string;
      tags: string[];
    }>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 2048 },
    );

    const result = {
      title_en: r.title_en,
      title_bn: r.title_bn,
      description_en: r.description_en || "",
      description_bn: r.description_bn || "",
      tags: Array.isArray(r.tags) ? r.tags : [],
    };

    // Log
    await supabase.from("ai_runs").insert({
      kind: "regenerate",
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
