// /api/admin/settings (GET)
//
// Phase 48 (2026-06-18): admin-only listing of all settings.
// Admin UI (/admin/settings) hits this on mount to render the form.
//
// Auth: requireAdminApi — anon → 401, non-admin → 403.
// Returns: { ok: true, settings: [{ key, value, updatedAt, updatedBy }] }

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/settings
 *
 * Phase 48 (2026-06-18): returns all settings as a JSON array.
 *
 * We bypass unstable_cache here on purpose — the admin UI hits this
 * once on page load (interactive, infrequent), and bypassing the
 * cache makes PATCH-then-GET reads instantly consistent. For the
 * PUBLIC side (home page, search, PDP) the cached versions in
 * getFxCnyBdt() still apply — those are the ones that benefit from
 * 60s caching to save DB hits.
 */
export async function GET(req: Request) {
  const gate = await requireAdminApi(req);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: gate.error },
      { status: gate.status },
    );
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("settings")
    .select("key, value, updated_at, updated_by");
  if (error) {
    return NextResponse.json(
      { ok: false, error: `db: ${error.message}` },
      { status: 500 },
    );
  }
  const list = (data ?? []).map((row) => ({
    key: row.key,
    value: row.value,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }));
  return NextResponse.json({ ok: true, settings: list });
}