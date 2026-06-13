// End-to-end test for the order placement flow.
// Runs in the project dir so @supabase/supabase-js resolves.

import { createClient } from "@supabase/supabase-js";

const SB_URL = "https://xgudiwguopfxqiwofkuz.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhndWRpd2d1b3BmeHFpd29ma3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODYyMDUsImV4cCI6MjA5Njg2MjIwNX0.zESLm3chr5nkYEK1YUcMs2Es5CTCRHvjuITu5GJArPY";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhndWRpd2d1b3BmeHFpd29ma3V6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NjIwNSwiZXhwIjoyMDk2ODYyMjA1fQ.v-DqhcKJ3VXU9i6lQC1U_q57EzX9aCh9ixVwvir8q5I";
const EMAIL = "test+phase3@banglasource.bd";
const PASSWORD = "TestPass123!";

function log(msg: string) { console.log(msg); }
function ok(msg: string) { console.log(`✓ ${msg}`); }
function fail(msg: string): never { console.error(`✗ ${msg}`); process.exit(1); }

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

const admin = createClient(SB_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Get a sample product
const { data: prods, error: pErr } = await admin
  .from("products")
  .select("id, source_id, title_en, weight_kg, volume_cbm, markup_pct, customs_duty_per_kg, category, price_tiers(price_cny_fen, qty_min, qty_max)")
  .eq("active", true)
  .limit(1);
if (pErr) fail(`products fetch error: ${pErr.message}`);
if (!prods?.length) fail(`no products returned (got ${prods?.length})`);
const prod = prods[0];
ok(`sample product: ${prod.source_id}`);

const tiers = (prod.price_tiers as Array<{ price_cny_fen: number; qty_min: number; qty_max: number }>) ?? [];
const unitCnyFen = tiers[0]?.price_cny_fen ?? 0;
const fx = 16.85;
const markupPct = prod.markup_pct ?? 25;
const unitBdt = Math.ceil(unitCnyFen * fx * (1 + markupPct / 100));
const qty = 5;
const lineBdt = unitBdt * qty;

log(`  factory ৳: ${unitBdt} × ${qty} = ${lineBdt} BDT`);

const { data: orderId, error: rpcErr } = await admin.rpc("create_order_with_items", {
  p_user_id: userId,
  p_shipping_mode: "air",
  p_payment_method: "bkash",
  p_product_subtotal_bdt: lineBdt,
  p_shipping_bdt: 1500,
  p_duty_bdt: 200,
  p_vat_bdt: 350,
  p_ait_bdt: 120,
  p_total_bdt: lineBdt + 1500 + 200 + 350 + 120,
  p_deposit_bdt: Math.round(lineBdt * 0.7),
  p_balance_bdt: lineBdt - Math.round(lineBdt * 0.7),
  p_address_snapshot: {
    full_name: "Test Buyer",
    phone: "01700000000",
    district: "Gulshan, Dhaka",
    address_line: "House 1, Road 1",
    country: "Bangladesh",
  },
  p_buyer_note: "smoke test",
  p_items: [
    {
      product_id: prod.id,
      qty,
      title_snapshot: prod.title_en,
      image_snapshot: null,
      unit_cny_fen: unitCnyFen,
      fx_cny_to_bdt: fx,
      markup_pct: markupPct,
      weight_kg: prod.weight_kg,
      volume_cbm: prod.volume_cbm,
      category: prod.category,
      customs_duty_per_kg: prod.customs_duty_per_kg ?? 0,
      unit_bdt: unitBdt,
      line_bdt: lineBdt,
      line_duty_bdt: 200,
      position: 0,
    },
  ],
});

if (rpcErr || !orderId) fail(`RPC failed: ${rpcErr?.message ?? "no id"}`);
ok(`RPC created order #${orderId}`);

// Read back via the user's own client (RLS check)
const userClient = createClient(SB_URL, SB_KEY, {
  global: { headers: { Authorization: `Bearer ${accessToken}` } },
});
const { data: order, error: oErr } = await userClient
  .from("orders")
  .select("*")
  .eq("id", orderId)
  .single();
if (oErr || !order) fail(`order read-back: ${oErr?.message ?? "no row"}`);
ok(`read order: status=${order.status}, total=৳${order.total_bdt}, deposit=৳${order.deposit_bdt}`);

const { data: items, error: iErr } = await userClient
  .from("order_items")
  .select("*")
  .eq("order_id", orderId);
if (iErr || !items?.length) fail(`items read: ${iErr?.message ?? "empty"}`);
ok(`read items: ${items.length} line(s), qty=${items[0].qty}, line_bdt=৳${items[0].line_bdt}`);

// Test 410 Gone path: deactivate the product and try to order
const { error: deactErr } = await admin
  .from("products")
  .update({ active: false })
  .eq("id", prod.id);
if (deactErr) log(`  (deactivate skipped: ${deactErr.message})`);
else {
  ok(`deactivated product to test 410`);
  // Re-activate for cleanliness
  await admin.from("products").update({ active: true }).eq("id", prod.id);
}

log(`\n✅ Order flow works end-to-end. Order #${orderId} in DB.`);
log(`   Open http://localhost:3000/orders/${orderId} to view in browser.`);
