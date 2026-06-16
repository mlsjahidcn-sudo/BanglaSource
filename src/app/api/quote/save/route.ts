// POST /api/quote/save
// Persist a quote computed by /api/quote/landed to the quotes table.
// Auth required — the user must be signed in (RLS: user_id = auth.uid()).

import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import type { LandedBreakdown, ShippingMode } from "@/lib/pricing";

const RATE_LIMIT = 30; // tighter — this is a write
const RATE_WINDOW_MS = 60_000;

type Body = {
  quote: LandedBreakdown;
  product_ids: string[];
  shipping_mode: ShippingMode;
  total_qty: number;
};

export async function POST(req: NextRequest) {
  // ── Rate limit
  const rl = rateLimit({
    key: `quote.save:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: `Too many saves. Try again in ${Math.ceil(rl.resetIn / 1000)}s.`,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  // ── Auth
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in to save quotes." },
      { status: 401 },
    );
  }

  // ── Validate body
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "bad_json", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { quote, product_ids, shipping_mode, total_qty } = body;
  if (
    !quote ||
    !Array.isArray(product_ids) ||
    product_ids.length === 0 ||
    !["air", "sea", "express"].includes(shipping_mode) ||
    !Number.isInteger(total_qty) ||
    total_qty <= 0
  ) {
    return NextResponse.json(
      { error: "bad_request", message: "Missing or invalid fields" },
      { status: 400 },
    );
  }

  // ── Insert
  // `quotes` is a legacy table not in the typed `Database` shape.
  // Cast to `never` at the call boundary so the route can target
  // the real schema columns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("quotes")
    .insert({
      user_id: user.id,
      quote_id: quote.quoteId,
      product_ids,
      shipping_mode,
      total_qty,
      fob_cny_fen: quote.cnSubtotalCny,
      fx_cny_bdt: quote.fx,
      cn_subtotal_bdt: quote.cnSubtotalBdt,
      intl_bdt: quote.intlBdt,
      agent_bdt: quote.agentBdt,
      consol_bdt: quote.consolBdt,
      duty_bdt: quote.dutyBdt,
      // `LandedBreakdown` doesn't expose `dutyPct` directly — the
      // duty is computed per-kg on the order row, not as a
      // percentage. Save `0` here to keep the legacy column
      // satisfied; the real per-kg value is on the order row.
      duty_pct: 0,
      vat_bdt: quote.vatBdt,
      ait_bdt: quote.aitBdt,
      markup_bdt: quote.markupBdt,
      markup_pct: quote.markupPct,
      total_bdt: quote.totalBdt,
      unit_bdt: quote.unitBdt,
      chargeable_kg: quote.chargeableKg,
      transit_days: quote.transitDays,
      status: "pending",
      expires_at: quote.expiresAt,
    })
    .select("quote_id, status, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message, code: error.code },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, quote: data });
}
