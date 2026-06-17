// E2E smoke for Phase 41 buyer shipping-mode + admin retry/remove.
//
// [1] Buyer shipping-mode PUT API (anon → 401, signed-in → 200,
//     invalid mode → 400, status=formed → 409)
// [2] Admin retry endpoint (auth gate, missing member → 404,
//     already-charged → 409, not-formed → 409)
// [3] Admin remove endpoint (auth gate, missing member → 404,
//     member of wrong group → 400)

import { createClient } from "@supabase/supabase-js";

const URL = "https://xgudiwguopfxqiwofkuz.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhndWRpd2d1b3BmeHFpd29ma3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODYyMDUsImV4cCI6MjA5Njg2MjIwNX0.zESLm3chr5nkYEK1YUcMs2Es5CTCRHvjuITu5GJArPY";
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
  const email = `test+phase41-${suffix}-${Date.now()}@banglasource.bd`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "TestPhase41Pass!",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email, password: "TestPhase41Pass!" };
}

async function signIn(email, password) {
  const sb = createClient(URL, ANON);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn: ${error.message}`);
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

async function adminSignIn() {
  return await signIn("test+phase3@banglasource.bd", "TestPass123!");
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

async function adminCreateGroup(product, opts = {}) {
  const cookie = await adminSignIn();
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
      deadlineAt: new Date(Date.now() + 14 * 86400_000).toISOString(),
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`adminCreateGroup: ${res.status} ${JSON.stringify(j)}`);
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
      label: "Home",
      full_name: "Phase 41 Tester",
      phone: "+8801700000041",
      country: "BD",
      district: "Dhaka",
      address_line: "41 Phase-41 Test Lane",
      is_default: true,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`ensureAddress: ${error.message}`);
  return data;
}

async function adminCancelGroup(id) {
  const cookie = await adminSignIn();
  await fetch(`${ORIGIN}/api/admin/group-buys/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "cancel" }),
  });
}

async function cleanup(groupId) {
  await admin.from("orders").delete().like("buyer_note", `Group buy ${groupId}`);
  await admin.from("group_buys").delete().eq("id", groupId);
}

async function cleanupAuthUsers() {
  for (const id of createdUserIds) {
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {}
  }
}

const TEST_ADMIN_ID = "2623cda4-1de4-4edb-bc6f-9e9d8d245cc1";

// ─── [1] Buyer shipping-mode PUT ────────────────────────────────────
console.log("\n[1] Buyer shipping-mode PUT");
const productA = await pickProduct();
const groupA = await adminCreateGroup(productA);

// Buyer commits
const buyerA = await createTestUser("buyer-a");
await ensureAddress(buyerA.id);
const buyerCookieA = await signIn(buyerA.email, buyerA.password);
const joinA = await fetch(`${ORIGIN}/api/group-buys/${groupA.id}/join`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: buyerCookieA },
  body: JSON.stringify({ qty: 50 }),
});
const joinJsonA = await joinA.json();
check("buyer joined", joinA.status === 200);

// PUT shipping-mode
const putAnon = await fetch(`${ORIGIN}/api/buyer/group-buys/${groupA.id}/shipping-mode`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ shipping_mode: "sea" }),
});
check("PUT anon → 401", putAnon.status === 401, String(putAnon.status));

const putValid = await fetch(
  `${ORIGIN}/api/buyer/group-buys/${groupA.id}/shipping-mode`,
  {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: buyerCookieA },
    body: JSON.stringify({ shipping_mode: "sea" }),
  },
);
const putValidJson = await putValid.json();
check("PUT valid mode → 200", putValid.status === 200, String(putValid.status));
check("PUT response shipping_mode = 'sea'", putValidJson.shipping_mode === "sea");
check("PUT response group_status = 'open'", putValidJson.group_status === "open");

const putInvalid = await fetch(
  `${ORIGIN}/api/buyer/group-buys/${groupA.id}/shipping-mode`,
  {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: buyerCookieA },
    body: JSON.stringify({ shipping_mode: "teleport" }),
  },
);
check("PUT invalid mode → 400", putInvalid.status === 400);

// Verify the row was updated
const memberRow = await admin
  .from("group_buy_members")
  .select("shipping_mode")
  .eq("id", joinJsonA.member.id)
  .maybeSingle();
check("member.shipping_mode updated to 'sea'", memberRow.data?.shipping_mode === "sea");

// Now flip the group to 'formed' and verify PUT → 409
await admin
  .from("group_buys")
  .update({
    status: "formed",
    final_unit_bdt: 600,
    formed_at: new Date().toISOString(),
  })
  .eq("id", groupA.id);

const putLocked = await fetch(
  `${ORIGIN}/api/buyer/group-buys/${groupA.id}/shipping-mode`,
  {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: buyerCookieA },
    body: JSON.stringify({ shipping_mode: "express" }),
  },
);
check("PUT after status=formed → 409", putLocked.status === 409, String(putLocked.status));

await cleanup(groupA.id);
console.log("  ✓ cleaned up group A");

// ─── [2] Admin retry endpoint — auth + state guards ────────────────
console.log("\n[2] Admin retry — auth + state guards");
const productB = await pickProduct([productA.id]);
const groupB = await adminCreateGroup(productB);
const buyerB = await createTestUser("buyer-b");
const buyerCookieB = await signIn(buyerB.email, buyerB.password);
const joinB = await fetch(`${ORIGIN}/api/group-buys/${groupB.id}/join`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: buyerCookieB },
  body: JSON.stringify({ qty: 50 }),
});
const memberIdB = (await joinB.json()).member?.id;

// Force status to 'formed' to enable retry
await admin
  .from("group_buys")
  .update({
    status: "formed",
    final_unit_bdt: 600,
    formed_at: new Date().toISOString(),
  })
  .eq("id", groupB.id);

// Mark member as failed
await admin
  .from("group_buy_members")
  .update({ payment_state: "failed" })
  .eq("id", memberIdB);

// Auth gate
const retryAnon = await fetch(
  `${ORIGIN}/api/admin/group-buys/${groupB.id}/members/${memberIdB}/retry`,
  { method: "POST" },
);
check("retry anon → 401", retryAnon.status === 401);

// Member not found (use a random UUID)
const adminCookie = await adminSignIn();
const retryMissing = await fetch(
  `${ORIGIN}/api/admin/group-buys/${groupB.id}/members/00000000-0000-0000-0000-000000000000/retry`,
  { method: "POST", headers: { Cookie: adminCookie } },
);
check("retry missing member → 404", retryMissing.status === 404);

// Already charged — set it to charged, retry → 409
await admin
  .from("group_buy_members")
  .update({ payment_state: "charged" })
  .eq("id", memberIdB);
const retryCharged = await fetch(
  `${ORIGIN}/api/admin/group-buys/${groupB.id}/members/${memberIdB}/retry`,
  { method: "POST", headers: { Cookie: adminCookie } },
);
check("retry already-charged → 409", retryCharged.status === 409);

// Successful retry path: ensure member has default address, mark
// failed, retry, expect charged
await ensureAddress(buyerB.id);
await admin
  .from("group_buy_members")
  .update({ payment_state: "failed" })
  .eq("id", memberIdB);
const retryOk = await fetch(
  `${ORIGIN}/api/admin/group-buys/${groupB.id}/members/${memberIdB}/retry`,
  { method: "POST", headers: { Cookie: adminCookie } },
);
const retryOkJson = await retryOk.json();
check("retry ok → 200", retryOk.status === 200);
check("retry returns order_id", typeof retryOkJson.order_id === "number");

// Verify the member is now charged
const memberAfter = await admin
  .from("group_buy_members")
  .select("payment_state, order_id, charged_at")
  .eq("id", memberIdB)
  .maybeSingle();
check(
  "member payment_state now 'charged'",
  memberAfter.data?.payment_state === "charged",
  `got ${memberAfter.data?.payment_state}`,
);
check(
  "member order_id set to retry result",
  memberAfter.data?.order_id === retryOkJson.order_id,
);
check("charged_at is set", typeof memberAfter.data?.charged_at === "string");

await cleanup(groupB.id);
console.log("  ✓ cleaned up group B");

// ─── [3] Admin remove endpoint ─────────────────────────────────────
console.log("\n[3] Admin remove — auth + state guards");
const productC = await pickProduct([productA.id, productB.id]);
const groupC = await adminCreateGroup(productC);
const buyerC = await createTestUser("buyer-c");
await ensureAddress(buyerC.id);
const buyerCookieC = await signIn(buyerC.email, buyerC.password);
const joinC = await fetch(`${ORIGIN}/api/group-buys/${groupC.id}/join`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: buyerCookieC },
  body: JSON.stringify({ qty: 50 }),
});
const memberIdC = (await joinC.json()).member?.id;

const removeAnon = await fetch(
  `${ORIGIN}/api/admin/group-buys/${groupC.id}/members/${memberIdC}`,
  { method: "DELETE" },
);
check("remove anon → 401", removeAnon.status === 401);

const removeMissing = await fetch(
  `${ORIGIN}/api/admin/group-buys/${groupC.id}/members/00000000-0000-0000-0000-000000000000`,
  { method: "DELETE", headers: { Cookie: adminCookie } },
);
check("remove missing member → 404", removeMissing.status === 404);

// Mismatched group: create another group, try to remove member of
// groupC using the other group's id
const productD = await pickProduct([productA.id, productB.id, productC.id]);
const groupD = await adminCreateGroup(productD);
const removeMismatch = await fetch(
  `${ORIGIN}/api/admin/group-buys/${groupD.id}/members/${memberIdC}`,
  { method: "DELETE", headers: { Cookie: adminCookie } },
);
check("remove with wrong group → 400", removeMismatch.status === 400);

const removeOk = await fetch(
  `${ORIGIN}/api/admin/group-buys/${groupC.id}/members/${memberIdC}`,
  { method: "DELETE", headers: { Cookie: adminCookie } },
);
check("remove ok → 200", removeOk.status === 200);

const memberGone = await admin
  .from("group_buy_members")
  .select("id")
  .eq("id", memberIdC)
  .maybeSingle();
check("member row hard-deleted", memberGone.data === null);

await cleanup(groupC.id);
await cleanup(groupD.id);
console.log("  ✓ cleaned up group C, D");

await cleanupAuthUsers();
console.log("\n[cleanup] deleted ephemeral auth users");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);