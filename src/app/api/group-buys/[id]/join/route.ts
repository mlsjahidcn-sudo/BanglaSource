// /api/group-buys/[id]/join
//
// Phase 38 (buyer commit). A signed-in buyer commits a qty to
// an open group buy. The API:
//   - Validates the group is still 'open' (the trigger
//     group_buy_members_insert_guard enforces this at write time
//     too, as defense in depth).
//   - Validates qty >= min_qty_per_buyer.
//   - Computes `unit_bdt_at_commit` = the price the buyer SAW
//     based on the current SUM-of-all-member-qty BEFORE this
//     insert (we read-then-insert in one transaction via the
//     service-role client + a small race window). The price
//     the buyer GETS CHARGED is group_buys.final_unit_bdt at
//     formation time, frozen at the moment the group forms
//     (Phase 40 cron). unit_bdt_at_commit is the snapshot
//     for the "price dropped since you joined" UI message.
//   - Inserts a group_buy_members row with payment_state='pending'.
//     The partial unique index on (group_buy_id, user_id) makes
//     double-join attempts fail with 23505 — we catch that and
//     return a clean 409 with "already a member" message.
//   - Triggers notifyGroupBuyJoined email (fire-and-forget).
//
// Race conditions:
//   - Two buyers joining at the same instant: both inserts
//     succeed (over-target is fine — formation cron handles it).
//   - Buyer joins while formation cron is in flight
//     (status='forming'): the trigger rejects with
//     'group_buy_not_open' → API returns 409.
//   - The buyer can DELETE their row (cancel) and re-join later
//     because the UNIQUE is on (group_buy_id, user_id) but the
//     DELETE removes the row. See cancel-membership route.

import { NextRequest, NextResponse } from "next/server";
import { requireUserApi } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { groupBuyPriceAtQty, groupBuyNextTier, type GroupBuyPriceTier } from "@/lib/pricing";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function bad(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Rate limit (per IP)
  const rl = rateLimit({
    key: `group-buy.join:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: `Too many join attempts. Try again in ${Math.ceil(rl.resetIn / 1000)}s.`,
        resetIn: rl.resetIn,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  // ── Auth
  const auth = await requireUserApi(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.user.id;

  const { id } = await params;
  // UUID format check — keep the error friendly
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return bad("invalid_group_buy_id");
  }

  // ── Body validation
  let body: { qty?: unknown } = {};
  try {
    body = (await req.json()) as { qty?: unknown };
  } catch {
    return bad("invalid_json");
  }
  const qty =
    typeof body.qty === "number" && Number.isInteger(body.qty) ? body.qty : null;
  if (qty == null || qty < 1 || qty > 1_000_000) {
    return bad("qty must be an integer in [1, 1,000,000]");
  }

  const sb = getServiceRoleClient();

  // ── Read the group_buy + current SUM (read-then-insert).
  //    The trigger enforces status='open' + qty>=min on insert;
  //    this read is for computing unit_bdt_at_commit and
  //    rejecting early when the group is forming/formed/etc.
  const { data: gb, error: gbErr } = await sb
    .from("group_buys")
    .select("id, status, target_qty, min_qty_per_buyer, price_tiers, deadline_at")
    .eq("id", id)
    .maybeSingle();
  if (gbErr) return bad(`db_error: ${gbErr.message}`, 500);
  if (!gb) return bad("group_buy_not_found", 404);
  if (gb.status !== "open") {
    return bad(`group_buy_not_open: status=${gb.status}`, 409, {
      code: "GROUP_BUY_NOT_OPEN",
      status: gb.status,
    });
  }
  if (qty < gb.min_qty_per_buyer) {
    return bad(
      `qty_below_min: qty=${qty} min_qty_per_buyer=${gb.min_qty_per_buyer}`,
      400,
      { code: "QTY_BELOW_MIN", min_qty_per_buyer: gb.min_qty_per_buyer },
    );
  }
  if (new Date(gb.deadline_at).getTime() <= Date.now()) {
    return bad("group_buy_expired", 410, {
      code: "GROUP_BUY_EXPIRED",
      deadline_at: gb.deadline_at,
    });
  }

  // ── Compute current SUM-of-member-qty
  const { data: sumRow } = await sb
    .from("group_buy_members")
    .select("qty")
    .eq("group_buy_id", id);
  const currentQty = (sumRow ?? []).reduce((s, m) => s + (m.qty ?? 0), 0);

  // The price the buyer SAW (snapshot). After insert, the actual
  // SUM will be (currentQty + qty) — over-target is fine; the
  // formation cron uses group_buys.final_unit_bdt (frozen at
  // formation) to charge every member at the SAME price.
  const tiers = (gb.price_tiers as unknown as GroupBuyPriceTier[]) ?? [];
  const unitBdtAtCommit = groupBuyPriceAtQty(tiers, currentQty);

  // ── Insert (rely on the DB trigger + UNIQUE for the guards)
  const { data: inserted, error: insErr } = await sb
    .from("group_buy_members")
    .insert({
      group_buy_id: id,
      user_id: userId,
      qty,
      unit_bdt_at_commit: unitBdtAtCommit,
      payment_state: "pending",
    } as never)
    .select("id, group_buy_id, user_id, qty, unit_bdt_at_commit, payment_state, created_at")
    .single();
  if (insErr) {
    // UNIQUE(group_buy_id, user_id) — already a member
    if (insErr.code === "23505" && /group_buy_members_group_buy_id_user_id_key/.test(insErr.message)) {
      return bad("already_a_member", 409, {
        code: "ALREADY_A_MEMBER",
        message: "You already committed a qty to this group. Cancel your existing membership before re-joining.",
      });
    }
    // Trigger guard: group not open OR qty below min
    if (insErr.code === "P0001") {
      return bad(`insert_rejected: ${insErr.message}`, 409, { code: "TRIGGER_REJECTED" });
    }
    return bad(`insert_failed: ${insErr.message}`, 500);
  }

  // ── Post-insert: compute the new state for the buyer
  const newQty = currentQty + qty;
  const newCurrentPrice = groupBuyPriceAtQty(tiers, newQty);
  const nextTier = groupBuyNextTier(tiers, newQty);

  // ── Fire-and-forget email. Don't await — the buyer has
  //    already been confirmed in the DB; the email is a
  //    notification, not a confirmation gate.
  void import("@/lib/email")
    .then(({ notifyGroupBuyJoined }) =>
      notifyGroupBuyJoined(inserted.id).catch((e) => {
        // eslint-disable-next-line no-console
        console.error("[group-buy.join] notifyGroupBuyJoined failed:", e);
      }),
    )
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[group-buy.join] email module import failed:", e);
    });

  return NextResponse.json({
    ok: true,
    member: inserted,
    group: {
      id: gb.id,
      target_qty: gb.target_qty,
      min_qty_per_buyer: gb.min_qty_per_buyer,
      deadline_at: gb.deadline_at,
    },
    pricing: {
      current_qty: newQty,
      current_price: newCurrentPrice,
      unit_bdt_at_commit: unitBdtAtCommit,
      next_tier: nextTier,
      // Did the price change as a result of this commit?
      // (Useful for the "you unlocked a better price!" toast.)
      price_dropped: newCurrentPrice < unitBdtAtCommit,
    },
  });
}