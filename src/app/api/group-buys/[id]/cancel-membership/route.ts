// /api/group-buys/[id]/cancel-membership
//
// Phase 38 (buyer commit). A signed-in buyer cancels their own
// commitment to an open group buy. Deletes the group_buy_members
// row (hard delete — there's no audit trail for cancellations
// in Phase 38; Phase 41 adds a `cancelled_at` column if we ever
// need history).
//
// Rules:
//   - The buyer must be signed in (handled by requireUserApi).
//   - The buyer can only cancel their OWN row (we filter the
//     DELETE by both group_buy_id AND user_id — service-role
//     bypasses RLS so we MUST scope the delete ourselves).
//   - The group must still be 'open'. Once formation has started
//     ('forming') or completed ('formed'), the buyer's slot is
//     locked in and being processed by the cron — they can't
//     cancel via this path. They should contact admin if they
//     need to back out after formation.
//   - Triggers notifyGroupBuyMembershipCancelled email
//     (fire-and-forget).

import { NextRequest, NextResponse } from "next/server";
import { requireUserApi } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
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
  const rl = rateLimit({
    key: `group-buy.cancel:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  const auth = await requireUserApi(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.user.id;

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return bad("invalid_group_buy_id");
  }

  const sb = getServiceRoleClient();

  // ── Verify group is still open (status check BEFORE delete so
  //    we can return a clean 409 vs a confusing 0-row delete).
  const { data: gb } = await sb
    .from("group_buys")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!gb) return bad("group_buy_not_found", 404);
  if (gb.status !== "open") {
    return bad(`cannot_cancel_after_status_change: status=${gb.status}`, 409, {
      code: "GROUP_BUY_NOT_OPEN",
      status: gb.status,
      message:
        gb.status === "forming"
          ? "Group is currently charging members — cancellation is locked until the next cron cycle. Contact admin if urgent."
          : gb.status === "formed"
            ? "Group has already formed. Your order is being created — contact admin to cancel the order."
            : `Group is ${gb.status}; no active membership to cancel.`,
    });
  }

  // ── Delete the row, scoped to this (group, user). Service-role
  //    bypasses RLS so we MUST scope by user_id.
  const { error: delErr, count } = await sb
    .from("group_buy_members")
    .delete({ count: "exact" })
    .eq("group_buy_id", id)
    .eq("user_id", userId);
  if (delErr) return bad(`db_error: ${delErr.message}`, 500);
  if (!count) {
    // No row to delete — buyer wasn't a member (or already
    // cancelled in a previous request). Return a clean 404.
    return bad("not_a_member", 404, {
      code: "NOT_A_MEMBER",
      message: "You don't have a commitment on this group.",
    });
  }

  // ── Fire-and-forget email
  void import("@/lib/email")
    .then(({ notifyGroupBuyMembershipCancelled }) =>
      notifyGroupBuyMembershipCancelled(id, userId).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(
          "[group-buy.cancel] notifyGroupBuyMembershipCancelled failed:",
          e,
        );
      }),
    )
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[group-buy.cancel] email module import failed:", e);
    });

  return NextResponse.json({ ok: true, cancelled: true });
}