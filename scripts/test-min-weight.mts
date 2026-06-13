// Phase 11 e2e test: minimum-weight enforcement
//
// 1. Try to place a 4kg order → expect 400 below_minimum_weight
// 2. Try to place a 5kg order → expect 200 (order created)
//
// The test signs in as test+phase3, posts to /api/orders with a
// fake-but-valid cart shape. We don't depend on the cookie session
// — we just sign the body with the buyer's user_id via a custom
// header that the server trusts? No — the server uses cookies.
// Easier: use the service-role client to sign in to Supabase, then
// reuse the access token + manually set the session cookie via
// playwright. Even easier: invoke the route via a thin shim.
//
// Simplest: just call the order creation logic via the RPC
// directly, and verify the SERVER-side weight check rejects
// 4kg. We need to test the API though, not the RPC.
//
// Plan: sign in via Supabase, hit the POST /api/orders endpoint
// with a real fetch (it'll set cookies in the response). Use the
// session-bound client to do it.

import { createClient } from "@supabase/supabase-js";

const SB_URL = "https://xgudiwguopfxqiwofkuz.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhndWRpd2d1b3BmeHFpd29ma3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODYyMDUsImV4cCI6MjA5Njg2MjIwNX0.zESLm3chr5nkYEK1YUcMs2Es5CTCRHvjuITu5GJArPY";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhndWRpd2d1b3BmeHFpd29ma3V6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NjIwNSwiZXhwIjoyMDk2ODYyMjA1fQ.v-DqhcKJ3VXU9i6lQC1U_q57EzX9aCh9ixVwvir8q5I";
const BASE = "http://localhost:3000";
const EMAIL = "test+phase3@banglasource.bd";
const PASSWORD = "TestPass123!";

function ok(msg) { console.log(`✓ ${msg}`); }
function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }

// Sign in
const r1 = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: SB_KEY },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const j1 = await r1.json();
if (!j1.access_token) fail(`sign-in failed: ${JSON.stringify(j1).slice(0, 200)}`);
const accessToken = j1.access_token;
const userId = j1.user.id;
ok(`signed in as ${EMAIL}`);

// Get a sample product
const admin = createClient(SB_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: prods, error: pErr } = await admin
  .from("products")
  .select("id, source_id, title_en, weight_kg, volume_cbm, markup_pct, customs_duty_per_kg, category, price_tiers(price_cny_fen, qty_min, qty_max)")
  .eq("active", true)
  .limit(1);
if (pErr || !prods?.length) fail("no products");
const prod = prods[0];
ok(`sample product: ${prod.source_id} (${prod.title_en})`);

// Sign in to the website so we get a session cookie for /api/orders.
// The Supabase SSR pattern: POST to /api/auth/signin or use the
// Supabase auth-helper cookies. Easiest: use the same access token
// as a Bearer header. The /api/orders route uses getServerClient()
// which reads from the cookie. So we need to set the cookie.
//
// The Supabase auth-helper uses cookie names like `sb-{ref}-auth-token`.
// The exact name format depends on the @supabase/ssr version.
// Easier path: call the supabase-js createBrowserClient which would
// do this for us, but we're in node.
//
// Simpler: use the Supabase REST API to set the session, then
// sign in by sending the JWT as a header. We can pretend to be
// the browser by using @supabase/ssr's createServerClient.

// Cleanest: directly call the @supabase/ssr server client from
// the same code path the route uses. The route uses
// getServerClient() from @/lib/supabase/server. We can't import
// that without a Node module that has the server-only module
// set. So instead, let's just sign in via the @supabase/ssr
// flow that sets the proper cookies.
//
// The simplest path: use the playwright browser. Sign in
// interactively, then call the API. But this is a node test.
//
// OK new plan: just call the route using the access token as a
// Bearer header. Modify the route to accept Authorization
// header as a fallback. NO — that pollutes the API for testing.
//
// Final plan: use the @supabase/ssr flow that the login page
// uses. The login page does supabase.auth.signInWithPassword
// which writes the session cookies via the supabase-js client's
// built-in cookie storage adapter. We can mirror that with a
// @supabase/ssr server client.

// Instead of all that, the most robust path: use the supabase
// auth admin API to mint a session, then return the user_id
// and have a route that takes that as a header. NO.

// OK simplest: use createServerClient from @supabase/ssr with
// a memory cookie adapter.

import { createServerClient, type CookieOptions } from "@supabase/ssr";

const cookieJar = new Map();
function cookieAdapter() {
  return {
    getAll() {
      return Array.from(cookieJar.entries()).map(([name, value]) => ({
        name,
        value,
      }));
    },
    setAll(toSet) {
      for (const { name, value, options } of toSet) {
        cookieJar.set(name, value);
      }
    },
  };
}

const sb = createServerClient(SB_URL, SB_KEY, {
  cookies: cookieAdapter(),
});

const { data: signinData, error: signinErr } = await sb.auth.signInWithPassword(
  { email: EMAIL, password: PASSWORD },
);
if (signinErr || !signinData.user) {
  fail(`signin err: ${signinErr?.message}`);
}
ok(`supabase-ssr signed in, ${signinData.user.id}`);

// Get the session cookies
const sessionCookies = Array.from(cookieJar.entries());
if (sessionCookies.length === 0) fail("no session cookies set");

// Build a Cookie header
const cookieHeader = sessionCookies
  .map(([name, value]) => `${name}=${value}`)
  .join("; ");
ok(`got ${sessionCookies.length} session cookies`);

// Test 1: sub-min order. Product is 0.08kg each, so 50 pcs =
// 4kg exactly → expect 400.
const subMinQty = Math.floor(4.99 / prod.weight_kg); // just under 5kg
const subMinPayload = {
  shipping_mode: "air",
  payment_method: "bkash",
  address: {
    full_name: "Test",
    phone: "01700000000",
    district: "Gulshan",
    address_line: "House 1",
    country: "Bangladesh",
  },
  items: [
    {
      source_id: prod.source_id,
      qty: subMinQty, // 0.08 × qty = ~4.96kg
      markup_pct: 10,
      weight_kg: prod.weight_kg,
      volume_cbm: prod.volume_cbm,
      category: prod.category,
      customs_duty_per_kg: prod.customs_duty_per_kg ?? 0,
    },
  ],
};

const r2 = await fetch(`${BASE}/api/orders`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookieHeader },
  body: JSON.stringify(subMinPayload),
});
const j2 = await r2.json();
if (r2.status !== 400) {
  fail(`expected 400 for 4kg order, got ${r2.status}: ${JSON.stringify(j2)}`);
}
if (j2.error !== "below_minimum_weight") {
  fail(`expected error=below_minimum_weight, got ${j2.error}`);
}
ok(`4kg order → 400 below_minimum_weight (weight_kg=${j2.weight_kg}, shortfall=${j2.shortfall_kg}kg)`);

// Test 2: 5kg order → expect 200. Use 70 pcs (5.6kg).
const okQty = Math.ceil(5.5 / prod.weight_kg);
const okPayload = {
  ...subMinPayload,
  items: [
    {
      ...subMinPayload.items[0],
      qty: okQty,
    },
  ],
};

const r3 = await fetch(`${BASE}/api/orders`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookieHeader },
  body: JSON.stringify(okPayload),
});
const j3 = await r3.json();
if (r3.status !== 200 || !j3.ok) {
  fail(`expected 200 for 5kg order, got ${r3.status}: ${JSON.stringify(j3)}`);
}
ok(`5kg order → 200, order #${j3.order.id} (${j3.order.item_count} item, total ৳${j3.order.total_bdt.toLocaleString()})`);

// Clean up
if (j3.order?.id) {
  await admin.from("order_items").delete().eq("order_id", j3.order.id);
  await admin.from("orders").delete().eq("id", j3.order.id);
  ok("cleaned up test order");
}

ok("ALL PHASE 11 ASSERTIONS PASSED");
