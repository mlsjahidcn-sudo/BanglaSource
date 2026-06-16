// /api/admin/group-buys/[id]
//
// Phase 37. GET returns the full group_buy + members list (with
// user email + display name). PATCH transitions the group buy
// to 'cancelled' (the only admin-initiated transition the buyer-
// facing side doesn't already handle).
//
// The 'formed' and 'expired' transitions happen on the cron
// hot path (/api/cron/group-buys/* in Phase 40), not here.
//
// PATCH body: { action: "cancel" } (extensible for future
// "extend-deadline" or "edit-tiers" if needed).

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { GroupBuyPriceTier } from "@/lib/pricing";

export const dynamic = "force-dynamic";

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(_req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }
  const { id } = await params;

  const sb = getServiceRoleClient();
  const { data: gb, error: gbErr } = await sb
    .from("group_buys")
    .select(
      "id, product_id, target_qty, min_qty_per_buyer, price_tiers, deadline_at, status, final_unit_bdt, formed_at, cancelled_at, created_by, created_at, updated_at, products(source_id, title_en, title_bn, images, category)",
    )
    .eq("id", id)
    .maybeSingle();
  if (gbErr) return bad(gbErr.message, 500);
  if (!gb) return bad("Group buy not found", 404);

  // Members — two-step lookup. group_buy_members.user_id has no
  // FK to public.profiles, so the supabase-js embed syntax
  // `..., profiles(...)` fails with "Could not find a
  // relationship between 'group_buy_members' and 'profiles' in
  // the schema cache". Same gotcha as the orders + rfqs admin
  // pages. Workaround: fetch members first, then bulk-look-up
  // profiles by user_id.
  const { data: members, error: memErr } = await sb
    .from("group_buy_members")
    .select(
      "id, group_buy_id, user_id, qty, unit_bdt_at_commit, payment_state, order_id, charged_at, created_at",
    )
    .eq("group_buy_id", id)
    .order("created_at", { ascending: true });
  if (memErr) return bad(memErr.message, 500);

  const userIds = Array.from(
    new Set((members ?? []).map((m) => m.user_id)),
  );
  let profileById = new Map<string, { email: string; full_name: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileById.set(p.id, {
        email: p.email ?? "",
        full_name: p.full_name ?? null,
      });
    }
  }

  const membersWithProfiles = (members ?? []).map((m) => ({
    ...m,
    profiles: profileById.get(m.user_id) ?? null,
  }));

  return NextResponse.json({
    groupBuy: {
      ...gb,
      price_tiers: (gb.price_tiers as unknown as GroupBuyPriceTier[]) ?? [],
    },
    members: membersWithProfiles,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }
  const { id } = await params;

  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return bad("Invalid JSON body");
  }

  if (body.action !== "cancel") {
    return bad(`Unknown action: ${body.action}`);
  }

  const sb = getServiceRoleClient();

  // The trigger group_buys_guard_transition enforces:
  //   - cancelled is terminal
  //   - cancelled sets cancelled_at = now()
  //   - cancelled can only come from 'open' or 'forming'
  // So a single UPDATE is enough; the trigger does the
  // timestamp + state check atomically.
  const { data: updated, error: upErr } = await sb
    .from("group_buys")
    .update({ status: "cancelled" })
    .eq("id", id)
    .in("status", ["open", "forming"])
    .select("id, status, cancelled_at")
    .maybeSingle();

  if (upErr) return bad(upErr.message, 500);
  if (!updated) {
    // Either the id is wrong, or the status was already terminal.
    // Re-read to give a precise error.
    const { data: cur } = await sb
      .from("group_buys")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (!cur) return bad("Group buy not found", 404);
    return bad(
      `Cannot cancel — group buy is in terminal state '${cur.status}'`,
      409,
    );
  }

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    cancelledAt: updated.cancelled_at,
  });
}
