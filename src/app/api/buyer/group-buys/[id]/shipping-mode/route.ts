// /api/buyer/group-buys/[id]/shipping-mode
//
// Phase 41 — buyer switches their preferred shipping mode
// (air/sea/express) on a group buy commitment. Only allowed
// while the group is still 'open' OR 'forming' (the buyer is
// the last-mile stakeholder). Once 'formed', shipping_mode is
// frozen because the cron has already created the order with
// the mode at the time.
//
// Rate-limited at 30/min per IP.

import { NextRequest, NextResponse } from "next/server";
import { requireUserApi } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const VALID_MODES = ["air", "sea", "express"] as const;

function bad(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Rate limit
  const rl = rateLimit({
    key: `buyer.group-buy.shipping-mode:${clientKey(req)}`,
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
  const auth = await requireUserApi(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.user.id;

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return bad("invalid_group_buy_id");
  }

  // ── Body
  let body: { shipping_mode?: unknown } = {};
  try {
    body = (await req.json()) as { shipping_mode?: unknown };
  } catch {
    return bad("invalid_json");
  }
  const mode = String(body.shipping_mode ?? "");
  if (!VALID_MODES.includes(mode as (typeof VALID_MODES)[number])) {
    return bad(`invalid_shipping_mode: must be one of ${VALID_MODES.join(", ")}`, 400, {
      code: "INVALID_SHIPPING_MODE",
    });
  }

  const sb = getServiceRoleClient();

  // ── Read membership + parent group status
  const { data: member } = await sb
    .from("group_buy_members")
    .select("id, group_buy_id, group_buys(status)")
    .eq("group_buy_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return bad("not_a_member", 404, { code: "NOT_A_MEMBER" });
  const groupStatus = (member as unknown as { group_buys: { status: string } | null })
    .group_buys?.status;
  if (groupStatus !== "open" && groupStatus !== "forming") {
    return bad(
      `cannot_change_shipping_mode_after_${groupStatus}`,
      409,
      { code: "GROUP_BUY_NOT_OPEN" },
    );
  }

  // ── Update
  const { error: updErr } = await sb
    .from("group_buy_members")
    .update({ shipping_mode: mode })
    .eq("id", member.id);
  if (updErr) return bad(`db_error: ${updErr.message}`, 500);

  return NextResponse.json({
    ok: true,
    shipping_mode: mode,
    group_status: groupStatus,
  });
}