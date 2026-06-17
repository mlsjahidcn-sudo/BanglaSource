// E2E smoke for Phase 48 admin-configurable FX rate.
//
// [1] GET /api/admin/settings requires auth (anon → 401)
// [2] Admin GET returns the seeded fx_cny_bdt row
// [3] Admin PATCH valid value (18.30) succeeds
// [4] Admin PATCH invalid value (string) → 400 validation error
// [5] Admin PATCH out-of-range (100) → 400 validation error
// [6] Admin PATCH unknown key → 400 validation error
// [7] DB persists the new value (read back via service-role)
// [8] Cache bust: next GET sees new value immediately
// [9] RLS: anon client can't read settings (zero rows)
// [10] Default rate on home page renders the live value
// [11] Reset rate to 18.25 before exit
//
// Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-fx-settings.mjs

import { createClient } from "@supabase/supabase-js";

const URL = "https://xgudiwguopfxqiwofkuz.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhndWRpd2d1b3BmeHFpd29ma3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODYyMDUsImV4cCI6MjA5Njg2MjIwNX0.zESLm3chr5nkYEK1YUcMs2Es5CTCRHvjuITu5GJArPY";
const ORIGIN = "http://localhost:3000";
const ADMIN_EMAIL = "mlsjahid@qq.com";
const ADMIN_PASSWORD = "PXqHbyidOh47cYsi";

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  // Service-role client for DB-level checks (RLS bypass)
  const svc = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Anon client — should hit RLS (will get 0 rows on settings table)
  const anon = createClient(URL, ANON);

  // Sign in as admin via supabase-js, then format session as the
  // sb-<ref>-auth-token cookie that the server expects.
  const supabase = createClient(URL, ANON);
  const { data: signin, error: signErr } =
    await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
  if (signErr || !signin.session) {
    console.error("Admin sign-in failed:", signErr?.message);
    process.exit(1);
  }
  const adminId = signin.user.id;
  const sbSession = JSON.stringify({
    access_token: signin.session.access_token,
    refresh_token: signin.session.refresh_token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });
  const adminCookie = `sb-xgudiwguopfxqiwofkuz-auth-token=${encodeURIComponent(sbSession)}`;

  function adminFetch(path, init = {}) {
    return fetch(`${ORIGIN}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Cookie: adminCookie,
      },
      redirect: "manual",
    });
  }

  console.log("[1] GET /api/admin/settings requires auth");
  const anonRes = await fetch(`${ORIGIN}/api/admin/settings`);
  check("anon GET → 401", anonRes.status === 401, String(anonRes.status));
  const anonPatch = await fetch(`${ORIGIN}/api/admin/settings/fx_cny_bdt`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: 18.3 }),
  });
  check("anon PATCH → 401", anonPatch.status === 401, String(anonPatch.status));

  console.log("\n[2] Admin GET returns the seeded row");
  const listRes = await adminFetch("/api/admin/settings");
  const listJson = await listRes.json();
  check("admin GET → 200", listRes.status === 200, String(listRes.status));
  check(
    "response.ok === true",
    listJson.ok === true,
    JSON.stringify(listJson).slice(0, 80),
  );
  const fxRow = (listJson.settings ?? []).find((s) => s.key === "fx_cny_bdt");
  check("fx_cny_bdt row present", !!fxRow);
  check(
    "current value is a positive number",
    Number.isFinite(Number(fxRow?.value)) && Number(fxRow?.value) > 0,
    `value=${fxRow?.value}`,
  );
  check(
    "updated_at is a valid ISO timestamp",
    typeof fxRow?.updatedAt === "string" &&
      !Number.isNaN(new Date(fxRow.updatedAt).getTime()),
  );

  // Snapshot the value at the start so later assertions can use
  // exact comparisons. The home-page test [10] needs to know the
  // value at PATCH time, not the seed.
  const startValue = Number(fxRow?.value);
  const patchValue = 18.3;
  check(
    "start value !== patch value (sanity)",
    startValue !== patchValue,
    `start=${startValue}`,
  );

  console.log("\n[3] Admin PATCH valid value (18.30)");
  const patchRes = await adminFetch("/api/admin/settings/fx_cny_bdt", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: patchValue }),
  });
  const patchJson = await patchRes.json();
  check("PATCH → 200", patchRes.status === 200, String(patchRes.status));
  check(
    `response.value === ${patchValue}`,
    Number(patchJson.row?.value) === patchValue,
    `value=${patchJson.row?.value}`,
  );
  check(
    "updated_by === admin id",
    patchJson.row?.updatedBy === adminId,
    `updatedBy=${patchJson.row?.updatedBy}`,
  );

  console.log("\n[4] Admin PATCH invalid value (string)");
  const badRes = await adminFetch("/api/admin/settings/fx_cny_bdt", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: "not-a-number" }),
  });
  check("PATCH → 400", badRes.status === 400, String(badRes.status));
  const badJson = await badRes.json();
  check(
    "error mentions validation",
    /validation/i.test(badJson.error ?? ""),
    badJson.error,
  );

  console.log("\n[5] Admin PATCH out-of-range (100)");
  const rangeRes = await adminFetch("/api/admin/settings/fx_cny_bdt", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: 100 }),
  });
  check("PATCH → 400", rangeRes.status === 400, String(rangeRes.status));

  console.log("\n[6] Admin PATCH unknown key");
  const unkRes = await adminFetch("/api/admin/settings/unknown_key", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: 1 }),
  });
  check("PATCH → 400", unkRes.status === 400, String(unkRes.status));
  const unkJson = await unkRes.json();
  check(
    "error mentions unknown",
    /unknown/i.test(unkJson.error ?? ""),
    unkJson.error,
  );

  console.log("\n[7] DB persists the new value (read via service-role)");
  const { data: dbRow } = await svc
    .from("settings")
    .select("value, updated_by")
    .eq("key", "fx_cny_bdt")
    .single();
  check(
    `DB value === ${patchValue}`,
    Number(dbRow?.value) === patchValue,
    `value=${dbRow?.value}`,
  );
  check(
    "DB updated_by === admin id",
    dbRow?.updated_by === adminId,
  );

  console.log("\n[8] Cache bust: next admin GET sees the new value");
  const listRes2 = await adminFetch("/api/admin/settings");
  const listJson2 = await listRes2.json();
  const fxRow2 = (listJson2.settings ?? []).find((s) => s.key === "fx_cny_bdt");
  check(
    `value === ${patchValue} in next fetch (cache busted)`,
    Number(fxRow2?.value) === patchValue,
    `value=${fxRow2?.value}`,
  );

  console.log("\n[9] RLS: anon client can't read settings");
  const { data: anonRows, error: anonErr } = await anon
    .from("settings")
    .select("key")
    .limit(5);
  check(
    "anon client sees 0 rows (or query errors)",
    anonErr !== null || (anonRows ?? []).length === 0,
    `rows=${(anonRows ?? []).length} err=${anonErr?.message ?? "none"}`,
  );

  console.log("\n[10] Home page renders the live FX rate");
  // Hit the home page AFTER the PATCH so the FX prop on
  // HomeClient reflects the new value (page-level cache revalidate
  // = 60, so the freshest possible value is shown after the
  // revalidateTag fired in step [3]).
  // Brief delay to let the dev server process the revalidate
  // (Next 16 caches at multiple layers and the in-memory page
  // cache can take a tick to flush).
  await new Promise((r) => setTimeout(r, 250));
  const homeRes = await fetch(`${ORIGIN}/`);
  const homeHtml = await homeRes.text();
  // React SSR inserts <!-- --> comment markers around interpolated
  // text nodes, so the rendered HTML looks like:
  //   "1 CNY = <!-- -->18.30<!-- --> BDT"
  // We match on the number after the comment, NOT the literal
  // substring "1 CNY = 18.30 BDT" (which would never match).
  const fxMatch = homeHtml.match(/1 CNY =[^<]*<!-- -->([0-9.]+)/);
  const renderedFx = fxMatch ? fxMatch[1] : "NO MATCH";
  check(
    `home page shows live FX = ${patchValue.toFixed(2)} BDT`,
    Number(renderedFx) === patchValue,
    `rendered=${renderedFx}`,
  );

  console.log("\n[11] Reset rate to 18.25 before exit");
  const resetRes = await adminFetch("/api/admin/settings/fx_cny_bdt", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: 18.25 }),
  });
  check("reset → 200", resetRes.status === 200, String(resetRes.status));
  check(
    "reset value === 18.25",
    Number((await resetRes.json()).row?.value) === 18.25,
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});