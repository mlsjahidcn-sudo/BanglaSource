// /api/admin/settings/[key] (PATCH)
//
// Phase 48 (2026-06-18): admin-only update of one setting.
// Currently the only setting is `fx_cny_bdt`. New settings require
// adding validation in src/lib/settings.ts → setSetting().
//
// Auth: requireAdminApi — anon → 401, non-admin → 403.
// Body: { value: number | string }
// Returns: { ok: true, row: { key, value, updatedAt, updatedBy } }
//          { ok: false, error: "validation: ..." | "db: ..." }
//
// Side effect: revalidateTag("settings") on success — the admin UI
// shows the new value immediately on the next fetch, and any cached
// pricing page sees it within 60s (the unstable_cache TTL).

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const gate = await requireAdminApi(req);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: gate.error },
      { status: gate.status },
    );
  }

  const { key } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "validation: invalid JSON body" },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "validation: body must be an object" },
      { status: 400 },
    );
  }
  const { value } = body as { value?: unknown };
  if (value === undefined || value === null) {
    return NextResponse.json(
      { ok: false, error: "validation: missing 'value'" },
      { status: 400 },
    );
  }

  const result = await setSetting(key, value, gate.user.id);
  if (!result.ok) {
    // Validation errors → 400, DB errors → 500
    const status = result.error.startsWith("validation:") ? 400 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }
  return NextResponse.json({
    ok: true,
    row: {
      key: result.row.key,
      value: result.row.value,
      updatedAt: result.row.updatedAt,
      updatedBy: result.row.updatedBy,
    },
  });
}