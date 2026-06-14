// PATCH /api/admin/rfqs/[id]
//
// Phase 22: admin transitions an RFQ through its lifecycle.
//
//   open → quoted     (must set price + min_qty + lead_days)
//
// The other transitions (quoted → accepted | rejected |
// cancelled, open → rejected | cancelled) are intentionally
// not exposed here yet — they're the buyer's decision (accept)
// or follow-up admin actions (reject, cancel) that should
// come with a written reason and a follow-up email. We'll
// add them when the first batch of RFQs are in flight and
// we have real signal on what the workflow actually needs.
//
// For now the admin's only job on an open RFQ is to send a
// quote. That's what this endpoint does.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

type PatchBody = {
  status?: "quoted";
  quoted_price_cny_fen?: number;
  quoted_min_qty?: number;
  quoted_lead_days?: number;
  quoted_notes?: string;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = rateLimit({
    key: `admin.rfqs.update:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  const admin = await requireAdminApi();
  const { id } = await params;
  const rfqId = Number(id);
  if (!Number.isInteger(rfqId) || rfqId <= 0) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  // The only transition we support is open → quoted, with the
  // quote payload. We reject any other status (defense in
  // depth — the trigger would catch it, but a clean 4xx is
  // better for the admin UI).
  if (body.status !== "quoted") {
    return NextResponse.json(
      { error: "bad_status", message: "Only status='quoted' is supported. Use /buyer/rfqs/[id] to accept." },
      { status: 400 },
    );
  }

  // Validate quote payload
  const price = Number(body.quoted_price_cny_fen);
  if (!Number.isInteger(price) || price < 1 || price > 100_000_000) {
    return NextResponse.json(
      { error: "bad_price", message: "Quoted price must be a positive integer in CNY fen (1-100,000,000)." },
      { status: 400 },
    );
  }
  const minQty = Number(body.quoted_min_qty);
  if (!Number.isInteger(minQty) || minQty < 1 || minQty > 1_000_000) {
    return NextResponse.json(
      { error: "bad_min_qty", message: "Min qty must be a positive integer (1-1,000,000)." },
      { status: 400 },
    );
  }
  const leadDays = Number(body.quoted_lead_days);
  if (!Number.isInteger(leadDays) || leadDays < 1 || leadDays > 365) {
    return NextResponse.json(
      { error: "bad_lead_days", message: "Lead days must be a positive integer (1-365)." },
      { status: 400 },
    );
  }
  const notes = (body.quoted_notes ?? "").trim();
  if (notes.length > 4000) {
    return NextResponse.json(
      { error: "bad_notes", message: "Notes must be ≤ 4000 characters." },
      { status: 400 },
    );
  }

  const sb = getServiceRoleClient();
  // Fetch first to make sure the RFQ exists and is open.
  // The trigger would catch the state mismatch, but a clean
  // 4xx is better for the admin UI than a Postgres exception.
  const { data: existing } = await sb
    .from("rfqs")
    .select("id, status")
    .eq("id", rfqId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.status !== "open") {
    return NextResponse.json(
      { error: "bad_state", message: `RFQ is ${existing.status}, not open. Can't quote a non-open RFQ.` },
      { status: 409 },
    );
  }

  const { data, error } = await sb
    .from("rfqs")
    .update({
      status: "quoted",
      quoted_price_cny_fen: price,
      quoted_min_qty: minQty,
      quoted_lead_days: leadDays,
      quoted_notes: notes || null,
      admin_owner_id: admin.id,
    })
    .eq("id", rfqId)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Phase 22 fan-out: email the buyer the quote.
  void import("@/lib/email").then(({ notifyRFQQuoted }) =>
    notifyRFQQuoted(rfqId).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[rfqs] notifyRFQQuoted failed:", e);
    }),
  );

  return NextResponse.json({ ok: true, rfq: data });
}
