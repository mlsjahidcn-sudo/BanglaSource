// /api/group-buys/[id]/my-status
//
// Phase 38 (buyer commit). Returns the signed-in buyer's current
// membership state on a group buy, plus the live pricing context
// (current SUM, current price, next tier). This is what the public
// group-buy detail page (Phase 39) uses to render either the
// "Join now" button or the "You're in!" badge with the buyer's
// committed-qty.
//
// Returns 404 for unauthenticated callers (so the public page
// can fall back to the join CTA without leaking data).

import { NextRequest, NextResponse } from "next/server";
import { requireUserApi } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import {
  groupBuyPriceAtQty,
  groupBuyNextTier,
  type GroupBuyPriceTier,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserApi(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.user.id;

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_group_buy_id" }, { status: 400 });
  }

  const sb = getServiceRoleClient();

  // Read group + my membership + the live SUM
  const [gbRes, memberRes, sumRes] = await Promise.all([
    sb
      .from("group_buys")
      .select(
        "id, status, target_qty, min_qty_per_buyer, price_tiers, deadline_at, final_unit_bdt, formed_at, cancelled_at",
      )
      .eq("id", id)
      .maybeSingle(),
    sb
      .from("group_buy_members")
      .select("id, qty, unit_bdt_at_commit, payment_state, order_id, created_at")
      .eq("group_buy_id", id)
      .eq("user_id", userId)
      .maybeSingle(),
    sb.from("group_buy_members").select("qty").eq("group_buy_id", id),
  ]);
  const gb = gbRes.data;
  if (gbRes.error) {
    return NextResponse.json({ error: gbRes.error.message }, { status: 500 });
  }
  if (!gb) {
    return NextResponse.json({ error: "group_buy_not_found" }, { status: 404 });
  }

  const tiers = (gb.price_tiers as unknown as GroupBuyPriceTier[]) ?? [];
  const currentQty = (sumRes.data ?? []).reduce((s, m) => s + (m.qty ?? 0), 0);
  const currentPrice = groupBuyPriceAtQty(tiers, currentQty);
  const nextTier = groupBuyNextTier(tiers, currentQty);
  const member = memberRes.data;

  return NextResponse.json({
    ok: true,
    group: {
      id: gb.id,
      status: gb.status,
      target_qty: gb.target_qty,
      min_qty_per_buyer: gb.min_qty_per_buyer,
      deadline_at: gb.deadline_at,
      final_unit_bdt: gb.final_unit_bdt,
      formed_at: gb.formed_at,
      cancelled_at: gb.cancelled_at,
    },
    membership: member
      ? {
          id: member.id,
          qty: member.qty,
          unit_bdt_at_commit: member.unit_bdt_at_commit,
          payment_state: member.payment_state,
          order_id: member.order_id,
          joined_at: member.created_at,
          // For the "price dropped since you joined" UI:
          // (current price) < (price the member saw at commit)?
          price_dropped_since_join:
            member.unit_bdt_at_commit != null
              ? currentPrice < member.unit_bdt_at_commit
              : false,
        }
      : null,
    pricing: {
      current_qty: currentQty,
      current_price: currentPrice,
      next_tier: nextTier,
    },
  });
}