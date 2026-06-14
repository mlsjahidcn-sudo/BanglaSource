// PATCH /api/admin/orders/[id]
//
// Phase 17: admin order actions. Updates status, tracking_number,
// and internal_note on a single order row. Service-role client so
// the admin can transition to any state (the buyer RLS policy
// only allows pending_payment → paid).
//
// Validations:
//   - status must be one of the 5 enum values
//   - transitions: any-to-any in the live order, but "delivered"
//     and "cancelled" are terminal (no further changes from a
//     terminal state)
//   - tracking_number: max 120 chars, optional, free-text
//   - internal_note: max 2000 chars, optional
//
// Returns: { ok, order: <updated row> }

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

const VALID_STATUS = new Set([
  "pending_payment",
  "paid",
  "in_transit",
  "delivered",
  "cancelled",
]);

const TERMINAL_STATUS = new Set(["delivered", "cancelled"]);

type PatchBody = {
  status?: string;
  tracking_number?: string | null;
  internal_note?: string | null;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = rateLimit({
    key: `admin.orders.update:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  const guard = await requireAdminApi(req);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status },
    );
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }

  // Build the patch (only include fields the admin sent)
  const patch: Record<string, any> = {};
  if (body.status !== undefined) {
    if (!VALID_STATUS.has(body.status)) {
      return NextResponse.json(
        { error: "bad_status", message: `Unknown status: ${body.status}` },
        { status: 400 },
      );
    }
    patch.status = body.status;
  }
  if (body.tracking_number !== undefined) {
    const t = body.tracking_number;
    if (t !== null && typeof t !== "string") {
      return NextResponse.json(
        { error: "bad_tracking" },
        { status: 400 },
      );
    }
    if (typeof t === "string" && t.length > 120) {
      return NextResponse.json(
        { error: "tracking_too_long", message: "Tracking # must be 120 chars or less." },
        { status: 400 },
      );
    }
    patch.tracking_number = t && t.trim() !== "" ? t.trim() : null;
  }
  if (body.internal_note !== undefined) {
    const n = body.internal_note;
    if (n !== null && typeof n !== "string") {
      return NextResponse.json({ error: "bad_note" }, { status: 400 });
    }
    if (typeof n === "string" && n.length > 2000) {
      return NextResponse.json(
        { error: "note_too_long", message: "Internal note must be 2000 chars or less." },
        { status: 400 },
      );
    }
    patch.internal_note = n && n.trim() !== "" ? n.trim() : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "empty_patch", message: "Nothing to update." },
      { status: 400 },
    );
  }

  const sb = getServiceRoleClient();
  // Fetch the current row so we can enforce terminal-state rules
  // and decide whether to also stamp paid_at.
  const { data: current, error: cErr } = await sb
    .from("orders")
    .select("id, status, paid_at")
    .eq("id", orderId)
    .maybeSingle();
  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Terminal-state guard: if the order is in delivered or cancelled,
  // disallow any further state changes (tracking + note are still
  // allowed — admin might want to log post-mortem notes).
  if (patch.status && TERMINAL_STATUS.has(current.status) && patch.status !== current.status) {
    return NextResponse.json(
      {
        error: "terminal_state",
        message: `Order is ${current.status}; cannot change status.`,
      },
      { status: 409 },
    );
  }

  // Auto-stamp paid_at on the first transition INTO 'paid'. (Buyer
  // RLS policy does this for self-marks; admin can also move an
  // order to paid manually if the buyer wired the money and the
  // admin confirmed in their bank app.)
  if (patch.status === "paid" && !current.paid_at) {
    patch.paid_at = new Date().toISOString();
  }

  const { data: updated, error: uErr } = await sb
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .select("*")
    .maybeSingle();
  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Phase 18: fire-and-forget email when admin moves an order to
  // a buyer-visible state (in_transit, delivered). Skipped for
  // silent admin-only transitions (cancelled, paid-by-admin in
  // some flows — paid is sent via /api/orders/[id]/paid only on
  // the buyer self-mark path, since the admin's "I confirmed
  // payment in the bank app" path is internal). notifyOrderStatus
  // Change is a no-op for status values it doesn't care about.
  if (patch.status === "in_transit" || patch.status === "delivered") {
    void import("@/lib/email").then(({ notifyOrderStatusChange }) =>
      notifyOrderStatusChange(
        orderId,
        patch.status as "in_transit" | "delivered",
        patch.tracking_number ?? updated.tracking_number ?? null,
      ).catch((e) => {
        // eslint-disable-next-line no-console
        console.error("[admin.orders] notifyOrderStatusChange failed:", e);
      }),
    );
  }

  return NextResponse.json({ ok: true, order: updated });
}
