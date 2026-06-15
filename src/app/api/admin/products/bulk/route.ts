// POST /api/admin/products/bulk
//
// Phase 33. Admin bulk activate/deactivate across the current
// filter set. Body:
//   { active: boolean, source_ids: string[] }
//
// Server-role: bypasses RLS, no per-row auth checks (admin
// already verified). Returns the number of rows updated.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const MAX_IDS = 500;

type Body = {
  active?: boolean;
  source_ids?: string[];
};

export async function POST(req: NextRequest) {
  const rl = rateLimit({
    key: `admin.products.bulk:${clientKey(req)}`,
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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (typeof body.active !== "boolean") {
    return NextResponse.json(
      { error: "missing_field", message: "active: boolean is required" },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.source_ids) || body.source_ids.length === 0) {
    return NextResponse.json(
      { error: "no_ids", message: "source_ids[] is required" },
      { status: 400 },
    );
  }
  if (body.source_ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: "too_many", max: MAX_IDS },
      { status: 400 },
    );
  }
  // Sanity: every id should be a 1688-style numeric or a
  // manual.local/<slug> string. Reject anything that looks like
  // an SQLi attempt.
  const idRe = /^[A-Za-z0-9._-]{2,80}$/;
  for (const id of body.source_ids) {
    if (!idRe.test(id)) {
      return NextResponse.json(
        { error: "bad_id", bad: id },
        { status: 400 },
      );
    }
  }

  const sb = getServiceRoleClient();
  const { data, error } = await sb
    .from("products")
    .update({ active: body.active })
    .in("source_id", body.source_ids)
    .select("id, source_id, active");

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    active: body.active,
    requested: body.source_ids.length,
    updated: data?.length ?? 0,
  });
}
