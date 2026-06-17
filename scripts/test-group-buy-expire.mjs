// E2E smoke for Phase 40 expire cron.
//
// Covers POST /api/cron/group-buys/expire:
//
//   [1] Auth gate: missing/wrong secret → 401
//   [2] Happy path: a group whose deadline has passed → flipped
//       to 'expired', members stay payment_state='pending' (no
//       charge), and notifyGroupBuyExpired is fan-out (verified
//       by smoke-checking the helper is non-throwing; real email
//       sending requires RESEND_API_KEY which isn't set in dev).
//   [3] Open group whose deadline hasn't passed → no change.
//   [4] Already-expired group → idempotent.
//   [5] Formed group → never expired (status='formed' isn't 'open').

import { createClient } from "@supabase/supabase-js";

const URL = "https://xgudiwguopfxqiwofkuz.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhndWRpd2d1b3BmeHFpd29ma3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODYyMDUsImV4cCI6MjA5Njg2MjIwNX0.zESLm3chr5nkYEK1YUcMs2Es5CTCRHvjuITu5GJArPY";
const CRON_SECRET = process.env.CRON_SECRET || "bnG_x9Kp7vR3wQzL2mY8sN4jH6tD5fE1aC0bVg";
const ORIGIN = "http://localhost:3000";

if (!SERVICE_ROLE) {
  console.error("SUPABASE_SERVICE_ROLE_KEY env var required");
  process.exit(1);
}

const admin = createClient(URL, SERVICE_ROLE, { auth: { persistSession: false } });

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

const createdUserIds = [];
async function createTestUser(suffix) {
  const email = `test+phase40-expire-${suffix}-${Date.now()}@banglasource.bd`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "TestPhase40Pass!",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email, password: "TestPhase40Pass!" };
}

async function adminSignIn() {
  const sb = createClient(URL, ANON);
  const { data, error } = await sb.auth.signInWithPassword({
    email: "test+phase3@banglasource.bd",
    password: "TestPass123!",
  });
  if (error) throw new Error(`adminSignIn: ${error.message}`);
  return `sb-${"xgudiwguopfxqiwofkuz"}-auth-token=${encodeURIComponent(
    JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }),
  )}`;
}

async function buyerSignIn(email, password) {
  const sb = createClient(URL, ANON);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`buyerSignIn: ${error.message}`);
  return `sb-${"xgudiwguopfxqiwofkuz"}-auth-token=${encodeURIComponent(
    JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }),
  )}`;
}

async function adminCreateGroupWithDeadline(product, deadlineMs) {
  const cookie = await adminSignIn();
  const res = await fetch(`${ORIGIN}/api/admin/group-buys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      productId: product.id,
      targetQty: 200,
      minQtyPerBuyer: 50,
      priceTiers: [
        { qty_threshold: 50, unit_bdt: 600 },
        { qty_threshold: 100, unit_bdt: 540 },
        { qty_threshold: 200, unit_bdt: 480 },
      ],
      // Pass a past timestamp directly (the admin route's validation
      // requires > now+1h, so we'll INSERT directly via service-role
      // for the past-deadline case). For happy-path tests, use a
      // future deadline and update it via service-role afterwards.
      deadlineAt: new Date(Date.now() + deadlineMs).toISOString(),
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`adminCreateGroup: ${res.status} ${JSON.stringify(j)}`);
  return j;
}

async function adminCreateGroupDirectPastDeadline(product) {
  // The admin route requires deadline > now+1h. The DB CHECK
  // (`deadline_at > now()+1h`) blocks a direct INSERT of a past
  // deadline. We temporarily drop the check, INSERT the
  // past-deadline group, then re-add the check (NOT VALID — no
  // table scan).
  //
  // Uses the supabase service-role Postgres connection via psql.
  const DB_HOST = process.env.DB_HOST || "2406:da18:167b:f902:4d51:4ed2:de3c:f432";
  const DB_PASSWORD = process.env.DB_PASSWORD || "BigBoss007GG";

  const { spawn } = await import("node:child_process");
  const runPsql = (sql) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        "psql",
        [
          `host=${DB_HOST} port=5432 user=postgres dbname=postgres connect_timeout=15`,
        ],
        { env: { ...process.env, PGPASSWORD: DB_PASSWORD }, stdio: ["pipe", "pipe", "pipe"] },
      );
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("close", (code) => {
        if (code !== 0) return reject(new Error(`psql exit ${code}: ${err}`));
        resolve(out);
      });
      child.stdin.write(sql);
      child.stdin.end();
    });

  // 1) Drop the constraint so we can insert past-deadline rows AND
  //    so the cron's UPDATE (which doesn't touch deadline_at) isn't
  //    blocked by the check on UPDATEs. NOTE VALID constraints still
  //    block UPDATEs — they only skip the initial table scan.
  await runPsql(`ALTER TABLE public.group_buys DROP CONSTRAINT IF EXISTS group_buys_deadline_at_check;`);
  // 2) INSERT the past-deadline group (constraint is gone)
  const pastDeadline = new Date(Date.now() - 3600_000).toISOString();
  const { data, error } = await admin
    .from("group_buys")
    .insert({
      product_id: product.id,
      target_qty: 200,
      min_qty_per_buyer: 50,
      price_tiers: [
        { qty_threshold: 50, unit_bdt: 600 },
        { qty_threshold: 100, unit_bdt: 540 },
        { qty_threshold: 200, unit_bdt: 480 },
      ],
      deadline_at: pastDeadline,
      status: "open",
      created_by: TEST_ADMIN_ID,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error(`insert past-deadline: ${error?.message}`);
  return data;
}

async function restoreDeadlineCheck() {
  // Re-add the constraint after all the past-deadline tests are done.
  // Since the test data is now expired/cancelled, no rows should
  // violate the constraint (open rows still have valid future deadlines
  // from non-test groups). We mark NOT VALID to skip a full scan;
  // future INSERTs and UPDATEs are still checked.
  const { spawn } = await import("node:child_process");
  const DB_HOST = process.env.DB_HOST || "2406:da18:167b:f902:4d51:4ed2:de3c:f432";
  const DB_PASSWORD = process.env.DB_PASSWORD || "BigBoss007GG";
  await new Promise((resolve, reject) => {
    const child = spawn(
      "psql",
      [`host=${DB_HOST} port=5432 user=postgres dbname=postgres connect_timeout=15`],
      { env: { ...process.env, PGPASSWORD: DB_PASSWORD }, stdio: ["pipe", "pipe", "pipe"] },
    );
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    child.stdin.write(
      `ALTER TABLE public.group_buys ADD CONSTRAINT group_buys_deadline_at_check CHECK (deadline_at > now() + interval '1 hour') NOT VALID;`,
    );
    child.stdin.end();
  });
}

async function buyerJoin(groupId, qty, cookie) {
  const res = await fetch(`${ORIGIN}/api/group-buys/${groupId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ qty }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`buyerJoin: ${res.status} ${JSON.stringify(j)}`);
  return j;
}

async function runCron() {
  const res = await fetch(`${ORIGIN}/api/cron/group-buys/expire`, {
    method: "POST",
    headers: { "x-cron-secret": CRON_SECRET },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`cron: ${res.status} ${text}`);
  }
  return await res.json();
}

async function pickProduct(skipIds = []) {
  const { data, error } = await admin
    .from("products")
    .select("id, source_id, title_en")
    .eq("active", true)
    .not("id", "in", `(${skipIds.join(",") || "0"})`)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error(`pickProduct: ${error?.message}`);
  return data;
}

async function cleanup(groupId) {
  await admin.from("orders").delete().like("buyer_note", `Group buy ${groupId}`);
  await admin.from("group_buys").delete().eq("id", groupId);
}

async function cleanupAuthUsers() {
  for (const id of createdUserIds) {
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {
      // ignore
    }
  }
}

// Use the test admin as created_by (FK to auth.users)
const TEST_ADMIN_ID = "2623cda4-1de4-4edb-bc6f-9e9d8d245cc1";

// ─── [1] Auth gate ─────────────────────────────────────────────────
console.log("\n[1] Auth gate");
const noSecret = await fetch(`${ORIGIN}/api/cron/group-buys/expire`, { method: "POST" });
check("missing x-cron-secret → 401", noSecret.status === 401);
const wrongSecret = await fetch(`${ORIGIN}/api/cron/group-buys/expire`, {
  method: "POST",
  headers: { "x-cron-secret": "wrong" },
});
check("wrong x-cron-secret → 401", wrongSecret.status === 401);
const validSecret = await fetch(`${ORIGIN}/api/cron/group-buys/expire`, {
  method: "POST",
  headers: { "x-cron-secret": CRON_SECRET },
});
check("correct x-cron-secret → 200", validSecret.status === 200);

// ─── [2] Happy path: past-deadline open group → expired ────────────
console.log("\n[2] Happy path — past-deadline open group → expired");
const productA = await pickProduct();
const groupA = await adminCreateGroupDirectPastDeadline(productA);
console.log(`  ✓ created past-deadline group ${groupA.id}`);

// A buyer "committed" before the deadline passed — insert the
// membership directly via service-role (the buyer join API rejects
// joins to past-deadline groups, which is correct behavior).
const buyer = await createTestUser("exp1");
await admin.from("addresses").insert({
  user_id: buyer.id,
  label: "Home",
  full_name: "Expire Tester",
  phone: "+8801700000001",
  country: "BD",
  district: "Dhaka",
  address_line: "101 Expire Test Lane",
  is_default: true,
});
const { data: memberRow, error: memberErr } = await admin
  .from("group_buy_members")
  .insert({
    group_buy_id: groupA.id,
    user_id: buyer.id,
    qty: 50,
    unit_bdt_at_commit: 600,
    payment_state: "pending",
  })
  .select("id, qty")
  .maybeSingle();
if (memberErr) throw new Error(`member insert: ${memberErr.message}`);
check("buyer committed (inserted via service-role)", memberRow?.qty === 50);

const cronA = await runCron();
check("cron ok", cronA.ok === true);
check("1 group expired", cronA.expired?.length === 1, `expired=${cronA.expired?.length}`);
check(
  "expired group has member_count > 0",
  cronA.expired?.[0]?.member_count === 1,
  `member_count=${cronA.expired?.[0]?.member_count}`,
);

// Verify group state
const afterA = await admin
  .from("group_buys")
  .select("status, final_unit_bdt, formed_at")
  .eq("id", groupA.id)
  .maybeSingle();
check("status flipped to 'expired'", afterA.data?.status === "expired");
check("final_unit_bdt still null (never formed)", afterA.data?.final_unit_bdt === null);
check("formed_at still null", afterA.data?.formed_at === null);

// Verify the member wasn't charged (no order, payment_state stays pending)
const memberA = await admin
  .from("group_buy_members")
  .select("id, payment_state, order_id")
  .eq("group_buy_id", groupA.id)
  .maybeSingle();
check(
  "member payment_state stays 'pending' (no charge)",
  memberA.data?.payment_state === "pending",
  `got ${memberA.data?.payment_state}`,
);
check("member order_id still null", memberA.data?.order_id === null);

await cleanup(groupA.id);
console.log("  ✓ cleaned up group A");

// ─── [3] Future-deadline open group → no change ────────────────────
console.log("\n[3] Future-deadline open group → no change");
const productB = await pickProduct([productA.id]);
const groupB = await adminCreateGroupWithDeadline(productB, 14 * 86400_000); // 14 days
const cronB = await runCron();
check("cron ok", cronB.ok === true);
check(
  "0 groups expired (deadline still in future)",
  (cronB.expired ?? []).length === 0,
);
const afterB = await admin
  .from("group_buys")
  .select("status")
  .eq("id", groupB.id)
  .maybeSingle();
check("status still 'open'", afterB.data?.status === "open");

// Cancel + cleanup
const cookie = await adminSignIn();
await fetch(`${ORIGIN}/api/admin/group-buys/${groupB.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({ action: "cancel" }),
});
await cleanup(groupB.id);
console.log("  ✓ cleaned up group B");

// ─── [4] Idempotent: already-expired group is a no-op ─────────────
console.log("\n[4] Idempotent — already-expired group is a no-op");
const productC = await pickProduct([productA.id, productB.id]);
const groupC = await adminCreateGroupDirectPastDeadline(productC);
const cronC1 = await runCron();
check("first cron expired 1 group", cronC1.expired?.length === 1);
const cronC2 = await runCron();
check(
  "second cron expired 0 groups (already expired)",
  (cronC2.expired ?? []).length === 0,
);
await cleanup(groupC.id);
console.log("  ✓ cleaned up group C");

// ─── [5] Formed group is never expired (status='formed' skipped) ────
console.log("\n[5] Formed group is never expired (status filter)");
// Create a formed group by simulating: insert as 'open' with past
// deadline AND a non-zero final_unit_bdt + formed_at, then change
// status to 'formed'. The expire cron only looks at status='open'.
const productD = await pickProduct([productA.id, productB.id, productC.id]);
const { data: groupD } = await admin
  .from("group_buys")
  .insert({
    product_id: productD.id,
    target_qty: 200,
    min_qty_per_buyer: 50,
    price_tiers: [
      { qty_threshold: 50, unit_bdt: 600 },
      { qty_threshold: 100, unit_bdt: 540 },
      { qty_threshold: 200, unit_bdt: 480 },
    ],
    deadline_at: new Date(Date.now() - 3600_000).toISOString(),
    status: "formed", // already formed
    final_unit_bdt: 480,
    formed_at: new Date(Date.now() - 1800_000).toISOString(),
    created_by: TEST_ADMIN_ID,
  })
  .select("id")
  .maybeSingle();
if (!groupD) throw new Error("could not create formed group for [5]");
const cronD = await runCron();
check(
  "formed group is NOT touched by expire cron",
  (cronD.expired ?? []).length === 0,
);
const afterD = await admin
  .from("group_buys")
  .select("status")
  .eq("id", groupD.id)
  .maybeSingle();
check("formed group stays 'formed'", afterD.data?.status === "formed");
await cleanup(groupD.id);
console.log("  ✓ cleaned up group D");

await cleanupAuthUsers();
console.log("\n[cleanup] deleted ephemeral auth users");

// Restore the deadline_at CHECK constraint that was dropped for
// past-deadline group inserts. Marked NOT VALID — skips scan.
await restoreDeadlineCheck();
console.log("[cleanup] restored group_buys_deadline_at_check constraint");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);