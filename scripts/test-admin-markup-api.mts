// Phase 12 — verify the admin PATCH API route honours markup_pct
// (range-validated 0-50) AND that the product page compiles in
// the browser.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SB_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Mint a session for the test admin (test+phase3@banglasource.bd / TestPass123!)
const { data: signIn, error: sErr } = await admin.auth.signInWithPassword({
  email: "test+phase3@banglasource.bd",
  password: "TestPass123!",
});
if (sErr || !signIn.session) throw new Error("sign-in failed: " + sErr?.message);
const accessToken = signIn.session.access_token;

// Pick a product
const { data: p0 } = await admin
  .from("products")
  .select("id, source_id, markup_pct")
  .eq("active", true)
  .limit(1)
  .single();
if (!p0) throw new Error("no product");
const orig = p0.markup_pct;

// 1) Valid 20 → 200
const r1 = await fetch(`http://localhost:3000/api/admin/products/${p0.id}`, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ markup_pct: 20 }),
});
const j1 = await r1.json();
console.log("PATCH 20 →", r1.status, JSON.stringify(j1).slice(0, 200));
if (r1.status !== 200 || j1.markup_pct !== 20) throw new Error("PATCH 20 failed");

// 2) Out-of-range 75 → 400
const r2 = await fetch(`http://localhost:3000/api/admin/products/${p0.id}`, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ markup_pct: 75 }),
});
const j2 = await r2.json();
console.log("PATCH 75 →", r2.status, JSON.stringify(j2));
if (r2.status !== 400) throw new Error("should reject 75");

// 3) Negative -5 → 400
const r3 = await fetch(`http://localhost:3000/api/admin/products/${p0.id}`, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ markup_pct: -5 }),
});
const j3 = await r3.json();
console.log("PATCH -5 →", r3.status, JSON.stringify(j3));
if (r3.status !== 400) throw new Error("should reject -5");

// 4) Restore
const r4 = await fetch(`http://localhost:3000/api/admin/products/${p0.id}`, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ markup_pct: orig }),
});
const j4 = await r4.json();
console.log("PATCH restore", orig, "→", r4.status, "markup_pct =", j4.markup_pct);

// 5) Verify the admin list page HTML contains the factory/markup columns
const r5 = await fetch(`http://localhost:3000/admin/products`, {
  headers: { Cookie: `sb-access-token=${accessToken}` },
});
console.log("GET /admin/products →", r5.status);
if (r5.status !== 200) throw new Error("admin list not 200");
const html = await r5.text();
if (!html.includes("Factory") || !html.includes("After markup")) {
  writeFileSync("/tmp/admin-list.html", html);
  throw new Error("Factory / After markup columns missing in /admin/products");
}
if (!html.includes("Markup")) {
  throw new Error("Markup column missing");
}
console.log("admin list page contains Factory / Markup / After markup columns ✓");

// 6) Verify product detail page
const r6 = await fetch(`http://localhost:3000/admin/products/${p0.source_id}`, {
  headers: { Cookie: `sb-access-token=${accessToken}` },
});
console.log("GET /admin/products/[id] →", r6.status);
const detailHtml = await r6.text();
if (r6.status !== 200) throw new Error("admin detail not 200");
if (!detailHtml.includes("Edit listing")) throw new Error("editor section missing");
console.log("admin detail page contains editor section ✓");

console.log("OK ✓");
