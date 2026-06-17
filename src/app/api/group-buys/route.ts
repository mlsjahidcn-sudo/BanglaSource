// /api/group-buys
//
// Phase 39 (public listing). Returns all `status='open'` group buys,
// joined with product info + live current_qty SUM + computed
// current_price + next_tier. Anon-readable (Phase 36 RLS exposes
// group_buys to anyone; buyers don't see the member list here).
//
// Query params:
//   ?category=<slug>     — filter to a category (gadgets/eyewear/...)
//   ?sort=<deadline|progress> — default "deadline"
//   ?limit=<n>           — default 50, max 100
//
// Phase 40 cron flips status from open → forming/expired. The
// filter `status='open'` keeps the listing clean.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import {
  groupBuyPriceAtQty,
  groupBuyNextTier,
  type GroupBuyPriceTier,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

function bad(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") || null;
  const sortRaw = url.searchParams.get("sort") || "deadline";
  const sort = sortRaw === "progress" ? "progress" : "deadline";
  const limitRaw = Number(url.searchParams.get("limit") || "50");
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(100, Math.floor(limitRaw)))
    : 50;

  const sb = getServiceRoleClient();

  // 1) Pull open group buys (joined product).
  //    Embeds products(source_id, title_en, title_bn, images, category,
  //    factory_moq) via the FK in our hand-maintained Database type.
  //    NOTE: factory_price_cny_fen is on the related price_tiers
  //    table, not products — fetching it here would 500.
  let q = sb
    .from("group_buys")
    .select(
      "id, product_id, target_qty, min_qty_per_buyer, price_tiers, deadline_at, status, final_unit_bdt, products!inner(source_id, title_en, title_bn, images, category, factory_moq)",
    )
    .eq("status", "open")
    .gt("deadline_at", new Date().toISOString());
  if (category) {
    q = q.eq("products.category", category);
  }
  // For sort=progress we still need deadline as a stable tie-breaker,
  // so always ORDER BY deadline_at ASC server-side. The progress-based
  // ordering happens client-side after SUM() is computed below.
  q = q.order("deadline_at", { ascending: true }).limit(limit);
  const { data: rows, error } = await q;
  if (error) return bad(`db_error: ${error.message}`, 500);

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, items: [], count: 0 });
  }

  // 2) Bulk-load SUM(qty) per group_buy_id + count of distinct members.
  //    Two-step because PostgREST doesn't expose aggregate functions
  //    via the .from() select; we fetch all member rows in one query
  //    and reduce in JS. With status='open' + the partial unique
  //    index, the active row count is bounded.
  const ids = rows.map((r) => r.id);
  const { data: memberRows, error: memErr } = await sb
    .from("group_buy_members")
    .select("group_buy_id, qty")
    .in("group_buy_id", ids);
  if (memErr) return bad(`db_error: ${memErr.message}`, 500);

  const qtyByGroup = new Map<string, { qty: number; buyers: number }>();
  const memberSetByGroup = new Map<string, Set<string>>();
  for (const m of memberRows ?? []) {
    const cur = qtyByGroup.get(m.group_buy_id) ?? { qty: 0, buyers: 0 };
    cur.qty += m.qty ?? 0;
    // buyers = distinct user count per group, but we can't DISTINCT
    // on user_id alone via PostgREST. Instead we count rows by
    // tracking a set per group. (open groups have bounded members,
    // so the Set is small.)
    const s = memberSetByGroup.get(m.group_buy_id) ?? new Set<string>();
    s.add(`${(m as { user_id?: string }).user_id ?? ""}:${m.qty}`);
    cur.buyers = s.size;
    qtyByGroup.set(m.group_buy_id, cur);
    memberSetByGroup.set(m.group_buy_id, s);
  }

  // 3) Compute pricing context + return shape.
  type Row = (typeof rows)[number] & {
    products: {
      source_id: string;
      title_en: string;
      title_bn: string | null;
      images: string[] | null;
      category: string;
      factory_moq: number | null;
    };
  };

  const items = (rows as Row[]).map((r) => {
    const tiers = (r.price_tiers as unknown as GroupBuyPriceTier[]) ?? [];
    const acc = qtyByGroup.get(r.id) ?? { qty: 0, buyers: 0 };
    const currentQty = acc.qty;
    const buyersCount = acc.buyers;
    const currentPrice = groupBuyPriceAtQty(tiers, currentQty);
    const nextTier = groupBuyNextTier(tiers, currentQty);
    const progressPct =
      r.target_qty > 0
        ? Math.min(100, Math.round((currentQty / r.target_qty) * 100))
        : 0;
    return {
      id: r.id,
      product_id: r.product_id,
      target_qty: r.target_qty,
      min_qty_per_buyer: r.min_qty_per_buyer,
      deadline_at: r.deadline_at,
      current_qty: currentQty,
      buyers_count: buyersCount,
      progress_pct: progressPct,
      current_price: currentPrice,
      next_tier: nextTier,
      product: {
        source_id: r.products.source_id,
        title_en: r.products.title_en,
        title_bn: r.products.title_bn,
        image: r.products.images?.[0] ?? null,
        category: r.products.category,
        factory_moq: r.products.factory_moq,
      },
    };
  });

  // 4) Optional client-side re-sort by progress.
  if (sort === "progress") {
    items.sort((a, b) => b.progress_pct - a.progress_pct);
  }

  return NextResponse.json({
    ok: true,
    count: items.length,
    sort,
    category: category ?? null,
    items,
  });
}