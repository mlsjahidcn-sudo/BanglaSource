// /api/admin/group-buys/[id]/members/[memberId]/retry
//
// Phase 41 — admin retries a single `payment_state='failed'` member
// after they've added a default address. Re-runs the same per-member
// order-creation logic that the formation cron uses, then marks
// the member as charged.
//
// Requires the group to be in 'formed' status (the original
// formation completed, this is just patching a failed member).
// If the group is still 'open'/'forming', the cron will handle
// the member normally — no manual retry needed.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { createOrderForMember } from "@/lib/group-buy-cron";

export const dynamic = "force-dynamic";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function bad(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  // ── Rate limit
  const rl = rateLimit({
    key: `admin.group-buy.retry:${clientKey(req)}`,
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

  // Load group + member + product in 3 queries (the relationship
  // graph doesn't expose a single join for these).
  const [{ data: gb }, { data: member }] = await Promise.all([
    sb
      .from("group_buys")
      .select(
        "id, product_id, status, final_unit_bdt, products!inner(id, title_en, title_bn, source_id, images, category, weight_kg, volume_cbm, customs_duty_per_kg)",
      )
      .eq("id", id)
      .maybeSingle(),
    sb
      .from("group_buy_members")
      .select("id, group_buy_id, user_id, qty, unit_bdt_at_commit, payment_state, shipping_mode")
      .eq("id", memberId)
      .maybeSingle(),
  ]);
  if (!gb) return bad("group_buy_not_found", 404);
  if (!member) return bad("member_not_found", 404);
  if (member.group_buy_id !== id) {
    return bad("member_does_not_belong_to_group", 400, {
      code: "MEMBER_GROUP_MISMATCH",
    });
  }
  if (member.payment_state === "charged") {
    return bad("already_charged", 409, { code: "ALREADY_CHARGED" });
  }
  if (gb.status !== "formed") {
    return bad(
      `retry_only_after_formed: status=${gb.status}`,
      409,
      { code: "GROUP_BUY_NOT_FORMED" },
    );
  }
  if (gb.final_unit_bdt == null) {
    return bad("group_buy_missing_final_unit_bdt", 500);
  }

  const product = (gb as unknown as {
    products: {
      title_en: string;
      images: string[] | null;
      category: string;
      weight_kg: number;
      volume_cbm: number;
      customs_duty_per_kg: number;
    };
  }).products;

  const result = await createOrderForMember(sb, {
    group: {
      id: gb.id,
      product_id: gb.product_id,
      final_unit_bdt: gb.final_unit_bdt,
    },
    member: {
      id: member.id,
      user_id: member.user_id,
      qty: member.qty,
      unit_bdt_at_commit: member.unit_bdt_at_commit,
      shipping_mode: (member.shipping_mode as string) ?? "air",
    },
    product,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "retry_failed", reason: result.reason },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    order_id: result.orderId,
    member_id: member.id,
  });
}