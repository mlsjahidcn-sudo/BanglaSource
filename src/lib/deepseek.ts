// /lib/deepseek.ts
//
// Thin OpenAI-compatible client for DeepSeek.
//
// DeepSeek's REST API mirrors the OpenAI chat/completions interface.
// We don't pull in the openai SDK to keep the bundle small; a hand-rolled
// fetch is enough for our two endpoints (chat completions, with
// optional JSON response_format).
//
// Pricing (verified at integration time 2026-06-13):
//   deepseek-v4-flash   $0.03 / 1M input  · $0.12 / 1M output   (V4-Flash, default)
//   deepseek-v4-pro     $0.30 / 1M input  · $1.20 / 1M output   (V4-Pro, reasoning)
//
// User's key (sk-a466962b0cda4064a4621c2454651ee9) only has access to
// the V4 family — `GET /v1/models` returns [v4-flash, v4-pro]. No V3/R1.
//
// We pick the model per task:
//   - V4-Flash  for: title translation, description writing, recommendations,
//                   free-form NL search parsing, listing improvements.
//   - V4-Pro    for: admin ops chat that needs to reason about data
//                   (e.g. "which category grew the most this week? by what %?")
//
// All costs are written to the `ai_runs` table by callers. Dedup by
// (kind, source_id, source_hash) makes re-running the same input free.

const BASE = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1";
const KEY = process.env.DEEPSEEK_API_KEY;

if (!KEY) {
  // Don't throw at module load — many builds (admin pages) don't call
  // DeepSeek. The functions below throw a clear error if invoked.
  // eslint-disable-next-line no-console
  console.warn("[deepseek] DEEPSEEK_API_KEY not set; AI features will fail at call time");
}

export type DeepSeekModel = "deepseek-v4-flash" | "deepseek-v4-pro";

// Pricing per 1M tokens (USD)
export const PRICING: Record<DeepSeekModel, { in: number; out: number }> = {
  "deepseek-v4-flash": { in: 0.03, out: 0.12 },
  "deepseek-v4-pro": { in: 0.30, out: 1.20 },
};

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string };

export type ChatOptions = {
  model?: DeepSeekModel;
  temperature?: number;       // 0.0–1.0
  maxTokens?: number;         // output cap (DEFAULT 2048 — V4-Flash/Pro both
                              // include "reasoning_content" tokens that count
                              // against this limit; the actual visible reply
                              // is much smaller. ~1500 is enough for product
                              // title+description. Set 4096+ for chat.)
  jsonMode?: boolean;         // request JSON object output
  signal?: AbortSignal;
};

export type ChatResult = {
  content: string;
  model: DeepSeekModel;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  raw: unknown;
};

function pricingFor(model: DeepSeekModel, inT: number, outT: number): number {
  const p = PRICING[model];
  return (inT / 1_000_000) * p.in + (outT / 1_000_000) * p.out;
}

export async function deepseekChat(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<ChatResult> {
  if (!KEY) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }
  const model: DeepSeekModel = opts.model ?? "deepseek-v4-flash";
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    temperature: opts.temperature ?? (model === "deepseek-v4-pro" ? 1.0 : 0.7),
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  else body.max_tokens = 2048;
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  const r = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`DeepSeek ${model} ${r.status}: ${txt.slice(0, 400)}`);
  }
  const data = (await r.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const inT = data.usage?.prompt_tokens ?? 0;
  const outT = data.usage?.completion_tokens ?? 0;
  return {
    content,
    model,
    inputTokens: inT,
    outputTokens: outT,
    costUsd: pricingFor(model, inT, outT),
    raw: data,
  };
}

/**
 * Helper for tasks that need strict JSON output. Wraps deepseekChat
 * with jsonMode + a system prompt telling the model to return JSON.
 * Tries to extract the first {...} block if the model wraps it in
 * markdown fences anyway. Retries up to 2 times on empty content
 * (DeepSeek V4-Flash occasionally returns empty `content` after a
 * long reasoning pass; the second attempt usually works).
 */
export async function deepseekJson<T = unknown>(
  messages: ChatMessage[],
  opts: Omit<ChatOptions, "jsonMode"> = {},
): Promise<T & ChatResult> {
  // Inject a final user nudge for JSON output if the system prompt
  // doesn't already insist.
  const reinforced: ChatMessage[] = [
    ...messages,
    {
      role: "user",
      content:
        "Return ONLY a valid JSON object. No prose, no markdown fences, no explanation.",
    },
  ];

  const MAX_TRIES = 3;
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
    const res = await deepseekChat(reinforced, { ...opts, jsonMode: true });
    // Empty content → DeepSeek reasoning ate the output. Retry.
    if (!res.content || res.content.trim().length === 0) {
      lastErr = new Error(
        `DeepSeek returned empty content (attempt ${attempt}/${MAX_TRIES})`,
      );
      continue;
    }
    let parsed: T;
    try {
      parsed = JSON.parse(res.content) as T;
    } catch {
      // Try to extract the first {...} block
      const m = res.content.match(/\{[\s\S]*\}/);
      if (!m) {
        lastErr = new Error(
          `DeepSeek returned non-JSON: ${res.content.slice(0, 200)}`,
        );
        continue;
      }
      try {
        parsed = JSON.parse(m[0]) as T;
      } catch (e) {
        lastErr = e as Error;
        continue;
      }
    }
    return Object.assign(parsed as object, res) as T & ChatResult;
  }
  throw lastErr ?? new Error("deepseekJson: unknown failure");
}

/**
 * Log an ai_runs row. Safe to call from anywhere (CLI scripts or
 * server routes). Uses the service-role Supabase client.
 */
export async function logAiRun(args: {
  kind: string;
  model: DeepSeekModel;
  sourceTable?: string;
  sourceId?: string;
  sourceHash?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  output: unknown;
}): Promise<void> {
  const { getServiceRoleClient } = await import("./supabase/server");
  const supabase = getServiceRoleClient();
  await supabase.from("ai_runs").insert({
    kind: args.kind,
    model: args.model,
    source_table: args.sourceTable ?? null,
    source_id: args.sourceId ?? null,
    source_hash: args.sourceHash ?? null,
    input_tokens: args.inputTokens,
    output_tokens: args.outputTokens,
    cost_usd: args.costUsd,
    output: args.output as Record<string, unknown>,
  });
}

/**
 * SHA-256 helper for dedup hashing. Uses the Node `crypto` module
 * (server-only — not in the browser bundle).
 */
export async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
