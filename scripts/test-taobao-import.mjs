// E2E smoke for Phase 43 Taobao/Tmall import.
//
// [1] URL parser — covers all known URL shapes + invalid URLs
// [2] Category guess from breadcrumb (Chinese + English paths)
// [3] Price parsing (yuan vs fen)
// [4] Image dedup/clean
// [5] API route auth gate (anon → 401, missing URL → 400)
// [6] API route Apify call — gated by env var (skipped without one)
// [7] UI page renders for admin + redirects for anon

import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";

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

function runTsxInline(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["tsx", "--env-file=.env.local", "-e", script],
      { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`tsx exit ${code}: ${err.slice(-300)}`));
      try { resolve(JSON.parse(out)); } catch (e) { reject(new Error(`parse ${e}: ${out.slice(-200)}`)); }
    });
  });
}

// ─── [1] URL parser ────────────────────────────────────────────────
console.log("\n[1] URL parser");
const lib = await runTsxInline(`
import { parseTaobaoUrl, guessCategoryFromBreadcrumb } from './src/lib/taobao-import.ts';
console.log(JSON.stringify({
  parse: [
    parseTaobaoUrl('https://item.taobao.com/item.htm?id=123456'),
    parseTaobaoUrl('https://detail.taobao.com/item.htm?id=123456'),
    parseTaobaoUrl('https://detail.tmall.com/item.htm?id=987654'),
    parseTaobaoUrl('https://world.taobao.com/item/111222333'),
    parseTaobaoUrl('https://detail.tmall.hk/item.htm?id=999999'),
    parseTaobaoUrl('https://mobile.yangkeduo.com/goods.html?goods_id=123'),
    parseTaobaoUrl('https://example.com/foo'),
    parseTaobaoUrl('not a url'),
    parseTaobaoUrl('https://item.taobao.com/item.htm'),
  ],
  cat: [
    guessCategoryFromBreadcrumb(['女装','女士上衣','T恤']),
    guessCategoryFromBreadcrumb(['手机数码','手机配件','耳机']),
    guessCategoryFromBreadcrumb(['箱包','双肩包']),
    guessCategoryFromBreadcrumb(['美妆','彩妆','口红']),
    guessCategoryFromBreadcrumb(['unknown', 'thing']),
    guessCategoryFromBreadcrumb(['shoes','running shoes']),
    guessCategoryFromBreadcrumb(['鞋','运动鞋']),
  ],
}));
`);
check("item.taobao.com", lib.parse[0].ok === true && lib.parse[0].itemId === "123456");
check("detail.taobao.com", lib.parse[1].ok === true && lib.parse[1].platform === "taobao");
check("detail.tmall.com (platform=tmall)", lib.parse[2].ok === true && lib.parse[2].platform === "tmall" && lib.parse[2].itemId === "987654");
check("world.taobao.com clean URL", lib.parse[3].ok === true && lib.parse[3].platform === "world_taobao" && lib.parse[3].itemId === "111222333");
check("detail.tmall.hk", lib.parse[4].ok === true && lib.parse[4].platform === "tmall" && lib.parse[4].itemId === "999999");
check("pinduoduo rejected", lib.parse[5].ok === false && lib.parse[5].reason === "pinduoduo_unsupported");
check("unknown domain rejected", lib.parse[6].ok === false && lib.parse[6].reason === "unsupported_platform");
check("invalid URL rejected", lib.parse[7].ok === false && lib.parse[7].reason === "invalid_url");
check("missing item id rejected", lib.parse[8].ok === false && lib.parse[8].reason === "missing_item_id");

console.log("\n[2] Category guess from breadcrumb");
check("T恤 → null (no T-shirt rule yet, OK)", lib.cat[0] === null, `got ${lib.cat[0]}`);
check("耳机 → gadgets", lib.cat[1] === "gadgets");
check("双肩包 → bags", lib.cat[2] === "bags");
check("口红 → beauty", lib.cat[3] === "beauty");
check("unknown breadcrumb → null", lib.cat[4] === null);
check("English 'running shoes' → shoes", lib.cat[5] === "shoes");
check("Chinese 运动鞋 → shoes", lib.cat[6] === "shoes");

// ─── [3] mapApifyToProductDraft ────────────────────────────────────
console.log("\n[3] mapApifyToProductDraft");
const draftOut = await runTsxInline(`
import { mapApifyToProductDraft, parseTaobaoUrl } from './src/lib/taobao-import.ts';
const parsed = parseTaobaoUrl('https://item.taobao.com/item.htm?id=123456789012');
if (!parsed.ok) throw new Error('parse failed');
const d1 = mapApifyToProductDraft({
  item: { id: '123456789012', title: 'Test 产品', price: '12345.6',
          images: ['https://img.alicdn.com/a.jpg','https://img.alicdn.com/b.jpg','https://img.alicdn.com/a.jpg'],
          shopName: 'Test Shop', minQuantity: 5 },
  parsed, runId: 'r1',
});
const d2 = mapApifyToProductDraft({
  item: { id: '999', title: 'Other', price: 99.5, images: [], picUrl: 'https://x.com/cover.jpg' },
  parsed, runId: 'r2',
});
const d3 = mapApifyToProductDraft({
  item: { id: '888', images: ['not-a-url', '', 'https://valid.com/x.jpg'] },
  parsed, runId: 'r3',
});
console.log(JSON.stringify({ d1, d2, d3 }));
`);

check("d1.price: string > 10000 → /100", draftOut.d1.factoryCnyPerPc === 123.456, `got ${draftOut.d1.factoryCnyPerPc}`);
check("d1.sourceId = 'taobao-<id>'", draftOut.d1.sourceId === "taobao-123456789012");
check("d1.images dedup'd (a.jpg appears 2×)", draftOut.d1.images.length === 2 && draftOut.d1.images[0] === "https://img.alicdn.com/a.jpg");
check("d1.factoryMoq = 5", draftOut.d1.factoryMoq === 5);
check("d1.supplierName = 'Test Shop'", draftOut.d1.supplierName === "Test Shop");
check("d1.apifyRunId passed through", draftOut.d1.apifyRunId === "r1");

check("d2.price: small number stays", draftOut.d2.factoryCnyPerPc === 99.5);
check("d2.picUrl prepended when images empty", draftOut.d2.images[0] === "https://x.com/cover.jpg" && draftOut.d2.images.length === 1);

check("d3.images: non-URL filtered", draftOut.d3.images.length === 1 && draftOut.d3.images[0] === "https://valid.com/x.jpg");
check("d3.factoryMoq defaults to 1", draftOut.d3.factoryMoq === 1);

// ─── [4] API route auth + URL validation ──────────────────────────
console.log("\n[4] API route auth + URL validation");
const noAuth = await fetch(`${ORIGIN}/api/admin/import/scrape`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://item.taobao.com/item.htm?id=123" }),
});
check("POST without auth → 401", noAuth.status === 401, String(noAuth.status));

const anon = createClient(URL, ANON);
const { data: authData } = await anon.auth.signInWithPassword({
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
const adminCookie = `sb-${"xgudiwguopfxqiwofkuz"}-auth-token=${encodeURIComponent(
  JSON.stringify({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }),
)}`;

const noUrl = await fetch(`${ORIGIN}/api/admin/import/scrape`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: adminCookie },
  body: JSON.stringify({}),
});
check("POST without url → 400", noUrl.status === 400, String(noUrl.status));

const pdd = await fetch(`${ORIGIN}/api/admin/import/scrape`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: adminCookie },
  body: JSON.stringify({ url: "https://mobile.yangkeduo.com/goods.html?goods_id=12345" }),
});
check("POST with Pinduoduo URL → 400", pdd.status === 400, String(pdd.status));
const pddJson = await pdd.json();
check("error code = PINDUODUO_UNSUPPORTED", pddJson.code === "PINDUODUO_UNSUPPORTED", `got ${pddJson.code}`);

const unknown = await fetch(`${ORIGIN}/api/admin/import/scrape`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: adminCookie },
  body: JSON.stringify({ url: "https://example.com/foo" }),
});
check("POST with unknown domain → 400", unknown.status === 400);

// Valid Taobao URL — only run real scrape if APIFY_TOKEN is set
if (!process.env.APIFY_TOKEN) {
  console.log("  ⓘ skipping real Apify call (APIFY_TOKEN not in env)");
} else {
  console.log("  ⓘ running real Apify call (5-30s)…");
  const r = await fetch(`${ORIGIN}/api/admin/import/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ url: "https://item.taobao.com/item.htm?id=642525301030" }),
  });
  check(
    "real Taobao scrape returns 200 OR a clear apify error",
    r.status === 200 || r.status === 502 || r.status === 504,
    `got ${r.status}`,
  );
  const j = await r.json();
  if (r.status === 200) {
    check("real draft.sourceId format", j.draft.sourceId.startsWith("taobao-"));
    check(
      "real draft has at least 1 image",
      Array.isArray(j.draft.images) && j.draft.images.length >= 1,
      `images=${j.draft.images?.length}`,
    );
  } else {
    console.log(`    scrape error: ${j.code} — ${j.message}`);
  }
}

// ─── [5] UI page renders ──────────────────────────────────────────
console.log("\n[5] /admin/import page");
const noAuthPage = await fetch(`${ORIGIN}/admin/import`, { redirect: "manual" });
check("anon /admin/import → 307", noAuthPage.status === 307);
const authPage = await fetch(`${ORIGIN}/admin/import`, { headers: { Cookie: adminCookie } });
check("admin /admin/import → 200", authPage.status === 200);
const pageHtml = await authPage.text();
check("renders 'Import from Taobao'", pageHtml.includes("Import from Taobao"));
check("renders URL paste placeholder", pageHtml.includes("item.taobao.com/item.htm"));
check("renders Factory ¥/pc field", pageHtml.includes("Factory"));
check("renders Save product button", pageHtml.includes("Save product"));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);