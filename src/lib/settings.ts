// /lib/settings.ts
//
// Phase 48 (2026-06-18): runtime-configurable settings backed by the
// `public.settings` table. Each setting has its own typed accessor.
//
// Why this exists:
//   - User feedback: the CNY→BDT rate was hardcoded in pricing.ts
//     (16.85) but the actual market is 18.2-18.3. Hardcoded values
//     rot silently. Admin needs a UI to flip rates without a deploy.
//
// How it works:
//   - Reads go through `unstable_cache` with a 60s TTL. Settings
//     change rarely (maybe weekly), so 60s staleness is acceptable
//     and we save a DB roundtrip per page.
//   - Writes call `revalidateTag("settings")` to bust all caches
//     immediately. No race window between "admin saves" and "user
//     sees new value".
//   - The DB is the source of truth. `FX_CNY_BDT_DEFAULT` in
//     pricing.ts is only the FALLBACK when (a) the DB is unreachable
//     or (b) the row was deleted.
//
// Why we use `unstable_cache` not just a regular fetch:
//   - In Next.js 16 App Router, server components are rendered per
//     request by default. A regular `.from("settings").select()` is
//     a fresh DB call every time. For the home page (which renders
//     many components that each read FX), that's 5-10 extra DB
//     hits per request. unstable_cache dedupes those.
//
// Admin API:
//   - GET    /api/admin/settings             — list all settings
//   - PATCH  /api/admin/settings/[key]       — update one setting

import { unstable_cache, revalidateTag, revalidatePath } from "next/cache";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { FX_CNY_BDT_DEFAULT } from "@/lib/pricing";

/** Cache tag for all settings reads. Wiped on any PATCH. */
export const SETTINGS_CACHE_TAG = "settings";

/**
 * A typed settings row.
 *   - value:     the JSON payload (number / string / boolean / object)
 *   - updatedAt: ISO timestamptz
 *   - updatedBy: auth.users.id of the admin who last wrote it
 *                (null = seeded by migration or service-role write)
 */
export type SettingRow<T = unknown> = {
  key: string;
  value: T;
  updatedAt: string;
  updatedBy: string | null;
};

/**
 * Read all settings as a key → row map. Cached for 60s.
 *
 * Used by the admin settings page to render the full list.
 */
export const getAllSettings = unstable_cache(
  async (): Promise<Record<string, SettingRow>> => {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("settings")
      .select("key, value, updated_at, updated_by");
    if (error) {
      console.error("[getAllSettings] failed:", error.message);
      return {};
    }
    const out: Record<string, SettingRow> = {};
    for (const row of data ?? []) {
      out[row.key] = {
        key: row.key,
        value: row.value,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      };
    }
    return out;
  },
  ["settings-all"],
  { revalidate: 60, tags: [SETTINGS_CACHE_TAG] },
);

/**
 * Read a single setting. Cached for 60s.
 * Returns null if the row doesn't exist (callers handle default).
 */
export const getSetting = unstable_cache(
  async <T = unknown>(key: string): Promise<SettingRow<T> | null> => {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("settings")
      .select("key, value, updated_at, updated_by")
      .eq("key", key)
      .maybeSingle();
    if (error) {
      console.error(`[getSetting:${key}] failed:`, error.message);
      return null;
    }
    if (!data) return null;
    return {
      key: data.key,
      value: data.value as T,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    };
  },
  ["settings-single"],
  { revalidate: 60, tags: [SETTINGS_CACHE_TAG] },
);

/**
 * Typed convenience: read the FX rate with a fallback to the
 * hardcoded default. Used by pricing.ts callers that want to read
 * the live value in one line.
 */
export async function getFxCnyBdt(): Promise<number> {
  const row = await getSetting<number>("fx_cny_bdt");
  const v = row?.value;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return v;
  }
  // Could be stored as a JSON string (e.g. "18.25" with quotes).
  // parseFloat gracefully handles both cases.
  if (typeof v === "string") {
    const parsed = parseFloat(v);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return FX_CNY_BDT_DEFAULT;
}

/**
 * Validate + write a setting. Returns:
 *   { ok: true, row }                              on success
 *   { ok: false, error: "validation: ..." }        on bad input
 *   { ok: false, error: "db: ..." }                on DB failure
 *
 * Always busts the settings cache on success so the new value
 * is visible on the next page load.
 */
export async function setSetting(
  key: string,
  value: unknown,
  updatedBy: string | null,
): Promise<
  | { ok: true; row: SettingRow }
  | { ok: false; error: string }
> {
  // Per-key validation. Add new settings here as we add them.
  if (key === "fx_cny_bdt") {
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? parseFloat(value)
          : NaN;
    if (!Number.isFinite(n)) {
      return { ok: false, error: "validation: fx_cny_bdt must be a number" };
    }
    if (n < 1 || n > 50) {
      return {
        ok: false,
        error: `validation: fx_cny_bdt out of range (${n}). Expected 1-50.`,
      };
    }
  }
  // Unknown keys are rejected — we don't want arbitrary rows
  // being written by buggy callers. If you need a new setting,
  // add it here first.
  if (key !== "fx_cny_bdt") {
    return { ok: false, error: `validation: unknown setting "${key}"` };
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("settings")
    .update({
      value: typeof value === "number" ? value : parseFloat(value as string),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    })
    .eq("key", key)
    .select("key, value, updated_at, updated_by")
    .single();
  if (error || !data) {
    return { ok: false, error: `db: ${error?.message ?? "no row returned"}` };
  }
  // Bust the cache so the next page load sees the new value.
  // Next 16 + postgrest-js 2.108: revalidateTag requires 2 args
  // (the second is the cache lifetime profile — 'max' is the
  // longest, equivalent to the previous 1-arg behavior).
  // The admin API route bypasses this cache anyway (see
  // src/app/api/admin/settings/route.ts), so PATCH-then-GET
  // is always consistent. This revalidate is for the public
  // helpers (getFxCnyBdt) so the home page / search / etc.
  // see the new rate within 60s.
  revalidateTag(SETTINGS_CACHE_TAG, "max");
  // Also bust the home page's page-level cache (revalidate=60
  // in src/app/page.tsx) so the new FX rate is visible
  // immediately instead of waiting up to 60s.
  revalidatePath("/");
  return {
    ok: true,
    row: {
      key: data.key,
      value: data.value,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    },
  };
}