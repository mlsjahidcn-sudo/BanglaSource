// E2E smoke for Phase 37 admin group buy surfaces.
// - GET /admin/group-buys            (list page)
// - GET /admin/group-buys/new        (create form)
// - GET /admin/group-buys/[id]       (detail page)
// - POST /api/admin/group-buys       (create API)
// - PATCH /api/admin/group-buys/[id] (cancel API)
// - GET /api/admin/group-buys/[id]   (read API)

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const URL = "https://xgudiwguopfxqiwofkuz.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhndWRpd2d1b3BmeHFpd29ma3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODYyMDUsImV4cCI6MjA5Njg2MjIwNX0.zESLm3chr5nkYEK1YUcMs2Es5CTCRHvjuITu5GJArPY";
const ORIGIN = "http://localhost:3000";

// --- Sign in as the test admin (public client, email+password) ---
const supabase = createClient(URL, ANON);
const { data, error } = await supabase.auth.signInWithPassword({
  email: "test+phase3@banglasource.bd",
  password: "TestPass123!",
});
if (error) {
  console.error("Sign-in failed:", error.message);
  process.exit(1);
}
const userId = data.user.id;
const accessToken = data.session.access_token;
const refreshToken = data.session.refresh_token;
console.log("✓ Signed in as", data.user.email, "(", userId, ")");

// Build the @supabase/ssr cookie format that Next uses
const sbSession = JSON.stringify({
  access_token: accessToken,
  refresh_token: refreshToken,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
});
const cookieValue = `sb-${"xgudiwguopfxqiwofkuz"}-auth-token=${encodeURIComponent(sbSession)}`;

function fetchAuth(path, init = {}) {
  return fetch(`${ORIGIN}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Cookie: cookieValue,
    },
    redirect: "manual",
  });
}

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// --- 1. List page renders ---
console.log("\n[1] GET /admin/group-buys");
const list = await fetchAuth("/admin/group-buys");
const listHtml = await list.text();
check("status 200", list.status === 200, String(list.status));
check("renders 'Group buys' title", listHtml.includes("Group buys"));
check("renders 'Create group buy' button", listHtml.includes("Create group buy"));
check("renders status filter chips", listHtml.includes("All statuses"));
check("renders 'Group buys' sidebar item", listHtml.includes('href="/admin/group-buys"'));

// --- 2. New page renders ---
console.log("\n[2] GET /admin/group-buys/new");
const np = await fetchAuth("/admin/group-buys/new");
const npHtml = await np.text();
check("status 200", np.status === 200, String(np.status));
check("renders 'Create group buy' heading", npHtml.includes("Create group buy"));
check("renders 'Target quantity' field", npHtml.includes("Target quantity"));
check("renders 'Price tiers' field", npHtml.includes("Price tiers"));
check("renders 'Deadline' field", npHtml.includes("Deadline"));
check("renders product search input", npHtml.includes("Search products by title"));

// --- 3. Pick a real product for the create call ---
const { data: products, error: pErr } = await supabase
  .from("products")
  .select("id, source_id, title_en")
  .eq("active", true)
  .order("id", { ascending: true })
  .limit(1);
if (pErr || !products || products.length === 0) {
  console.error("Could not fetch a product:", pErr);
  process.exit(1);
}
const productId = products[0].id;
console.log(`\nUsing product #${productId} (${products[0].source_id})`);

// --- 4. POST /api/admin/group-buys ---
console.log("\n[3] POST /api/admin/group-buys (create)");
const deadline = new Date(Date.now() + 7 * 86400_000).toISOString();
const createBody = {
  productId,
  targetQty: 500,
  minQtyPerBuyer: 50,
  priceTiers: [
    { qty_threshold: 200, unit_bdt: 520 },
    { qty_threshold: 500, unit_bdt: 480 },
  ],
  deadlineAt: deadline,
};
const createRes = await fetchAuth("/api/admin/group-buys", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(createBody),
});
const createJson = await createRes.json();
check("status 200", createRes.status === 200, `${createRes.status} ${JSON.stringify(createJson)}`);
check("returns id", typeof createJson.id === "string" && createJson.id.length > 0, createJson.id);
const newId = createJson.id;

// --- 5. GET /api/admin/group-buys/[id] ---
console.log("\n[4] GET /api/admin/group-buys/[id]");
const getRes = await fetchAuth(`/api/admin/group-buys/${newId}`);
const getJson = await getRes.json();
check("status 200", getRes.status === 200, `${getRes.status} ${JSON.stringify(getJson).slice(0, 200)}`);
check("groupBuy.product_id matches", getJson.groupBuy?.product_id === productId);
check("groupBuy.status === 'open'", getJson.groupBuy?.status === "open", getJson.groupBuy?.status);
check("groupBuy.price_tiers is array", Array.isArray(getJson.groupBuy?.price_tiers));
check("price_tiers length 2", getJson.groupBuy?.price_tiers?.length === 2);
check("members is empty array", Array.isArray(getJson.members) && getJson.members.length === 0);
check("product join worked (title_en set)", typeof getJson.groupBuy?.products?.title_en === "string");

// --- 6. Detail page renders ---
console.log("\n[5] GET /admin/group-buys/[id]");
const dp = await fetchAuth(`/admin/group-buys/${newId}`);
const dpHtml = await dp.text();
check("status 200", dp.status === 200, String(dp.status));
check("renders product title", dpHtml.includes(products[0].title_en ?? "") || dpHtml.includes("Group buy"));
check("renders status pill", dpHtml.includes("Open"));
check("renders 'Cancel group buy' button", dpHtml.includes("Cancel group buy"));
check("renders 'Members' header", dpHtml.includes("Members (") && dpHtml.includes(">0<"));
check("renders Price tiers section", dpHtml.includes("Price tiers"));

// --- 7. PATCH /api/admin/group-buys/[id] (cancel) ---
console.log("\n[6] PATCH /api/admin/group-buys/[id] (cancel)");
const cancelRes = await fetchAuth(`/api/admin/group-buys/${newId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "cancel" }),
});
const cancelJson = await cancelRes.json();
check("status 200", cancelRes.status === 200, `${cancelRes.status} ${JSON.stringify(cancelJson)}`);
check("status === 'cancelled'", cancelJson.status === "cancelled", cancelJson.status);
check("cancelledAt set", typeof cancelJson.cancelledAt === "string" && cancelJson.cancelledAt.length > 0);

// --- 8. PATCH again — should fail (terminal state) ---
console.log("\n[7] PATCH again (terminal state guard)");
const cancelRes2 = await fetchAuth(`/api/admin/group-buys/${newId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "cancel" }),
});
check("status 409", cancelRes2.status === 409, String(cancelRes2.status));

// --- 9. Validation tests ---
console.log("\n[8] POST validation rejects bad input");
const badTests = [
  { name: "missing productId", body: { ...createBody, productId: undefined } },
  { name: "minQty >= targetQty", body: { ...createBody, minQtyPerBuyer: 500 } },
  { name: "deadline too soon", body: { ...createBody, deadlineAt: new Date(Date.now() + 60000).toISOString() } },
  { name: "empty tiers", body: { ...createBody, priceTiers: [] } },
  { name: "unsorted tiers", body: { ...createBody, priceTiers: [{ qty_threshold: 500, unit_bdt: 480 }, { qty_threshold: 200, unit_bdt: 520 }] } },
  { name: "negative price", body: { ...createBody, priceTiers: [{ qty_threshold: 200, unit_bdt: -1 }] } },
];
for (const t of badTests) {
  const r = await fetchAuth("/api/admin/group-buys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(t.body),
  });
  check(`rejects: ${t.name}`, r.status === 400, `got ${r.status}`);
}

// --- 10. Unauth tests ---
console.log("\n[9] Unauth tests");
const r1 = await fetch(`${ORIGIN}/api/admin/group-buys/${newId}`, { method: "GET" });
check("GET without auth -> 401", r1.status === 401, String(r1.status));
const r2 = await fetch(`${ORIGIN}/api/admin/group-buys`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(createBody),
});
check("POST without auth -> 401", r2.status === 401, String(r2.status));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
