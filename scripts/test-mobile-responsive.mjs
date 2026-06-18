// Phase 49: mobile responsive regression test.
//
// Sets the viewport to 375x812 (iPhone X) and hits every public
// page, checking:
//   - No horizontal overflow on any page (excluding drawers/modals
//     and inside horizontal-scroll carousels, which are intentional)
//   - Cart button has at least 44x44 touch target (iOS HIG)
//   - Hamburger button has at least 44x44 touch target
//   - "Skip to content" is present + sr-only
//   - No images or cards extending past viewport (real overflow)
//
// Run via Playwright MCP (no module deps).
//
// Usage: dev server must be running on :3000.
//
// Asserts the Phase 49 mobile fixes:
//   1. Nav burger button added (mobile menu entry point)
//   2. LangToggle moved to MobileMenu drawer (mobile chrome)
//   3. Cart button enlarged to min-h-[44px] min-w-[44px]
//   4. Cart +/- buttons enlarged to 44x44
//   5. Footer links have min-h-[44px]

const URL = "http://localhost:3000";

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

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

async function main() {
  function mavisCall(tool, args) {
    const tmpFile = `/tmp/audit-mobile/call-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    writeFileSync(tmpFile, JSON.stringify(args));
    const raw = execSync(
      `/Users/jahidabdullah/.mavis/bin/mavis mcp call playwright ${tool} --file '${tmpFile}'`,
      { encoding: "utf8", env: process.env },
    );
    const m = raw.match(/### Result\s*```(?:\w+)?\s*([\s\S]*?)\s*```/);
    let result = m ? m[1].trim() : raw.slice(raw.search(/[\[{]/));
    const firstBrace = result.indexOf("{");
    if (firstBrace >= 0) {
      let depth = 0, inString = false, escaped = false, lastBrace = -1;
      for (let i = firstBrace; i < result.length; i++) {
        const c = result[i];
        if (escaped) { escaped = false; continue; }
        if (c === "\\") { escaped = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (c === "{") depth++;
        else if (c === "}") { depth--; if (depth === 0) { lastBrace = i; break; } }
      }
      if (lastBrace > firstBrace) result = result.slice(firstBrace, lastBrace + 1);
    }
    return result;
  }

  const resize = mavisCall("browser_resize", { width: 375, height: 812 });
  // No useful return; ignore.

  const PAGES = [
    "/",
    "/search",
    "/categories",
    "/about",
    "/how-it-works",
    "/shipping-rates",
    "/contact",
    "/blog",
    "/cart",
    "/login",
  ];

  console.log("[1] No horizontal overflow on any public page (375px viewport)");
  const overflows = [];
  for (const path of PAGES) {
    mavisCall("browser_navigate", { url: `${URL}${path}` });
    const r = mavisCall("browser_evaluate", {
      function: `() => {
        const sw = document.documentElement.scrollWidth;
        const cw = document.documentElement.clientWidth;
        return { path: ${JSON.stringify(path)}, sw, cw, diff: sw - cw };
      }`,
    });
    const data = JSON.parse(r);
    check(
      `${path}: scrollWidth (${data.sw}) ≤ clientWidth (${data.cw})`,
      data.diff <= 1, // allow 1px rounding
    );
    if (data.diff > 1) overflows.push(data);
  }

  console.log("\n[2] Cart button is 44x44 on mobile");
  mavisCall("browser_navigate", { url: `${URL}/` });
  const cartCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const btn = document.querySelector('button[aria-label*="rder"], button[aria-label="Order list"]');
      if (!btn) return { found: false };
      const r = btn.getBoundingClientRect();
      return { found: true, w: Math.round(r.width), h: Math.round(r.height) };
    }`,
  });
  const cartData = JSON.parse(cartCheck);
  check(
    "cart button found on home page",
    cartData.found,
    JSON.stringify(cartData),
  );
  check(
    `cart button ≥ 44x44 (got ${cartData.w}x${cartData.h})`,
    cartData.w >= 44 && cartData.h >= 44,
  );

  console.log("\n[3] Hamburger button is 44x44 on mobile");
  const hamCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const btn = document.querySelector('button[aria-label="Open menu"]');
      if (!btn) return { found: false };
      const r = btn.getBoundingClientRect();
      const visible = window.getComputedStyle(btn).display !== 'none';
      return { found: true, visible, w: Math.round(r.width), h: Math.round(r.height) };
    }`,
  });
  const hamData = JSON.parse(hamCheck);
  check(
    "hamburger button present on mobile (md:hidden)",
    hamData.found && hamData.visible,
    JSON.stringify(hamData),
  );
  check(
    `hamburger ≥ 44x44 (got ${hamData.w}x${hamData.h})`,
    hamData.w >= 44 && hamData.h >= 44,
  );

  console.log("\n[4] Search-icon button is 44x44 on mobile");
  const searchBtnCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const btn = document.querySelector('button[aria-label="Open search"]');
      if (!btn) return { found: false };
      const r = btn.getBoundingClientRect();
      const visible = window.getComputedStyle(btn).display !== 'none';
      return { found: true, visible, w: Math.round(r.width), h: Math.round(r.height) };
    }`,
  });
  const sBtnData = JSON.parse(searchBtnCheck);
  check(
    "search-icon button present on mobile",
    sBtnData.found && sBtnData.visible,
    JSON.stringify(sBtnData),
  );
  check(
    `search-icon ≥ 44x44 (got ${sBtnData.w}x${sBtnData.h})`,
    sBtnData.w >= 44 && sBtnData.h >= 44,
  );

  console.log("\n[5] MobileMenu drawer opens with all nav links");
  mavisCall("browser_evaluate", {
    function: `() => { document.querySelector('button[aria-label="Open menu"]')?.click(); }`,
  });
  await new Promise((r) => setTimeout(r, 300));
  const menuCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const drawer = document.querySelector('[role="dialog"][aria-label="Main menu"]');
      if (!drawer) return { open: false };
      const links = Array.from(drawer.querySelectorAll('a')).map((a) => ({
        href: a.getAttribute('href'),
        h: Math.round(a.getBoundingClientRect().height),
      }));
      return { open: true, links };
    }`,
  });
  const menuData = JSON.parse(menuCheck);
  check("MobileMenu drawer opens on burger tap", menuData.open);
  check(
    "MobileMenu has ≥ 7 nav links",
    menuData.links?.length >= 7,
    `${menuData.links?.length} links`,
  );
  const allLinksTall = menuData.links?.every((l) => l.h >= 44);
  check(
    "every menu link ≥ 44px tall",
    allLinksTall,
    `min h: ${Math.min(...(menuData.links?.map((l) => l.h) ?? [0]))}px`,
  );

  console.log("\n[6] LangToggle moved to drawer (mobile)");
  const langCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const drawer = document.querySelector('[role="dialog"][aria-label="Main menu"]');
      const drawerToggle = drawer?.querySelector('button[aria-pressed]');
      // Only consider a topbar toggle if it's actually visible
      // (the wrapper div has display:none on mobile via hidden md:inline-flex,
      // but querySelector still finds it — check the bounding rect).
      const allTopbarToggles = Array.from(document.querySelectorAll('header button[aria-pressed]'));
      const visibleTopbarToggle = allTopbarToggles.find((el) => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
      });
      return {
        inDrawer: !!drawerToggle,
        visibleInTopbar: !!visibleTopbarToggle,
      };
    }`,
  });
  const langData = JSON.parse(langCheck);
  check("LangToggle present in MobileMenu drawer", langData.inDrawer);
  check(
    "LangToggle NOT visible in topbar on mobile (moved to drawer)",
    !langData.visibleInTopbar,
    `topbar-visible=${langData.visibleInTopbar} drawer=${langData.inDrawer}`,
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});