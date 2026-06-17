// /api/admin/group-buys/[id]/members/[memberId]
//
// Phase 41 — admin force-removes a member from a group buy. Used
// for moderation (chargeback risk, fraud signal) or to clean up
// after a buyer has been refunded via another channel.
//
// Hard DELETE the row. If the group's SUM(qty) drops below
// target_qty as a result, the admin can re-open the group via
// /admin/group-buys (future enhancement) or just let it stay
// 'formed' with the reduced count.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function bad(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  // ── Rate limit
  const rl = rateLimit({
    key: `admin.group-buy.member-remove:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetIn: rl.resetIn },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) },
      },
    );
  }

  // ── Auth
  const auth = await requireAdminApi(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, memberId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)
  ) {
    return bad("invalid_id");
  }

  const sb = getServiceRoleClient();

  // Confirm the member belongs to the group before deleting.
  const { data: member } = await sb
    .from("group_buy_members")
    .select("id, group_buy_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return bad("member_not_found", 404);
  if (member.group_buy_id !== id) {
    return bad("member_does_not_belong_to_group", 400, {
      code: "MEMBER_GROUP_MISMATCH",
    });
  }

  const { error: delErr } = await sb
    .from("group_buy_members")
    .delete()
    .eq("id", memberId);
  if (delErr) return bad(`db_error: ${delErr.message}`, 500);

  return NextResponse.json({ ok: true, member_id: memberId });
}