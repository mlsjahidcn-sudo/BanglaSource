// POST /api/orders/[id]/paid
//
// "I sent the payment" self-report. In a fully-integrated
// payment system this would be triggered by a webhook from
// bKash/Stripe/whatever. Since we don't integrate those, the
// buyer taps the button on the order detail page and we move
// the order from `pending_payment` → `paid`.
//
// Phase 13: this is now the FULL prepayment confirmation
// (was: 70% deposit). The `paid_at` column (renamed from
// `deposit_paid_at` in migration 0024) records when the buyer
// confirmed payment of the full landed cost.
//
// Auth: must be the owner of the order (RLS does the work).
// Admin can also flip this via /api/admin/orders/[id] later.
//
// AUDIT FIX 2026-06-17 (C3): previously, this endpoint was
// "buyer self-reports I paid" with no verification — a buyer
// could flip any of their orders to paid without actually
// paying, and the admin would see `status='paid'` and ship.
// Now the buyer MUST supply a `payment_reference` — the bKash
// TrxID, bank transfer reference, USDT hash, or similar.
// The reference is stored on `orders.payment_reference` (added
// in migration 20260617000002) and surfaced on the order
// detail + admin pages so the operator can verify before
// shipping. Until Phase 29 (real payment integration), this
// is the closest mitigation we have.

import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

// Validation rules for the payment_reference. bKash TrxIDs are
// 8-10 alphanumeric chars (e.g. "8A4B6N7PQ"). Bank transfer
// references vary but are usually 6-30 chars. We allow 4-100
// chars to be flexible but reject obviously empty / placeholder
// strings.
const REF_MIN_LEN = 4;
const REF_MAX_LEN = 100;
const REF_REGEX = /^[A-Za-z0-9\-_/.\s]+$/; // alphanum + a few safe punctuation

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

  // Parse body for payment_reference
  let body: { payment_reference?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "bad_json", message: "JSON body required." },
      { status: 400 },
    );
  }
  const refRaw = body.payment_reference;
  if (typeof refRaw !== "string") {
    return NextResponse.json(
      {
        error: "missing_payment_reference",
        message:
          "A payment reference is required (bKash TrxID, bank reference, or similar). The admin verifies this against their statement before shipping.",
      },
      { status: 400 },
    );
  }
  const paymentReference = refRaw.trim();
  if (
    paymentReference.length < REF_MIN_LEN ||
    paymentReference.length > REF_MAX_LEN ||
    !REF_REGEX.test(paymentReference)
  ) {
    return NextResponse.json(
      {
        error: "bad_payment_reference",
        message: `Payment reference must be ${REF_MIN_LEN}-${REF_MAX_LEN} chars of letters, digits, spaces, and basic punctuation.`,
      },
      { status: 400 },
    );
  }

  const sb = await getServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // First attempt: write with payment_reference. If the column
  // doesn't exist yet (operator hasn't applied
  // 20260617000002_orders_payment_reference.sql), Supabase
  // returns an error. We catch that and fall back to the old
  // behavior with a server-side warning — so the audit fix
  // doesn't block existing deployments.
  let data, error;
  ({ data, error } = await sb
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_reference: paymentReference,
    })
    .eq("id", orderId)
    .eq("user_id", user.id)
    .eq("status", "pending_payment")
    .select("id, status, paid_at, payment_reference, total_bdt, payment_model")
    .maybeSingle());

  if (error && /payment_reference.*(does not exist|column of .* schema cache)/i.test(error.message)) {
    // eslint-disable-next-line no-console
    console.warn(
      "[orders.paid] orders.payment_reference column missing — operator must apply migration 20260617000002_orders_payment_reference.sql. Falling back to no-reference update.",
    );
    ({ data, error } = await sb
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("user_id", user.id)
      .eq("status", "pending_payment")
      .select("id, status, paid_at, total_bdt, payment_model")
      .maybeSingle());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "not_found_or_wrong_state" },
      { status: 409 },
    );
  }

  // Phase 18: fire-and-forget email — buyer self-marked paid.
  void import("@/lib/email").then(({ notifyOrderPaid }) =>
    notifyOrderPaid(orderId).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[orders.paid] notifyOrderPaid failed:", e);
    }),
  );

  return NextResponse.json({ ok: true, order: data });
}