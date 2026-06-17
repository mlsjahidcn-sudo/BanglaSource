// E2E smoke for Phase 40 formation cron.
//
// Covers POST /api/cron/group-buys/form:
//
//   [1] Auth gate: missing/wrong secret → 401
//   [2] Happy path: target hit → status flips open→forming→formed,
//       final_unit_bdt is frozen at the deepest tier met, each
//       member gets an order created via create_order_with_items,
//       each member's payment_state='charged', charged_at is set,
//       order_id is linked. MIN(unit_bdt_at_commit, final_unit_bdt)
//       fairness rule is verified per member.
//   [3] Not-yet-at-target: open group with SUM(qty) < target_qty →
//       no change.
//   [4] Idempotent: already-formed group → second cron run is a no-op
//   [5] Multiple members with mixed prices: the fairness rule
//       (MIN(snapshot, final)) is verified end-to-end on the order.
//
// Setup: creates 3 ephemeral test users via supabase.auth.admin.createUser
// (one per member), gives each a default address, joins the group
// from each via the buyer join API, then runs the cron. Cleanup
// deletes the orders + group_buys + auth users.

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
  const email = `test+phase40-${suffix}-${Date.now()}@banglasource.bd`;
  const password = "TestPhase40Pass!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email, password };
}

async function buyerSignIn(email, password) {
  const sb = createClient(URL, ANON);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`buyerSignIn: ${error.message}`);
  const sbSession = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });
  return `sb-${"xgudiwguopfxqiwofkuz"}-auth-token=${encodeURIComponent(sbSession)}`;
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

async function ensureAddress(userId) {
  const { data: existing } = await admin
    .from("addresses")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await admin
    .from("addresses")
    .insert({
      user_id: userId,
      label: "Office",
      full_name: "Phase 40 Tester",
      phone: "+8801700000000",
      country: "BD",
      district: "Dhaka",
      address_line: "999 Phase-40 Test Lane",
      is_default: true,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`ensureAddress: ${error.message}`);
  return data;
}

async function adminCreateGroup(product, opts = {}) {
  // Sign in as test admin for the cookie
  const anonSb = createClient(URL, ANON);
  const { data, error } = await anonSb.auth.signInWithPassword({
    email: "test+phase3@banglasource.bd",
    password: "TestPass123!",
  });
  if (error) throw new Error(`adminSignIn: ${error.message}`);
  const cookie = `sb-${"xgudiwguopfxqiwofkuz"}-auth-token=${encodeURIComponent(
    JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }),
  )}`;
  const res = await fetch(`${ORIGIN}/api/admin/group-buys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      productId: product.id,
      targetQty: opts.targetQty ?? 200,
      minQtyPerBuyer: opts.minQtyPerBuyer ?? 50,
      priceTiers: opts.priceTiers ?? [
        { qty_threshold: 50, unit_bdt: 600 },
        { qty_threshold: 100, unit_bdt: 540 },
        { qty_threshold: 200, unit_bdt: 480 },
      ],
      deadlineAt: new Date(Date.now() + (opts.deadlineMs ?? 14 * 86400_000)).toISOString(),
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`adminCreateGroup: ${res.status} ${JSON.stringify(j)}`);
  return j;
}

async function pickProduct(skipIds = []) {
  const { data, error } = await admin
    .from("products")
    .select("id, source_id, title_en, weight_kg, volume_cbm, customs_duty_per_kg")
    .eq("active", true)
    .not("id", "in", `(${skipIds.join(",") || "0"})`)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error(`pickProduct: ${error?.message}`);
  return data;
}

async function runCron() {
  const res = await fetch(`${ORIGIN}/api/cron/group-buys/form`, {
    method: "POST",
    headers: { "x-cron-secret": CRON_SECRET },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`cron: ${res.status} ${text}`);
  }
  return await res.json();
}

async function cleanupGroup(groupId) {
  // Delete orders created with the group's buyer_note marker.
  await admin.from("orders").delete().like("buyer_note", `Group buy ${groupId}`);
  // Delete any leftover orders that referenced members of this group
  const { data: leftoverMembers } = await admin
    .from("group_buy_members")
    .select("order_id")
    .eq("group_buy_id", groupId);
  for (const m of leftoverMembers ?? []) {
    if (m.order_id) await admin.from("orders").delete().eq("id", m.order_id);
  }
  // CASCADE removes members.
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

// ─── [1] Auth gate ─────────────────────────────────────────────────
console.log("\n[1] Auth gate");
const noSecret = await fetch(`${ORIGIN}/api/cron/group-buys/form`, { method: "POST" });
check("missing x-cron-secret → 401", noSecret.status === 401);
const wrongSecret = await fetch(`${ORIGIN}/api/cron/group-buys/form`, {
  method: "POST",
  headers: { "x-cron-secret": "wrong" },
});
check("wrong x-cron-secret → 401", wrongSecret.status === 401);
const validSecret = await fetch(`${ORIGIN}/api/cron/group-buys/form`, {
  method: "POST",
  headers: { "x-cron-secret": CRON_SECRET },
});
check("correct x-cron-secret → 200", validSecret.status === 200);

// ─── [2] Happy path: 3 buyers, target hit, fairness verified ────────
console.log("\n[2] Happy path — 3 buyers, target=200, fairness verified");
const productA = await pickProduct();

// Create 3 ephemeral test users + default address for each
const users = [];
for (const s of ["alpha", "beta", "gamma"]) {
  const u = await createTestUser(s);
  await ensureAddress(u.id);
  users.push(u);
}
console.log(`  ✓ created 3 test users with default addresses`);

// Create the group via the admin route
const groupA = await adminCreateGroup(productA, { targetQty: 200, minQtyPerBuyer: 50 });
console.log(`  ✓ created group ${groupA.id}`);

// Each user joins. To capture different unit_bdt_at_commit snapshots,
// we join them SEQUENTIALLY:
//   1) alpha joins 50 (current SUM=0 → unit_bdt_at_commit=600)
//   2) beta joins 100 (current SUM=50 → tier 50 met → unit_bdt_at_commit=540)
//   3) gamma joins 50 (current SUM=150 → tier 100 met → unit_bdt_at_commit=540)
// Total SUM = 200 → tier 200 met → final_unit_bdt = 480
//
// Expected fairness:
//   alpha (snap=600) → MIN(600, 480) = 480 → charged at 480
//   beta  (snap=540) → MIN(540, 480) = 480 → charged at 480
//   gamma (snap=540) → MIN(540, 480) = 480 → charged at 480
// All three pay 480/pc. Line totals:
//   alpha 50 × 480 = 24,000
//   beta 100 × 480 = 48,000
//   gamma 50 × 480 = 24,000

const cookieA = await buyerSignIn(users[0].email, users[0].password);
const cookieB = await buyerSignIn(users[1].email, users[1].password);
const cookieC = await buyerSignIn(users[2].email, users[2].password);

const joinA = await buyerJoin(groupA.id, 50, cookieA);
const joinB = await buyerJoin(groupA.id, 100, cookieB);
const joinC = await buyerJoin(groupA.id, 50, cookieC);

check("alpha committed at 600/pc (qty 50, sum 0 baseline)", joinA.member.unit_bdt_at_commit === 600, `got ${joinA.member.unit_bdt_at_commit}`);
// Beta commits 100 when SUM=50. At SUM=50, tier 50 is met (qty >= 50)
// but tier 100 is NOT yet met (50 < 100). So beta's snapshot is 600.
check("beta committed at 600/pc (qty 100, sum 50 — tier 50 met, tier 100 not yet)", joinB.member.unit_bdt_at_commit === 600, `got ${joinB.member.unit_bdt_at_commit}`);
// Gamma commits 50 when SUM=150. At SUM=150, tier 100 is met (150 >= 100)
// but tier 200 is not (150 < 200). So gamma's snapshot is 540.
check("gamma committed at 540/pc (qty 50, sum 150 — tier 100 met, tier 200 not yet)", joinC.member.unit_bdt_at_commit === 540, `got ${joinC.member.unit_bdt_at_commit}`);
check("current_qty after 3 joins = 200", joinC.pricing.current_qty === 200);

// Sanity: pre-cron status check
const preGb = await admin
  .from("group_buys")
  .select("status, final_unit_bdt")
  .eq("id", groupA.id)
  .maybeSingle();
check("pre-cron status=open", preGb.data?.status === "open");
check("pre-cron final_unit_bdt is null", preGb.data?.final_unit_bdt === null);

// Run the cron
const cronResult = await runCron();
check("cron ok", cronResult.ok === true);
check("cron reported 1 formed", cronResult.formed?.length === 1, `formed=${cronResult.formed?.length}`);
check("cron reported 0 errors", cronResult.errors?.length === 0, JSON.stringify(cronResult.errors));
check("cron reported 0 skipped", (cronResult.skipped ?? []).length === 0, JSON.stringify(cronResult.skipped));

// Verify the group state
const afterGb = await admin
  .from("group_buys")
  .select("status, final_unit_bdt, formed_at")
  .eq("id", groupA.id)
  .maybeSingle();
check("status flipped to 'formed'", afterGb.data?.status === "formed");
check(
  "final_unit_bdt frozen at 480 (tier 200 reached)",
  afterGb.data?.final_unit_bdt === 480,
  `got ${afterGb.data?.final_unit_bdt}`,
);
check("formed_at is set", typeof afterGb.data?.formed_at === "string");

// Verify each member
const membersAfter = await admin
  .from("group_buy_members")
  .select("id, user_id, qty, unit_bdt_at_commit, payment_state, order_id, charged_at")
  .eq("group_buy_id", groupA.id)
  .order("created_at", { ascending: true });
const memberList = membersAfter.data ?? [];
check("3 members exist", memberList.length === 3, `got ${memberList.length}`);
check(
  "all members charged",
  memberList.every((m) => m.payment_state === "charged"),
);
check(
  "all members have order_id",
  memberList.every((m) => m.order_id != null),
);
check(
  "all members have charged_at",
  memberList.every((m) => m.charged_at != null),
);

// Verify the fairness rule end-to-end on each order.
// alpha: snap=600, final=480 → charge MIN(600,480)=480 → 50×480=24,000
// beta:  snap=600, final=480 → charge MIN(600,480)=480 → 100×480=48,000
// gamma: snap=540, final=480 → charge MIN(540,480)=480 → 50×480=24,000
const expectedCharges = {
  [users[0].id]: { qty: 50, expectedTotal: 24000 },  // alpha
  [users[1].id]: { qty: 100, expectedTotal: 48000 }, // beta
  [users[2].id]: { qty: 50, expectedTotal: 24000 },  // gamma
};

for (const m of memberList) {
  const exp = expectedCharges[m.user_id];
  if (!exp) {
    check(`unknown user_id ${m.user_id} in members`, false);
    continue;
  }
  check(
    `user ${m.user_id.slice(0, 8)} paid MIN(snap, final) — qty=${m.qty} matches expected ${exp.qty}`,
    m.qty === exp.qty,
  );
  check(
    `user ${m.user_id.slice(0, 8)} snap=${m.unit_bdt_at_commit} (snapshot at commit time)`,
    typeof m.unit_bdt_at_commit === "number" && m.unit_bdt_at_commit > 0,
  );

  const { data: order } = await admin
    .from("orders")
    .select("id, total_bdt, product_subtotal_bdt, deposit_bdt, balance_bdt, status, user_id, buyer_note")
    .eq("id", m.order_id)
    .maybeSingle();
  check(
    `user ${m.user_id.slice(0, 8)} order.user_id matches`,
    order?.user_id === m.user_id,
  );
  check(
    `user ${m.user_id.slice(0, 8)} order.product_subtotal_bdt = ${exp.expectedTotal} (480 × qty)`,
    order?.product_subtotal_bdt === exp.expectedTotal,
    `got ${order?.product_subtotal_bdt}`,
  );
  check(
    `user ${m.user_id.slice(0, 8)} order.deposit_bdt = order.total_bdt (full prepayment)`,
    order?.deposit_bdt === order?.total_bdt,
  );
  check(
    `user ${m.user_id.slice(0, 8)} order.balance_bdt = 0`,
    order?.balance_bdt === 0,
  );
  check(
    `user ${m.user_id.slice(0, 8)} order.status = pending_payment`,
    order?.status === "pending_payment",
    `got ${order?.status}`,
  );
  check(
    `user ${m.user_id.slice(0, 8)} order.buyer_note marks as group buy`,
    typeof order?.buyer_note === "string" && order.buyer_note.includes(groupA.id),
    `got ${order?.buyer_note}`,
  );
}

await cleanupGroup(groupA.id);
console.log("  ✓ cleaned up group A");

// ─── [3] Not-yet-at-target ─────────────────────────────────────────
console.log("\n[3] Not yet at target — no change");
const productB = await pickProduct([productA.id]);
const groupB = await adminCreateGroup(productB, { targetQty: 200, minQtyPerBuyer: 50 });
const usersB = [];
for (const s of ["delta"]) {
  const u = await createTestUser(s);
  await ensureAddress(u.id);
  usersB.push(u);
}
const cookieD = await buyerSignIn(usersB[0].email, usersB[0].password);
await buyerJoin(groupB.id, 50, cookieD); // total = 50, target = 200
const cronB = await runCron();
check("cron ok (no-op scan)", cronB.ok === true);
check("0 formed", (cronB.formed ?? []).length === 0);
const gbB = await admin
  .from("group_buys")
  .select("status, final_unit_bdt, formed_at")
  .eq("id", groupB.id)
  .maybeSingle();
check("status still 'open'", gbB.data?.status === "open");
check("final_unit_bdt still null", gbB.data?.final_unit_bdt === null);
check("formed_at still null", gbB.data?.formed_at === null);
await cleanupGroup(groupB.id);
console.log("  ✓ cleaned up group B");

// ─── [4] Idempotent — second cron run is a no-op ───────────────────
console.log("\n[4] Idempotent — second cron run is a no-op for formed groups");
const productC = await pickProduct([productA.id, productB.id]);
const groupC = await adminCreateGroup(productC, {
  targetQty: 100,
  minQtyPerBuyer: 50,
  priceTiers: [
    { qty_threshold: 50, unit_bdt: 600 },
    { qty_threshold: 100, unit_bdt: 540 },
  ],
});
// Two ephemeral users, each commits 50
const usersC = [];
for (const s of ["zeta1", "zeta2"]) {
  const u = await createTestUser(s);
  await ensureAddress(u.id);
  usersC.push(u);
}
const cookieZ1 = await buyerSignIn(usersC[0].email, usersC[0].password);
const cookieZ2 = await buyerSignIn(usersC[1].email, usersC[1].password);
await buyerJoin(groupC.id, 50, cookieZ1);
await buyerJoin(groupC.id, 50, cookieZ2); // total = 100 = target

const cronC1 = await runCron();
check("first cron formed 1 group", cronC1.formed?.length === 1);

// Count orders for this group
const { data: ordersC } = await admin
  .from("orders")
  .select("id")
  .like("buyer_note", `Group buy ${groupC.id}`);
const orderCountBefore = ordersC?.length ?? 0;

const cronC2 = await runCron();
check("second cron formed 0 groups", (cronC2.formed ?? []).length === 0);

const { data: ordersC2 } = await admin
  .from("orders")
  .select("id")
  .like("buyer_note", `Group buy ${groupC.id}`);
const orderCountAfter = ordersC2?.length ?? 0;
check(
  "no duplicate orders on second cron",
  orderCountAfter === orderCountBefore,
  `before=${orderCountBefore} after=${orderCountAfter}`,
);
await cleanupGroup(groupC.id);
console.log("  ✓ cleaned up group C");

// ─── Cleanup auth users ────────────────────────────────────────────
await cleanupAuthUsers();
console.log("\n[cleanup] deleted ephemeral auth users");

// ─── Summary ───────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);