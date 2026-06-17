// /api/buyer/group-buys
//
// Phase 39 (my groups). Returns every group buy the signed-in
// buyer has a membership in, regardless of the group's status
// (open | forming | formed | expired | cancelled). Used by the
// /buyer/group-buys page so a buyer can track every commitment
// end-to-end — from "you committed 50 pcs at ৳320/pc" through
// "group formed at ৳300/pc — pay your order" to "expired, no
// charge".
//
// Returns 401 for unauthenticated callers.

import { NextRequest, NextResponse } from "next/server";
import { requireUserApi } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import {
  groupBuyPriceAtQty,
  type GroupBuyPriceTier,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

function bad(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function GET(req: NextRequest) {
  const auth = await requireUserApi(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.user.id;

  const sb = getServiceRoleClient();

  // 1) My memberships (one row per group I joined). Order by
  //    most recent first — the buyer cares about new commits.
  const { data: memberships, error: memErr } = await sb
    .from("group_buy_members")
    .select(
      "id, group_buy_id, qty, unit_bdt_at_commit, payment_state, order_id, created_at, charged_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (memErr) return bad(`db_error: ${memErr.message}`, 500);
  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ ok: true, items: [], count: 0 });
  }

  // 2) Bulk-load the parent group_buys + products.
  const groupIds = Array.from(new Set(memberships.map((m) => m.group_buy_id)));
  const { data: groups, error: gbErr } = await sb
    .from("group_buys")
    .select(
      "id, product_id, target_qty, min_qty_per_buyer, price_tiers, deadline_at, status, final_unit_bdt, formed_at, cancelled_at, products!inner(source_id, title_en, title_bn, images, category)",
    )
    .in("id", groupIds);
  if (gbErr) return bad(`db_error: ${gbErr.message}`, 500);
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));

  // 3) Bulk-load SUM(qty) per group for live progress.
  const { data: memberRows, error: sumErr } = await sb
    .from("group_buy_members")
    .select("group_buy_id, qty")
    .in("group_buy_id", groupIds);
  if (sumErr) return bad(`db_error: ${sumErr.message}`, 500);
  const qtyByGroup = new Map<string, number>();
  for (const m of memberRows ?? []) {
    qtyByGroup.set(
      m.group_buy_id,
      (qtyByGroup.get(m.group_buy_id) ?? 0) + (m.qty ?? 0),
    );
  }

  // 4) Assemble the response.
  type Group = NonNullable<typeof groups>[number] & {
    products: {
      source_id: string;
      title_en: string;
      title_bn: string | null;
      images: string[] | null;
      category: string;
    };
  };
  const items = memberships
    .map((m) => {
      const g = groupById.get(m.group_buy_id) as Group | undefined;
      if (!g) return null;
      const tiers = (g.price_tiers as unknown as GroupBuyPriceTier[]) ?? [];
      const currentQty = qtyByGroup.get(g.id) ?? 0;
      const currentPrice = groupBuyPriceAtQty(tiers, currentQty);
      const progressPct =
        g.target_qty > 0
          ? Math.min(100, Math.round((currentQty / g.target_qty) * 100))
          : 0;
      // What the member will pay at formation: if the group is
      // already formed, the admin-set final_unit_bdt. Otherwise
      // the current live price (might still move before formation).
      const willPayUnitBdt =
        g.status === "formed" && g.final_unit_bdt != null
          ? g.final_unit_bdt
          : currentPrice;
      return {
        membership_id: m.id,
        group: {
          id: g.id,
          status: g.status,
          target_qty: g.target_qty,
          min_qty_per_buyer: g.min_qty_per_buyer,
          deadline_at: g.deadline_at,
          final_unit_bdt: g.final_unit_bdt,
          formed_at: g.formed_at,
          cancelled_at: g.cancelled_at,
          current_qty: currentQty,
          progress_pct: progressPct,
        },
        product: {
          id: g.product_id,
          source_id: g.products.source_id,
          title_en: g.products.title_en,
          title_bn: g.products.title_bn,
          image: g.products.images?.[0] ?? null,
          category: g.products.category,
        },
        my_membership: {
          qty: m.qty,
          unit_bdt_at_commit: m.unit_bdt_at_commit,
          payment_state: m.payment_state,
          order_id: m.order_id,
          joined_at: m.created_at,
          charged_at: m.charged_at,
          will_pay_unit_bdt: willPayUnitBdt,
          // "Price dropped since you joined" UI hint — only meaningful
          // before the group is formed (after formation, everyone
          // pays the same final_unit_bdt).
          price_dropped_since_join:
            g.status === "open" && currentPrice < m.unit_bdt_at_commit,
        },
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  return NextResponse.json({ ok: true, count: items.length, items });
}