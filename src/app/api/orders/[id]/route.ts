// GET /api/orders/[id]
// Read a single order owned by the current user.
//
// Used by /orders/[id]/_client.tsx to render the order detail
// page. RLS on `orders` and `order_items` already enforces that
// only the owner can SELECT, so we use the user's session-bound
// server client (not service-role).

import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = rateLimit({
    key: `orders.read:${clientKey(_req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  const sb = await getServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Fetch the order (RLS: only the owner row is visible)
  const { data: order, error: oErr } = await sb
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (oErr) {
    return NextResponse.json({ error: oErr.message }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Fetch the items
  const { data: items, error: iErr } = await sb
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("position", { ascending: true });
  if (iErr) {
    return NextResponse.json({ error: iErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, order, items: items ?? [] });
}
