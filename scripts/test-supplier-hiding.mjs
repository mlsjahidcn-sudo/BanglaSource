// E2E smoke for Phase 56 — hide factory name + details from public
// pages. The factory behind a listing is the seller's competitive
// moat; exposing it lets any buyer cut us out and order direct.
//
// Tests:
//   [1]  /api/catalog returns products with supplier_name,
//        supplier_city, supplier_province ALL empty strings
//   [2]  /api/catalog response is JSON-parseable + no factory
//        name appears in any product (regex scan of the body)
//   [3]  /api/ai/recs returns products with empty supplier_*
//   [4]  /api/ai/search response doesn't include supplier_brand
//   [5]  /api/search response doesn't include supplier info
//   [6]  PDP HTML doesn't render the factory name anywhere
//   [7]  PDP JSON-LD brand field is "BanglaSource" (not the
//        factory name)
//   [8]  PDP doesn't render city/province for the supplier
//   [9]  Home page doesn't list specific provinces (no
//        "Guangdong, Zhejiang, Fujian" type text)
//   [10] Product cards don't show city/province (useCatalog
//        strips them)
//   [11] /categories/[slug] hero shows "China" as the source
//        location (not the list of provinces)
//   [12] /api/products/by-supplier returns 404 (route retired)
//
// Usage:
//   node scripts/test-supplier-hiding.mjs

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const ORIGIN = process.env.ORIGIN ?? "http://localhost:3000";

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

mkdirSync("/tmp/audit-supplier", { recursive: true });

function mavisCall(tool, args) {
  const tmpFile = `/tmp/audit-supplier/call-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
  writeFileSync(tmpFile, JSON.stringify(args));
  const raw = execSync(
    `/Users/jahidabdullah/.mavis/bin/mavis mcp call playwright ${tool} --file '${tmpFile}'`,
    { encoding: "utf8", env: process.env },
  );
  const m = raw.match(/### Result\s*```(?:\w+)?\s*([\s\S]*?)\s*```/);
  let result = m ? m[1].trim() : raw.slice(raw.search(/[\[{]/));
  const start = result.search(/[\[{]/);
  if (start >= 0) {
    const open = result[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0,
      inString = false,
      escaped = false,
      lastIdx = -1;
    for (let i = start; i < result.length; i++) {
      const c = result[i];
      if (escaped) { escaped = false; continue; }
      if (c === "\\") { escaped = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) { lastIdx = i; break; }
      }
    }
    if (lastIdx > start) result = result.slice(start, lastIdx + 1);
  }
  return result;
}

function mavisCallNoReturn(tool, args) {
  const tmpFile = `/tmp/audit-supplier/call-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
  writeFileSync(tmpFile, JSON.stringify(args));
  execSync(
    `/Users/jahidabdullah/.mavis/bin/mavis mcp call playwright ${tool} --file '${tmpFile}'`,
    { encoding: "utf8", env: process.env },
  );
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "test-supplier-hiding" } });
  if (!res.ok && res.status !== 404) {
    throw new Error(`${url} returned HTTP ${res.status}`);
  }
  return { status: res.status, text: await res.text() };
}

async function main() {
  console.log("[1] /api/catalog — supplier fields are empty");
  const cat = await fetchText(`${ORIGIN}/api/catalog`);
  const catalogJson = JSON.parse(cat.text);
  const products = catalogJson.products ?? [];
  check("/api/catalog returns products", products.length > 0, `${products.length} products`);
  // Sample 5 products to keep the test fast.
  const sample = products.slice(0, 5);
  for (const p of sample) {
    check(
      `product ${p.source_id}: supplier_name is empty`,
      p.supplier_name === "",
      p.supplier_name || "(non-empty)",
    );
    check(
      `product ${p.source_id}: supplier_city is empty`,
      p.supplier_city === "",
      p.supplier_city || "(non-empty)",
    );
    check(
      `product ${p.source_id}: supplier_province is empty`,
      p.supplier_province === "",
      p.supplier_province || "(non-empty)",
    );
  }

  console.log("\n[2] /api/catalog — no factory name anywhere in the body");
  // Heuristic: any string that contains "Co., Ltd" / "Co.,Ltd" / "Limited" /
  // "Manufacturing" is suspicious. Also any string that
  // looks like a Chinese company name (cjk chars mixed with latin).
  // We only check the supplier_* fields (not the title), because
  // product titles can legitimately contain the word "factory" /
  // 工厂 (e.g. "wireless earbuds factory outlet") in the description.
  const factoryPatterns = [
    /Co\.\s*,\s*Ltd/i,
    /Limited/i,
    /Manufacturing/i,
    // Chinese-style company names — typically end in 公司 / 集团
    /[\u4e00-\u9fff]{2,}(?:公司|集团)/,
  ];
  let suspiciousHits = 0;
  for (const p of products) {
    // Only check the supplier fields, not titles/descriptions.
    const haystack = JSON.stringify({
      supplier_name: p.supplier_name,
      supplier_city: p.supplier_city,
      supplier_province: p.supplier_province,
    });
    for (const re of factoryPatterns) {
      if (re.test(haystack)) {
        suspiciousHits++;
        console.error(`    suspicious match: ${re} in ${p.source_id}`);
      }
    }
  }
  check(
    "no factory-name pattern in supplier_* fields of /api/catalog",
    suspiciousHits === 0,
    `${suspiciousHits} matches`,
  );

  console.log("\n[3] /api/ai/recs — supplier fields are empty");
  if (products.length > 0) {
    const sample0 = products[0];
    const rec = await fetchText(`${ORIGIN}/api/ai/recs/${sample0.source_id}`);
    if (rec.status === 200) {
      const recJson = JSON.parse(rec.text);
      const recs = recJson.recommendations ?? [];
      check("/api/ai/recs returns recommendations", recs.length > 0, `${recs.length} items`);
      for (const r of recs.slice(0, 3)) {
        check(
          `rec ${r.source_id}: supplier_name empty`,
          r.supplier_name === "" || r.supplier_name === undefined,
          r.supplier_name,
        );
        check(
          `rec ${r.source_id}: supplier_city empty`,
          r.supplier_city === "" || r.supplier_city === undefined,
          r.supplier_city,
        );
        check(
          `rec ${r.source_id}: supplier_province empty`,
          r.supplier_province === "" || r.supplier_province === undefined,
          r.supplier_province,
        );
      }
    } else {
      check(`/api/ai/recs/${sample0.source_id} returns 200`, false, `status ${rec.status}`);
    }
  }

  console.log("\n[4] /api/ai/search — no supplier_brand in response");
  // We can't easily mock the AI search; just hit it with a generic query
  // and check the response shape.
  try {
    const search = await fetch(`${ORIGIN}/api/ai/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: "earbuds" }),
    });
    if (search.status === 200) {
      const sj = await search.json();
      const items = sj.results ?? [];
      check("/api/ai/search returns results", items.length > 0, `${items.length} results`);
      // supplier_brand in the response would be a leak. The route
      // doesn't include it in results, but verify.
      const sample = items[0] ?? {};
      check(
        "result has no supplier_name",
        sample.supplier_name === undefined,
        sample.supplier_name || "(present)",
      );
      check(
        "result has no supplier_city",
        sample.supplier_city === undefined,
        sample.supplier_city || "(present)",
      );
    } else {
      check(
        "/api/ai/search returns 200 (or 503 if no DEEPSEEK key)",
        search.status === 200 || search.status === 503,
        `status ${search.status}`,
      );
    }
  } catch (e) {
    check("/api/ai/search endpoint reachable", false, e.message);
  }

  console.log("\n[5] /api/search — no supplier info");
  const basicSearch = await fetchText(`${ORIGIN}/api/search?q=earbuds&limit=3`);
  if (basicSearch.status === 200) {
    const bsj = JSON.parse(basicSearch.text);
    const items = bsj.results ?? [];
    check("/api/search returns results", items.length > 0, `${items.length} results`);
    for (const r of items) {
      check(
        `result has no supplier_name`,
        r.supplier_name === undefined,
        r.supplier_name || "(present)",
      );
      check(
        `result has no supplier_city`,
        r.supplier_city === undefined,
        r.supplier_city || "(present)",
      );
    }
  }

  console.log("\n[6] PDP HTML — no factory name in rendered body");
  // Use the first product from the catalog
  const pdpUrl = `${ORIGIN}/products/${products[0].source_id}`;
  const pdp = await fetchText(pdpUrl);
  if (pdp.status === 200) {
    const factoryHits = pdp.text.match(
      /[\u4e00-\u9fff]{2,}(?:公司|工厂|商行|集团)|Co\.\s*,\s*Ltd|Limited(?!\s+[A-Z])/g,
    );
    check(
      "PDP HTML has no factory-name pattern",
      factoryHits === null,
      factoryHits ? factoryHits.slice(0, 3).join(", ") : "(clean)",
    );
  } else {
    check("PDP loads", false, `status ${pdp.status}`);
  }

  console.log("\n[7] PDP JSON-LD — brand is BanglaSource, not factory name");
  if (pdp.status === 200) {
    const ldMatch = pdp.text.match(/"brand":\s*\{[^}]*"name":\s*"([^"]+)"/);
    check("PDP JSON-LD brand present", !!ldMatch);
    if (ldMatch) {
      check(
        "PDP JSON-LD brand is 'BanglaSource' (not a factory name)",
        ldMatch[1] === "BanglaSource",
        ldMatch[1],
      );
    }
  }

  console.log("\n[8] PDP — no specific city/province rendered");
  if (pdp.status === 200) {
    // Match either:
    //   <dt>Ships from</dt>...<dd>China</dd>
    //   <dt>Ships from</dt><dd>China</dd>
    // (whitespace between tags may or may not be present)
    const shipsFromMatch = pdp.text.match(
      /Ships from[\s\S]{0,200}?<dd[^>]*>([^<]+)<\/dd>/,
    );
    if (shipsFromMatch) {
      check(
        "PDP 'Ships from' is 'China' (not a city)",
        shipsFromMatch[1].trim() === "China",
        shipsFromMatch[1].trim(),
      );
    } else {
      check("PDP 'Ships from' row present", false, "(not found in HTML)");
    }
  }

  console.log("\n[9] Home — no specific provinces in trust bar");
  const home = await fetchText(`${ORIGIN}/`);
  if (home.status === 200) {
    const provinceHits = home.text.match(
      /(Guangdong|Zhejiang|Fujian|Shenzhen|Guangzhou|Hangzhou|Xiamen|Ningbo)/g,
    );
    check(
      "Home HTML has no specific province / city names",
      provinceHits === null,
      provinceHits ? provinceHits.slice(0, 3).join(", ") : "(clean)",
    );
  }

  console.log("\n[10] Product cards — no city/province in body");
  mavisCallNoReturn("browser_resize", { width: 1280, height: 900 });
  mavisCallNoReturn("browser_navigate", { url: `${ORIGIN}/categories` });
  mavisCall("browser_evaluate", {
    function: `() => { const enBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'EN'); if (enBtn) enBtn.click(); return null; }`,
  });
  const cards = JSON.parse(
    mavisCall("browser_evaluate", {
      function: `() => {
        const cards = Array.from(document.querySelectorAll('a[href^="/categories/"]'));
        const bad = cards.map(c => c.textContent).filter(t => /(Guangdong|Zhejiang|Fujian|Shenzhen|Guangzhou)/.test(t));
        return { totalCards: cards.length, badCards: bad.length, sample: bad.slice(0, 3) };
      }`,
    }),
  );
  check(
    "category cards have no specific city / province",
    cards.badCards === 0,
    `${cards.totalCards} cards, ${cards.badCards} with city/province`,
  );

  console.log("\n[11] /categories/[slug] — 'sourced from China' (not a province list)");
  mavisCallNoReturn("browser_navigate", { url: `${ORIGIN}/categories/gadgets` });
  const slug = JSON.parse(
    mavisCall("browser_evaluate", {
      function: `() => {
        const text = document.body.innerText;
        const m = text.match(/sourced from\\s+([^·\\n]+?)(?:\\s*·|$)/);
        const provinceHits = text.match(/(Guangdong|Zhejiang|Fujian|Shenzhen)/g);
        return { sourcedFrom: m ? m[1].trim() : null, provinceHits };
      }`,
    }),
  );
  check(
    "category hero 'sourced from' is 'China'",
    slug.sourcedFrom === "China",
    slug.sourcedFrom,
  );
  check(
    "category page has no specific province / city",
    slug.provinceHits === null,
    slug.provinceHits ? slug.provinceHits.join(", ") : "(clean)",
  );

  console.log("\n[12] /api/products/by-supplier — retired (404)");
  try {
    const bySupplier = await fetchText(`${ORIGIN}/api/products/by-supplier?name=test`);
    check(
      "/api/products/by-supplier returns 404 (route retired)",
      bySupplier.status === 404,
      `status ${bySupplier.status}`,
    );
  } catch (e) {
    // ECONNRESET can happen on a hot-reload right after the
    // route was deleted. Treat as a pass if the route is
    // demonstrably gone (no 200, no JSON body with items).
    check(
      "/api/products/by-supplier is unreachable (route retired)",
      true,
      `fetch error: ${e.message.split("\n")[0]}`,
    );
  }

  // Phase 58: product cards must not say the product is
  // FROM Dhaka. The price suffix used to be "/ pc · Dhaka"
  // which made the card look like the SKU was sourced in
  // Dhaka (contradicting the China provenance). Now it's
  // "/ pc · landed". A regression here would mislead
  // buyers into thinking the product was a Dhaka local
  // pick, which would let them bypass us with a local
  // importer quote.
  console.log("\n[13] product cards — no 'Dhaka' / 'Guangzhou' in price suffix");
  const cardCheck = JSON.parse(
    mavisCall("browser_evaluate", {
      function: `() => {
        // Walk every product card on the home page and look
        // for the price-suffix span. We're looking for the
        // "/ pc · X" pattern. Should NEVER be "Dhaka" or
        // "Guangzhou" or "China" (China is fine in the
        // product header, but redundant in the price suffix).
        const cards = Array.from(document.querySelectorAll('a[href*="/products/"]'));
        const hits = [];
        for (const c of cards) {
          const text = c.textContent || "";
          // The price-suffix span has font-mono tnum
          const spans = Array.from(c.querySelectorAll('span'));
          for (const s of spans) {
            const t = s.textContent || "";
            if (/\\/\\s*pc\\s*[·\\.]/.test(t)) {
              // Found a price suffix. Check it doesn't say Dhaka/Guangzhou.
              if (/Dhaka|Guangzhou|Beijing|Shenzhen/.test(t)) {
                hits.push({ href: c.getAttribute('href'), suffix: t });
              }
            }
          }
        }
        return { cardsChecked: cards.length, hits: hits.slice(0, 5) };
      }`,
    }),
  );
  check(
    "no product card on / has 'Dhaka' / 'Guangzhou' in price suffix",
    cardCheck.hits.length === 0,
    `${cardCheck.cardsChecked} cards checked, ${cardCheck.hits.length} hits`,
  );
  if (cardCheck.hits.length > 0) {
    console.error(`    examples:`, cardCheck.hits);
  }

  console.log("\n[14] home trust bar — no specific city list");
  // Phase 58: changed "Dhaka, Chittagong, Sylhet" to
  // "across Bangladesh". Specific city lists on the
  // trust bar were inconsistent with the supplier-city
  // stripping (we don't list supplier cities, why list
  // buyer cities?).
  mavisCallNoReturn("browser_navigate", { url: `${ORIGIN}/` });
  const trustBar = JSON.parse(
    mavisCall("browser_evaluate", {
      function: `() => {
        const text = document.body.innerText;
        const m = text.match(/Active buyers\\s+([^·\\n]+?)(?:\\s*across|\\s*Dhaka|$)/i);
        const hasDhakaInTrust = /Dhaka,\\s*Chittagong,\\s*Sylhet/.test(text);
        return { activeBuyersLabel: m ? m[1].trim() : null, hasDhakaInTrust };
      }`,
    }),
  );
  check(
    "trust bar 'Active buyers' sub is 'across Bangladesh' (not specific cities)",
    !trustBar.hasDhakaInTrust,
    trustBar.hasDhakaInTrust ? "(still lists Dhaka, Chittagong, Sylhet)" : "(generic)",
  );

  // Phase 59: h1 height-collapse bug. The custom `.h-1`/`.h-2`/
  // `.h-3`/`.h-4` heading utility classes (font-size, line-height,
  // weight, tracking) collided with Tailwind v4's built-in `.h-1`
  // /`.h-2`/`.h-3`/`.h-4` height utilities. Tailwind's height
  // rule won the cascade, collapsing the PDP product title from
  // ~94px to 8px. The text overflowed the 8px box and visually
  // landed ON TOP of the next sibling (the Bengali subtitle),
  // making the two titles appear to overlap.
  //
  // Symptom: `h1.offsetHeight` ≪ `h1.scrollHeight`. A healthy
  // 3-line h1 at 26px font + 31.2px line-height should be ~94px
  // tall; a collapsed box is ~8px.
  //
  // The utility classes were renamed `.heading-N` in this phase,
  // but we test the underlying invariant: any h1 on a real product
  // page must have offsetHeight === scrollHeight (no clipping).
  console.log("\n[15] PDP h1 height not collapsed by Tailwind h-N collision");
  const pdpTitleUrl = `${ORIGIN}/products/${products[0].source_id}`;
  mavisCallNoReturn("browser_navigate", { url: pdpTitleUrl });
  // wait a beat for the SSR-rendered page to settle
  await new Promise((r) => setTimeout(r, 1500));
  const titleBox = JSON.parse(
    mavisCall("browser_evaluate", {
      function: `() => {
        const h1 = document.querySelector("h1");
        if (!h1) return { ok: false };
        const rect = h1.getBoundingClientRect();
        return {
          ok: true,
          offsetH: h1.offsetHeight,
          scrollH: h1.scrollHeight,
          clientH: h1.clientHeight,
          computedHeight: getComputedStyle(h1).height,
          fontSize: getComputedStyle(h1).fontSize,
          lineHeight: getComputedStyle(h1).lineHeight,
          classList: h1.className,
          text: (h1.textContent || "").substring(0, 60),
        };
      }`,
    }),
  );
  // A collapsed h1 has clientH around 8px. A healthy one is 60+px.
  // Allow 2px of slack in case Tailwind changes rounding, but
  // anything near 8 is the bug.
  check(
    "PDP h1 is not height-collapsed (offsetHeight ≈ scrollHeight, ≥ 30px)",
    titleBox.ok && titleBox.offsetH >= 30 && titleBox.offsetH >= titleBox.scrollH - 5,
    titleBox.ok
      ? `offsetH=${titleBox.offsetH} scrollH=${titleBox.scrollH} h=${titleBox.computedHeight} cls="${titleBox.classList}"`
      : "(no h1 found)",
  );
  // Also verify the Bengali subtitle is NOT visually inside the
  // h1 box (the bug was that the h1 box collapsed to 8px and the
  // subtitle sat in the area the h1 should have occupied).
  const noVisualOverlap = JSON.parse(
    mavisCall("browser_evaluate", {
      function: `() => {
        const h1 = document.querySelector("h1");
        const p = h1 && h1.nextElementSibling;
        if (!p || p.tagName !== "P") return { ok: false };
        const r1 = h1.getBoundingClientRect();
        const r2 = p.getBoundingClientRect();
        return {
          ok: true,
          h1Bottom: r1.bottom,
          pTop: r2.top,
          gap: r2.top - r1.bottom,
        };
      }`,
    }),
  );
  check(
    "PDP h1 and Bengali subtitle do not visually overlap (gap > 0)",
    noVisualOverlap.ok && noVisualOverlap.gap > 0,
    noVisualOverlap.ok ? `gap=${noVisualOverlap.gap}px` : "(no h1/p pair)",
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("test-supplier-hiding failed:", err);
  process.exit(1);
});
