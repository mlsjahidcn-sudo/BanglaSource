// /lib/ai-tools.ts
//
// Tools the AI Ops Chat can call. Each tool is a typed function with
// a JSON Schema definition that DeepSeek's `tools` parameter can
// match against. The chat loop picks the right tool, calls it,
// reads the result, and continues reasoning.
//
// Why tools? Without them the LLM only sees hardcoded summary text
// from the system prompt. With tools it can ask live questions
// ("which products have MOQ < 5 in bags?"), then summarize the
// real rows. This is the difference between a static FAQ and a
// real ops analyst.
//
// Tool execution is read-only. We never expose write tools here —
// the admin can do those actions through the existing UI. Phase 6
// is "ask the database", not "drive the database".

import { getServiceRoleClient } from "@/lib/supabase/server";

export type ToolName =
  | "top_products"
  | "category_stats"
  | "low_moq_products"
  | "top_pages"
  | "traffic_summary"
  | "product_detail"
  | "sync_history"
  | "alert_log"
  | "ai_run_log";

export type ToolDef = {
  name: ToolName;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "top_products",
    description:
      "List top N active products. Sort by orders_last_30d, rating_overall, or stock_total. Optionally filter to one category.",
    parameters: {
      type: "object",
      properties: {
        sort: {
          type: "string",
          enum: ["orders", "rating", "moq_asc", "moq_desc"],
          description:
            "orders=most ordered in last 30d; rating=highest rating; moq_asc/desc=lowest/highest MOQ",
        },
        category: {
          type: "string",
          enum: [
            "gadgets",
            "eyewear",
            "shoes",
            "bags",
            "watches",
            "beauty",
            "jewelry",
          ],
        },
        limit: { type: "integer", description: "1-50, default 10" },
      },
      required: ["sort"],
    },
  },
  {
    name: "category_stats",
    description:
      "Aggregate stats per category: product count, avg MOQ, avg price tier. Use to compare categories or answer 'how many products in X'.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "low_moq_products",
    description:
      "Products with factory_moq at or below the given max. Good for 'easy entry' or 'small order' recommendations.",
    parameters: {
      type: "object",
      properties: {
        max_moq: { type: "integer", description: "1-50, default 5" },
        limit: { type: "integer", description: "1-50, default 20" },
      },
    },
  },
  {
    name: "top_pages",
    description:
      "Top paths by page_views count in the last N days. Use to see what's getting traffic.",
    parameters: {
      type: "object",
      properties: {
        days: { type: "integer", description: "1-90, default 14" },
        limit: { type: "integer", description: "1-50, default 15" },
      },
    },
  },
  {
    name: "traffic_summary",
    description:
      "Total page views in the last N days, broken down by day. Use to spot traffic spikes or drops.",
    parameters: {
      type: "object",
      properties: {
        days: { type: "integer", description: "1-90, default 14" },
      },
    },
  },
  {
    name: "product_detail",
    description:
      "Full detail of a single product by its source_id (the public URL slug — 12-digit for Pinduoduo/Taobao items, or a short slug for manual entries) or numeric id. Use when the admin asks about a specific product.",
    parameters: {
      type: "object",
      properties: {
        source_id: {
          type: "string",
          description: "product source_id (URL slug)",
        },
        id: { type: "integer", description: "numeric products.id" },
      },
    },
  },
  {
    name: "sync_history",
    description:
      "Recent product edits (the most recent writes to the products table). Use to see 'what did we add / change lately?'",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "1-50, default 10" },
      },
    },
  },
  {
    name: "alert_log",
    description:
      "Price alert log entries that fired recently (price moves on a watched product). Use to answer 'any price alerts?'.",
    parameters: {
      type: "object",
      properties: {
        only_unacknowledged: { type: "boolean", default: true },
        limit: { type: "integer", description: "1-50, default 20" },
      },
    },
  },
  {
    name: "ai_run_log",
    description:
      "Recent AI runs (DeepSeek calls) and their cost. Use to answer 'how much have we spent on AI?' or 'how many translations?'.",
    parameters: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          description:
            "filter by kind: 'translate', 'regenerate', 'translate_titles', 'nl_search'",
        },
        limit: { type: "integer", description: "1-100, default 20" },
      },
    },
  },
];

// --- implementations ---

type ToolResult = {
  ok: boolean;
  tool: ToolName;
  result: unknown;
  error?: string;
};

const FX = 16.85;

export async function runTool(
  name: ToolName,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const supabase = getServiceRoleClient();
  try {
    switch (name) {
      case "top_products": {
        const sort = (args.sort as string) ?? "orders";
        const category = args.category as string | undefined;
        const limit = Math.min(50, Math.max(1, (args.limit as number) ?? 10));
        let q = supabase
          .from("products")
          .select(
            "id, source_id, title_en, category, factory_moq, markup_pct, rating_overall, order_count_30d, stock_total, images",
          )
          .eq("active", true);
        if (category) q = q.eq("category", category);
        if (sort === "orders")
          q = q.order("order_count_30d", { ascending: false });
        else if (sort === "rating")
          q = q.order("rating_overall", { ascending: false });
        else if (sort === "moq_asc")
          q = q.order("factory_moq", { ascending: true });
        else if (sort === "moq_desc")
          q = q.order("factory_moq", { ascending: false });
        q = q.limit(limit);
        const { data, error } = await q;
        return { ok: !error, tool: name, result: data ?? [], error: error?.message };
      }
      case "category_stats": {
        // Single round-trip: count + average per category. PostgREST
        // doesn't have GROUP BY RPC, so do one query per category.
        const cats = [
          "gadgets",
          "eyewear",
          "shoes",
          "bags",
          "watches",
          "beauty",
          "jewelry",
        ];
        const results = await Promise.all(
          cats.map(async (c) => {
            const { count, data } = await supabase
              .from("products")
              .select("factory_moq, order_count_30d, rating_overall, price_tiers(price_cny_fen)")
              .eq("active", true)
              .eq("category", c);
            const rows = (data ?? []) as Array<{
              factory_moq: number;
              order_count_30d: number;
              rating_overall: number;
              price_tiers: Array<{ price_cny_fen: number }>;
            }>;
            const n = count ?? rows.length;
            const avgMoq =
              rows.reduce((a, b) => a + (b.factory_moq ?? 0), 0) / Math.max(1, n);
            const totalOrders = rows.reduce(
              (a, b) => a + (b.order_count_30d ?? 0),
              0,
            );
            const avgRating =
              rows.reduce((a, b) => a + (b.rating_overall ?? 0), 0) /
              Math.max(1, n);
            const allTiers = rows.flatMap((r) =>
              r.price_tiers.map((t) => t.price_cny_fen),
            );
            const minFen = allTiers.length ? Math.min(...allTiers) : 0;
            const minBdt = (minFen / 100) * FX;
            return {
              category: c,
              product_count: n,
              avg_factory_moq: Math.round(avgMoq * 10) / 10,
              total_orders_30d: totalOrders,
              avg_rating: Math.round(avgRating * 100) / 100,
              min_landed_bdt: Math.round(minBdt),
            };
          }),
        );
        return { ok: true, tool: name, result: results };
      }
      case "low_moq_products": {
        const maxMoq = (args.max_moq as number) ?? 5;
        const limit = Math.min(50, Math.max(1, (args.limit as number) ?? 20));
        const { data, error } = await supabase
          .from("products")
          .select(
            "id, source_id, title_en, category, factory_moq, rating_overall, order_count_30d",
          )
          .eq("active", true)
          .lte("factory_moq", maxMoq)
          .order("factory_moq", { ascending: true })
          .limit(limit);
        return { ok: !error, tool: name, result: data ?? [], error: error?.message };
      }
      case "top_pages": {
        const days = Math.min(90, Math.max(1, (args.days as number) ?? 14));
        const limit = Math.min(50, Math.max(1, (args.limit as number) ?? 15));
        const since = new Date(
          Date.now() - days * 24 * 60 * 60 * 1000,
        ).toISOString();
        const { data, error } = await supabase
          .from("page_views")
          .select("path")
          .gte("recorded_at", since);
        if (error) return { ok: false, tool: name, result: [], error: error.message };
        // Aggregate in JS (PostgREST can't GROUP BY over an RPC easily)
        const counts = new Map<string, number>();
        for (const r of data ?? []) {
          counts.set(r.path, (counts.get(r.path) ?? 0) + 1);
        }
        const sorted = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([path, views]) => ({ path, views }));
        return { ok: true, tool: name, result: sorted };
      }
      case "traffic_summary": {
        const days = Math.min(90, Math.max(1, (args.days as number) ?? 14));
        const since = new Date(
          Date.now() - days * 24 * 60 * 60 * 1000,
        ).toISOString();
        const { data, error } = await supabase
          .from("page_views")
          .select("recorded_at")
          .gte("recorded_at", since);
        if (error) return { ok: false, tool: name, result: [], error: error.message };
        const byDay = new Map<string, number>();
        for (const r of data ?? []) {
          const d = new Date(r.recorded_at).toISOString().slice(0, 10);
          byDay.set(d, (byDay.get(d) ?? 0) + 1);
        }
        const sorted = Array.from(byDay.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, views]) => ({ date, views }));
        return {
          ok: true,
          tool: name,
          result: { days, total: data?.length ?? 0, by_day: sorted },
        };
      }
      case "product_detail": {
        const sid = args.source_id as string | undefined;
        const id = args.id as number | undefined;
        let q = supabase
          .from("products")
          .select(
            "id, source_id, title_en, title_bn, title_zh, category, supplier_name, supplier_city, supplier_province, factory_moq, markup_pct, rating_overall, order_count_30d, stock_total, weight_kg, volume_cbm, description_en, description_bn, price_tiers(qty_min, qty_max, price_cny_fen), badges, images, active, created_at, updated_at",
          );
        if (sid) {
          q = q.eq("source_id", sid);
        } else if (id) {
          q = q.eq("id", id);
        } else {
          return { ok: false, tool: name, result: null, error: "missing source_id or id" };
        }
        const { data, error } = await q.maybeSingle();
        return { ok: !error, tool: name, result: data, error: error?.message };
      }
      case "sync_history": {
        // Phase 27 (hand-picked pivot, 2026-06-15): the catalog is no
        // longer auto-synced, so sync_runs is mostly empty. The
        // closest equivalent is "most recent product writes" — a
        // admin can use this to see what the team added or changed
        // lately. Kept the name `sync_history` for backwards compat
        // with any existing tool-calling history.
        const limit = Math.min(50, Math.max(1, (args.limit as number) ?? 10));
        const { data, error } = await supabase
          .from("products")
          .select("source_id, title_en, updated_at, active")
          .order("updated_at", { ascending: false })
          .limit(limit);
        return { ok: !error, tool: name, result: data ?? [], error: error?.message };
      }
      case "alert_log": {
        const onlyUnack = (args.only_unacknowledged as boolean) ?? true;
        const limit = Math.min(50, Math.max(1, (args.limit as number) ?? 20));
        let q = supabase
          .from("price_alert_log")
          .select(
            "id, product_id, old_price, new_price, delta_pct, fired_at, acknowledged_at, products:product_id(source_id, title_en)",
          )
          .order("fired_at", { ascending: false })
          .limit(limit);
        if (onlyUnack) q = q.is("acknowledged_at", null);
        const { data, error } = await q;
        return { ok: !error, tool: name, result: data ?? [], error: error?.message };
      }
      case "ai_run_log": {
        const kind = args.kind as string | undefined;
        const limit = Math.min(100, Math.max(1, (args.limit as number) ?? 20));
        let q = supabase
          .from("ai_runs")
          .select("id, kind, model, created_at, input_tokens, output_tokens, cost_usd, source_table, source_id")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (kind) q = q.eq("kind", kind);
        const { data, error } = await q;
        // Also compute a summary: total cost in the returned window
        const totalCost = (data ?? []).reduce(
          (a, b) => a + (b.cost_usd ?? 0),
          0,
        );
        return {
          ok: !error,
          tool: name,
          result: { runs: data ?? [], total_cost_usd: Math.round(totalCost * 10000) / 10000, count: data?.length ?? 0 },
          error: error?.message,
        };
      }
      default:
        return { ok: false, tool: name, result: null, error: "unknown tool" };
    }
  } catch (e) {
    return {
      ok: false,
      tool: name,
      result: null,
      error: (e as Error).message,
    };
  }
}

// OpenAI-compatible tool schema. DeepSeek V4-Pro accepts the same
// format as OpenAI's `tools` parameter. We strip our internal
// `name` and rebuild as the standard form.
export function toolSchemaForLLM() {
  return TOOL_DEFS.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
