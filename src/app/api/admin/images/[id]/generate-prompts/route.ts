// POST /api/admin/images/[id]/generate-prompts
//
// Phase 15d: turn a product's title + description into 6 distinct
// image-generation prompts via DeepSeek V4-Flash. The prompts are
// designed for a 6-image carousel cover: different angles, use
// contexts, detail shots, and a feature/spec card. Admin can edit
// any of them in the UI before sending them all to GPT Image 2.
//
// Auth: admin only.
//
// Body:
//   {
//     n?: number (1-6, default 6),   // number of prompts to return
//     style?: "auto" | "studio" | "lifestyle" | "infographic",
//                                     // default "auto" lets DeepSeek
//                                     // mix all three across the set
//   }
//
// Response:
//   { ok: true, prompts: Array<{ index, intent, prompt }> }
//
// Notes:
//   - Reads the product from the DB (title_en / title_zh /
//     description_en / description_zh / category) so the admin
//     doesn't have to retype anything.
//   - DeepSeek V4-Flash, JSON mode, max_tokens 2048, temperature 0.7
//     (some creativity is wanted here).
//   - Each prompt is capped at 600 chars so the prompt textarea
//     in the UI stays scannable.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { deepseekChat } from "@/lib/deepseek";

const MAX_N = 6;
const DEFAULT_N = 6;
const MAX_PROMPT_CHARS = 600;

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

  const rl = rateLimit({
    key: `admin.genprompts:${clientKey(req)}`,
    capacity: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) },
      },
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

  // Body: { n, style? }
  let body: { n?: number; style?: "auto" | "studio" | "lifestyle" | "infographic" } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    /* body is optional */
  }
  const n = Math.min(Math.max(body.n ?? DEFAULT_N, 1), MAX_N);
  const style = body.style ?? "auto";

  // Load the product
  const supabase = getServiceRoleClient();
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, source_id, title_en, title_zh, title_bn, description_en, description_bn, category")
    .eq("id", productId)
    .maybeSingle();
  if (prodErr) {
    return NextResponse.json({ ok: false, error: prodErr.message }, { status: 500 });
  }
  if (!product) {
    return NextResponse.json({ ok: false, error: "product_not_found" }, { status: 404 });
  }

  // Build the prompt source — prefer EN, fall back to zh, then bn.
  // Schema has description_en + description_bn but no description_zh.
  const titleEn = (product.title_en ?? "").trim();
  const titleZh = (product.title_zh ?? "").trim();
  const titleBn = (product.title_bn ?? "").trim();
  const descEn = (product.description_en ?? "").trim();
  const descBn = (product.description_bn ?? "").trim();
  const primaryTitle = titleEn || titleZh || titleBn || "unknown product";
  const primaryDesc = descEn || descBn || "";
  const category = (product.category ?? "").trim();

  if (!primaryTitle || primaryTitle === "unknown product") {
    return NextResponse.json(
      {
        ok: false,
        error: "no_title",
        message:
          "Product has no title (en/zh/bn). Edit the listing to add a title first.",
      },
      { status: 400 },
    );
  }

  // Build the system prompt. We want exactly N distinct
  // image-generation prompts. Each one is a single sentence (or
  // tight 2-sentence pair) describing one specific shot, written
  // for an e-commerce product photo generator (GPT Image 2 via
  // apinebula.com).
  const system = `You write image-generation prompts for an e-commerce product photo pipeline (GPT Image 2). The output is a JSON array of N prompt objects. Each prompt describes ONE specific shot — varied enough that the resulting N images can serve as a 6-photo carousel cover for a B2B wholesale listing.

Input: a product title + (optional) description + (optional) category. You produce exactly N entries.

Output JSON shape (no prose, no markdown, just the JSON):
{
  "prompts": [
    { "intent": "<short verb-led label, 2-4 words, e.g. 'front hero shot'>", "prompt": "<the prompt, max 500 chars>" },
    ...
  ]
}

Required coverage across the N prompts (round-robin):
- 1x clean studio shot on a pure white background, soft natural lighting, no watermarks, no text overlays, professional ecommerce photography, 4K, sharp focus — THIS IS ALWAYS prompt[0].
- 1x close-up detail shot zooming in on the most distinctive feature (texture, stitching, material grain, logo, button, port, etc.)
- 1x in-use / lifestyle shot: the product being used in a realistic context (worn, held, on a desk, in a kitchen, etc.) — pick a context that fits the category
- 1x at-a-glance infographic-style shot: the product on a soft colored (not white) background with 3-5 short spec bullets rendered as clean text on the image (e.g. "Material: Stainless steel", "Size: 42mm", "Color: Black"). Style: minimal, modern, easy to read.
- (remaining slots): scale-comparison shot, packaging shot, alternate angle, color-variant shot — pick what makes sense for the category.

Rules:
- Each "prompt" string is ONE tight paragraph, no line breaks, max 500 chars.
- "No watermarks, no logos from other brands, no price tags" must appear in every prompt that isn't the infographic.
- For the infographic prompt, you may include placeholder text like "Bullet 1", "Bullet 2" — the model will render the actual product info; the prompt just describes the LAYOUT (e.g. "soft mint-green background, product on the left, three spec bullets on the right in a clean sans-serif font").
- "intent" labels: lowercase, 2-4 words, easy to scan. Examples: "front hero", "detail close-up", "lifestyle in use", "spec card", "scale comparison", "packaging", "alternate angle", "color variants".
- Do NOT mention "this prompt" or "this image" in the prompt text — write the prompt as if you'd give it directly to a photographer.
- If style is "studio", make all N shots white-background studio (skip the lifestyle + infographic).
- If style is "lifestyle", make all N shots in-use / scene-based (no white background).
- If style is "infographic", make all N shots spec-card style on a colored background.
- If style is "auto" (default), use the round-robin coverage above.`;

  const userPrompt = `Product title: ${primaryTitle}
${primaryDesc ? `Description: ${primaryDesc}` : ""}
${category ? `Category: ${category}` : ""}
${titleZh ? `Chinese title: ${titleZh}` : ""}

Style: ${style}
Number of prompts: ${n}

Output the JSON array now.`;

  const raw = await deepseekChat(
    [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    { jsonMode: true, temperature: 0.7, maxTokens: 2048 },
  );

  // Defensive parse
  const cleaned = raw.content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
  let parsed: { prompts?: Array<{ intent?: string; prompt?: string }> } = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        /* fall through */
      }
    }
  }

  const rawPrompts = Array.isArray(parsed.prompts) ? parsed.prompts : [];
  if (rawPrompts.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "deepseek_returned_empty",
        message:
          "DeepSeek did not return any prompts. Try a shorter title or a different style.",
        raw: cleaned.slice(0, 500),
      },
      { status: 502 },
    );
  }

  // Normalize + truncate
  const prompts = rawPrompts.slice(0, n).map((p, i) => {
    const intent = (p.intent ?? `prompt-${i + 1}`).toString().slice(0, 40);
    let prompt = (p.prompt ?? "").toString().trim();
    if (prompt.length > MAX_PROMPT_CHARS) {
      prompt = prompt.slice(0, MAX_PROMPT_CHARS - 1) + "…";
    }
    return { index: i, intent, prompt };
  });

  // If DeepSeek returned fewer than n, pad with safe fallback prompts
  // so the UI always has exactly N cards to render.
  while (prompts.length < n) {
    const i = prompts.length;
    prompts.push({
      index: i,
      intent: i === 0 ? "front hero" : `shot ${i + 1}`,
      prompt: `${primaryTitle}, clean studio product shot on a pure white background, soft natural lighting, no watermarks, no logos, no price tags, professional ecommerce photography, 4K, sharp focus`,
    });
  }

  return NextResponse.json({
    ok: true,
    product: {
      id: productId,
      source_id: product.source_id,
      title_en: titleEn || null,
      title_zh: titleZh || null,
      category: category || null,
    },
    style,
    prompts,
  });
}
