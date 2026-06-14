// POST /api/buyer/addresses
// GET  /api/buyer/addresses
//
// Phase 19: create or list a signed-in buyer's saved shipping
// addresses. The form is the same 4 fields as the checkout
// `WireAddress` shape (full_name, phone, district, address_line)
// plus a `label` ('Home' | 'Office' | '3PL' | 'Factory' | 'Other')
// and an `is_default` flag.
//
// If is_default=true, the trigger `addresses_single_default_t`
// (migration 0025) clears any existing default for the same
// user in the same transaction. The partial unique index
// `addresses_one_default_per_user_idx` is the safety net for
// concurrent requests.
//
// Auth: cookie-bound server client. RLS enforces user ownership.

import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

const ALLOWED_LABELS = new Set([
  "Home",
  "Office",
  "3PL",
  "Factory",
  "Other",
]);

type PostBody = {
  label?: string;
  full_name?: string;
  phone?: string;
  country?: string;
  district?: string;
  address_line?: string;
  is_default?: boolean;
};

export async function GET(req: NextRequest) {
  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await sb
    .from("addresses")
    .select("id, label, full_name, phone, country, district, address_line, is_default, created_at, updated_at")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, addresses: data ?? [] });
}

export async function POST(req: NextRequest) {
  const rl = rateLimit({
    key: `addresses.create:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  const sb = await getServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Validate
  const label = (body.label ?? "Home").trim();
  if (!ALLOWED_LABELS.has(label)) {
    return NextResponse.json(
      { error: "bad_label", message: `Label must be one of: ${[...ALLOWED_LABELS].join(", ")}` },
      { status: 400 },
    );
  }
  const full_name = (body.full_name ?? "").trim();
  if (full_name.length < 2 || full_name.length > 80) {
    return NextResponse.json(
      { error: "bad_full_name", message: "Full name must be 2-80 characters." },
      { status: 400 },
    );
  }
  const phone = (body.phone ?? "").trim();
  if (phone.length < 4 || phone.length > 20) {
    return NextResponse.json(
      { error: "bad_phone", message: "Phone must be 4-20 characters." },
      { status: 400 },
    );
  }
  const country = (body.country ?? "BD").trim().toUpperCase();
  if (country.length !== 2) {
    return NextResponse.json(
      { error: "bad_country", message: "Country must be a 2-letter code." },
      { status: 400 },
    );
  }
  const district = (body.district ?? "").trim();
  if (district.length < 2 || district.length > 80) {
    return NextResponse.json(
      { error: "bad_district", message: "District must be 2-80 characters." },
      { status: 400 },
    );
  }
  const address_line = (body.address_line ?? "").trim();
  if (address_line.length < 4 || address_line.length > 200) {
    return NextResponse.json(
      { error: "bad_address_line", message: "Address line must be 4-200 characters." },
      { status: 400 },
    );
  }
  const is_default = body.is_default ?? false;

  // If this is the user's first address, force is_default=true so
  // /checkout always has something to pre-fill.
  let resolvedDefault = is_default;
  if (!is_default) {
    const { count } = await sb
      .from("addresses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) === 0) resolvedDefault = true;
  }

  const { data, error } = await sb
    .from("addresses")
    .insert({
      user_id: user.id,
      label,
      full_name,
      phone,
      country,
      district,
      address_line,
      is_default: resolvedDefault,
    })
    .select("*")
    .single();
  if (error) {
    // The partial unique index will surface here as a 23505 if
    // there's a concurrent default flip. Treat as success-ish
    // (the user got their address; the default state is
    // whatever the trigger left).
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "race_default", message: "Default-address race; refresh and retry." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, address: data });
}
