// POST /api/orders/[id]/paid
//
// "I sent the deposit" self-report. In a fully-integrated
// payment system this would be triggered by a webhook from
// bKash/Stripe/whatever. Since we don't integrate those, the
// buyer taps the button on the order detail page and we move
// the order from `pending_payment` → `paid`.
//
// Auth: must be the owner of the order (RLS does the work).
// Admin can also flip this via /api/admin/orders/[id] later.

import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = rateLimit({
    key: `orders.paid:${clientKey(req)}`,
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

  const { data, error } = await sb
    .from("orders")
    .update({
      status: "paid",
      deposit_paid_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("user_id", user.id) // belt-and-suspenders; RLS already enforces this
    .eq("status", "pending_payment") // only transition from the pending state
    .select("id, status, deposit_paid_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "not_found_or_wrong_state" },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, order: data });
}
