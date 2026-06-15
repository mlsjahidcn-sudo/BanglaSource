// PATCH /api/buyer/profile
//
// Phase 21 close-out (Phase 33, 2026-06-15). Lets the signed-in
// buyer update their own profile fields:
//   full_name: string | null
//   company:   string | null
//   phone:     string | null
//   country:   string | null   (2-letter ISO code, e.g. "BD")
//
// Email and is_admin are NOT editable from here (admin-only or
// managed by auth). The user can only update their OWN row.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireUserApi } from "@/lib/portal-auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

const MAX_NAME = 80;
const MAX_COMPANY = 120;
const MAX_PHONE = 30;
const COUNTRY_RE = /^[A-Z]{2}$/;

type PatchBody = {
  full_name?: string | null;
  company?: string | null;
  phone?: string | null;
  country?: string | null;
};

export async function PATCH(req: NextRequest) {
  const rl = rateLimit({
    key: `buyer.profile.update:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  const guard = await requireUserApi(req);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status },
    );
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

  // Build the patch (only include fields the user sent)
  const patch: Record<string, string | null> = {};

  if (body.full_name !== undefined) {
    if (body.full_name !== null && body.full_name.length > MAX_NAME) {
      return NextResponse.json(
        { error: "full_name_too_long", max: MAX_NAME },
        { status: 400 },
      );
    }
    // Empty string → treat as null (cleared field)
    patch.full_name = body.full_name?.trim() ? body.full_name.trim() : null;
  }

  if (body.company !== undefined) {
    if (body.company !== null && body.company.length > MAX_COMPANY) {
      return NextResponse.json(
        { error: "company_too_long", max: MAX_COMPANY },
        { status: 400 },
      );
    }
    patch.company = body.company?.trim() ? body.company.trim() : null;
  }

  if (body.phone !== undefined) {
    if (body.phone !== null && body.phone.length > MAX_PHONE) {
      return NextResponse.json(
        { error: "phone_too_long", max: MAX_PHONE },
        { status: 400 },
      );
    }
    patch.phone = body.phone?.trim() ? body.phone.trim() : null;
  }

  if (body.country !== undefined) {
    if (body.country !== null) {
      const c = body.country.toUpperCase();
      if (!COUNTRY_RE.test(c)) {
        return NextResponse.json(
          { error: "bad_country", message: "2-letter ISO code, e.g. 'BD'" },
          { status: 400 },
        );
      }
      patch.country = c;
    } else {
      patch.country = null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "empty_patch" },
      { status: 400 },
    );
  }

  // Service-role: we can update any row by id, but the guard
  // already locked us to the signed-in user. Double-check the
  // id matches.
  const sb = getServiceRoleClient();
  const { data, error } = await sb
    .from("profiles")
    .update(patch as never)
    .eq("id", guard.user.id)
    .select("email, full_name, company, phone, country")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "profile_not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, profile: data });
}
