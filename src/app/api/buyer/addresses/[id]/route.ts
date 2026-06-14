// PATCH /api/buyer/addresses/[id]
// DELETE /api/buyer/addresses/[id]
//
// Phase 19: edit or delete one of the signed-in buyer's saved
// shipping addresses.
//
// PATCH: any subset of { label, full_name, phone, country,
// district, address_line, is_default }. If is_default=true, the
// trigger `addresses_single_default_t` (migration 0025) clears
// any other default for the same user.
//
// DELETE: removes the row. If the deleted row was the default,
// we promote the most-recently-updated remaining row to default
// so /checkout always has something to pre-fill (the alternative
// is "no default" which forces a manual pick on every checkout).
//
// Auth: cookie-bound server client. RLS enforces user ownership
// (select/insert/update/delete) — the row only exists for the
// caller if auth.uid() = user_id.

import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

const ALLOWED_LABELS = new Set([
  "Home",
  "Office",
  "3PL",
  "Factory",
  "Other",
]);

type PatchBody = {
  label?: string;
  full_name?: string;
  phone?: string;
  country?: string;
  district?: string;
  address_line?: string;
  is_default?: boolean;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = rateLimit({
    key: `addresses.update:${clientKey(req)}`,
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

  const { id } = await params;
  const addressId = Number(id);
  if (!Number.isFinite(addressId)) {
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

  // Build the patch (only include fields the client sent).
  const patch: Record<string, any> = {};
  if (body.label !== undefined) {
    const l = (body.label ?? "").trim();
    if (!ALLOWED_LABELS.has(l)) {
      return NextResponse.json(
        { error: "bad_label", message: `Label must be one of: ${[...ALLOWED_LABELS].join(", ")}` },
        { status: 400 },
      );
    }
    patch.label = l;
  }
  if (body.full_name !== undefined) {
    const s = (body.full_name ?? "").trim();
    if (s.length < 2 || s.length > 80) {
      return NextResponse.json(
        { error: "bad_full_name", message: "Full name must be 2-80 characters." },
        { status: 400 },
      );
    }
    patch.full_name = s;
  }
  if (body.phone !== undefined) {
    const s = (body.phone ?? "").trim();
    if (s.length < 4 || s.length > 20) {
      return NextResponse.json(
        { error: "bad_phone", message: "Phone must be 4-20 characters." },
        { status: 400 },
      );
    }
    patch.phone = s;
  }
  if (body.country !== undefined) {
    const s = (body.country ?? "").trim().toUpperCase();
    if (s.length !== 2) {
      return NextResponse.json(
        { error: "bad_country", message: "Country must be a 2-letter code." },
        { status: 400 },
      );
    }
    patch.country = s;
  }
  if (body.district !== undefined) {
    const s = (body.district ?? "").trim();
    if (s.length < 2 || s.length > 80) {
      return NextResponse.json(
        { error: "bad_district", message: "District must be 2-80 characters." },
        { status: 400 },
      );
    }
    patch.district = s;
  }
  if (body.address_line !== undefined) {
    const s = (body.address_line ?? "").trim();
    if (s.length < 4 || s.length > 200) {
      return NextResponse.json(
        { error: "bad_address_line", message: "Address line must be 4-200 characters." },
        { status: 400 },
      );
    }
    patch.address_line = s;
  }
  if (body.is_default !== undefined) {
    patch.is_default = !!body.is_default;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "empty_patch", message: "Nothing to update." },
      { status: 400 },
    );
  }

  const { data, error } = await sb
    .from("addresses")
    .update(patch)
    .eq("id", addressId)
    .eq("user_id", user.id) // belt-and-suspenders; RLS already enforces this
    .select("*")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "race_default", message: "Default-address race; refresh and retry." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, address: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = rateLimit({
    key: `addresses.delete:${clientKey(req)}`,
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

  const { id } = await params;
  const addressId = Number(id);
  if (!Number.isFinite(addressId)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  // Fetch first so we know if this was the default (we'll
  // promote a sibling if so).
  const { data: existing } = await sb
    .from("addresses")
    .select("id, is_default")
    .eq("id", addressId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { error } = await sb
    .from("addresses")
    .delete()
    .eq("id", addressId)
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If we just deleted the default, promote the most-recently-
  // updated remaining row so /checkout has something to pre-fill.
  if (existing.is_default) {
    const { data: remaining } = await sb
      .from("addresses")
      .select("id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (remaining) {
      await sb
        .from("addresses")
        .update({ is_default: true })
        .eq("id", remaining.id)
        .eq("user_id", user.id);
    }
  }
  return NextResponse.json({ ok: true });
}
