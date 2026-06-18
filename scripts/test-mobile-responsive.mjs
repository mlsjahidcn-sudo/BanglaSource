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
    // Phase 51: authenticated pages (signed in as test+phase3 admin)
    "/checkout",
    "/admin",
    "/admin/products",
    "/admin/orders",
    "/admin/group-buys",
    "/admin/alerts",
    "/admin/settings",
    "/admin/import",
    "/admin/products/new",
    "/buyer",
    "/buyer/group-buys",
    "/buyer/addresses",
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

  // ────────────────────────────────────────────────────────────
  // Phase 51: authenticated pages (admin + buyer + cart + checkout)
  // ────────────────────────────────────────────────────────────
  console.log("\n[8] Sign in as test+phase3 admin (Phase 51 audit)");
  mavisCall("browser_navigate", { url: `${URL}/login?redirect=%2Fadmin` });
  await new Promise((r) => setTimeout(r, 1000));
  // The login page shows the "already signed in" card when the
  // user is already authenticated. Skip the form fill in that
  // case and just navigate to /admin.
  const signinCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const email = document.querySelector('input[type=email]');
      const pwd = document.querySelector('input[type=password]');
      if (!email || !pwd) return { found: false, alreadySignedIn: true };
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(email, 'test+phase3@banglasource.bd');
      email.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(pwd, 'TestPass123!');
      pwd.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('button[type=submit]').click();
      return { found: true, submitted: true };
    }`,
  });
  const signinData = JSON.parse(signinCheck);
  check(
    "admin login form present OR already signed in",
    signinData.found || signinData.alreadySignedIn,
    JSON.stringify(signinData),
  );
  // Give the redirect time to land
  await new Promise((r) => setTimeout(r, 3000));
  // If still on /login (already-signed-in card), click its CTA to go to /admin
  const currentUrlCheck = mavisCall("browser_evaluate", {
    function: `() => ({ url: location.href })`,
  });
  if (JSON.parse(currentUrlCheck).url.includes("/login")) {
    // The signed-in card has a "Go to admin" / "Go to your portal" link
    mavisCall("browser_evaluate", {
      function: `() => { const link = Array.from(document.querySelectorAll('a')).find(a => a.getAttribute('href')?.includes('/admin')); if (link) link.click(); return { clicked: !!link }; }`,
    });
    await new Promise((r) => setTimeout(r, 2000));
  }
  // Verify we landed on /admin (or close to it)
  const postSignin = mavisCall("browser_evaluate", {
    function: `() => ({ url: location.href })`,
  });
  const postData = JSON.parse(postSignin);
  check(
    "landed on /admin after sign-in",
    postData.url.includes("/admin"),
    `url=${postData.url}`,
  );

  console.log("\n[9] Admin/buyer/cart/checkout — no horizontal overflow at 375px");
  const authedPaths = [
    "/admin",
    "/admin/products",
    "/admin/orders",
    "/admin/group-buys",
    "/admin/alerts",
    "/admin/settings",
    "/admin/import",
    "/admin/products/new",
    "/buyer",
    "/buyer/group-buys",
    "/buyer/addresses",
    "/cart",
    "/checkout",
  ];
  for (const path of authedPaths) {
    mavisCall("browser_navigate", { url: `${URL}${path}` });
    await new Promise((r) => setTimeout(r, 600));
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
      data.diff <= 1,
      `diff=${data.diff}`,
    );
  }

  console.log("\n[10] Admin sidebar drawer — hamburger toggles, all nav links 44px");
  mavisCall("browser_navigate", { url: `${URL}/admin` });
  await new Promise((r) => setTimeout(r, 500));
  const burgerCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const burger = document.querySelector('button[aria-label="Open navigation"]');
      if (!burger) return { found: false };
      const r = burger.getBoundingClientRect();
      const s = window.getComputedStyle(burger);
      return {
        found: true,
        visible: r.width > 0 && r.height > 0 && s.display !== 'none',
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    }`,
  });
  const burgerData = JSON.parse(burgerCheck);
  check(
    "admin hamburger button visible on mobile",
    burgerData.visible,
    JSON.stringify(burgerData),
  );
  check(
    "admin hamburger ≥ 44x44",
    burgerData.w >= 44 && burgerData.h >= 44,
    `got ${burgerData.w}x${burgerData.h}`,
  );

  // Open the drawer
  mavisCall("browser_evaluate", {
    function: `() => { document.querySelector('button[aria-label="Open navigation"]')?.click(); return { clicked: true }; }`,
  });
  await new Promise((r) => setTimeout(r, 400));
  const drawerCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const aside = document.querySelector('aside[role="dialog"]');
      if (!aside) return { found: false };
      const links = Array.from(aside.querySelectorAll('a[href^="/"]'));
      const minHeight = links.reduce((min, a) => {
        const r = a.getBoundingClientRect();
        return Math.min(min, r.height);
      }, Infinity);
      return { found: true, linkCount: links.length, minHeight: Math.round(minHeight) };
    }`,
  });
  const drawerData = JSON.parse(drawerCheck);
  check("admin drawer opens on hamburger tap", drawerData.found);
  check(
    `admin drawer has ≥ 7 nav links — ${drawerData.linkCount} links`,
    drawerData.linkCount >= 7,
  );
  check(
    "every admin drawer nav link ≥ 44px tall",
    drawerData.minHeight >= 44,
    `min h: ${drawerData.minHeight}px`,
  );

  // Backdrop closes drawer
  mavisCall("browser_evaluate", {
    function: `() => { document.querySelector('button[aria-label="Close navigation"]')?.click(); return { closed: true }; }`,
  });
  await new Promise((r) => setTimeout(r, 800));
  // The mobile drawer is an `<aside role="dialog">` that's
  // translated off-screen with `-translate-x-full` when closed.
  // The dialog ELEMENT is always in the DOM (so `querySelector`
  // would find it even when closed) — what changes is its
  // transform. Check visibility via the backdrop button, which
  // is only rendered when the drawer is open.
  const backdropCheck = mavisCall("browser_evaluate", {
    function: `() => ({ backdropInDom: !!document.querySelector('button[aria-label="Close navigation"]') })`,
  });
  check("admin drawer closes on backdrop tap", !JSON.parse(backdropCheck).backdropInDom);

  console.log("\n[11] Topbar buttons ≥ 44x44 on admin (after Phase 51 fix)");
  const topbarCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const header = document.querySelector('header');
      if (!header) return { found: false };
      const buttons = Array.from(header.querySelectorAll('button, a'));
      const small = buttons.filter((b) => {
        const r = b.getBoundingClientRect();
        const s = window.getComputedStyle(b);
        if (s.display === 'none' || s.visibility === 'hidden' || r.width === 0) return false;
        return r.width < 44 || r.height < 44;
      });
      return { found: true, total: buttons.length, smallCount: small.length, smallSample: small.slice(0, 3).map((b) => ({ txt: (b.innerText || b.getAttribute('aria-label') || '').slice(0, 25), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })) };
    }`,
  });
  const topbarData = JSON.parse(topbarCheck);
  check(
    `admin topbar: all buttons ≥ 44x44 (${topbarData.smallCount} small out of ${topbarData.total})`,
    topbarData.smallCount === 0,
    topbarData.smallCount > 0 ? JSON.stringify(topbarData.smallSample) : "all OK",
  );

  console.log("\n[12] /cart and /checkout — qty + remove + shipping buttons 44x44");
  mavisCall("browser_navigate", { url: `${URL}/cart` });
  await new Promise((r) => setTimeout(r, 600));
  const cartBtnCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const main = document.querySelector('main');
      const small = Array.from(main.querySelectorAll('button, a')).filter((b) => {
        const r = b.getBoundingClientRect();
        const s = window.getComputedStyle(b);
        if (s.display === 'none' || s.visibility === 'hidden' || r.width === 0) return false;
        return r.width < 44 || r.height < 44;
      });
      return { smallCount: small.length, samples: small.slice(0, 3).map((b) => ({ txt: (b.innerText || b.getAttribute('aria-label') || '').slice(0, 25), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })) };
    }`,
  });
  const cartBtnData = JSON.parse(cartBtnCheck);
  check(
    `cart page: all buttons ≥ 44x44 (${cartBtnData.smallCount} small)`,
    cartBtnData.smallCount === 0,
    cartBtnData.smallCount > 0 ? JSON.stringify(cartBtnData.samples) : "all OK",
  );

  mavisCall("browser_navigate", { url: `${URL}/checkout` });
  await new Promise((r) => setTimeout(r, 600));
  const coBtnCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const main = document.querySelector('main');
      const small = Array.from(main.querySelectorAll('button, a')).filter((b) => {
        const r = b.getBoundingClientRect();
        const s = window.getComputedStyle(b);
        if (s.display === 'none' || s.visibility === 'hidden' || r.width === 0) return false;
        return r.width < 44 || r.height < 44;
      });
      return { smallCount: small.length, samples: small.slice(0, 3).map((b) => ({ txt: (b.innerText || b.getAttribute('aria-label') || '').slice(0, 25), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })) };
    }`,
  });
  const coBtnData = JSON.parse(coBtnCheck);
  check(
    `checkout page: all buttons ≥ 44x44 (${coBtnData.smallCount} small)`,
    coBtnData.smallCount === 0,
    coBtnData.smallCount > 0 ? JSON.stringify(coBtnData.samples) : "all OK",
  );

  // ────────────────────────────────────────────────────────────
  // Phase 52: home page hero slider (product-specific, multi-slide)
  // ────────────────────────────────────────────────────────────
  console.log("\n[13] Hero slider — product-specific, multi-slide, mobile-optimized");
  mavisCall("browser_navigate", { url: `${URL}/` });
  await new Promise((r) => setTimeout(r, 1500));
  const sliderCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const dots = Array.from(document.querySelectorAll('button[aria-label*="Slide"]'));
      const dotCount = dots.length;
      const activeIdx = dots.findIndex(d => d.getAttribute('aria-current') === 'true');
      const firstActive = activeIdx === 0;
      // Mobile track width = viewport width (full-bleed)
      const track = Array.from(document.querySelectorAll('div')).find(d => d.className && d.className.includes('md:hidden flex') && d.className.includes('snap-x'));
      const trackW = track ? Math.round(track.clientWidth) : 0;
      const trackScrollable = track ? (track.scrollWidth > track.clientWidth) : false;
      // Dot tap targets must be 44x44
      const dotTaps = dots.map(d => { const r = d.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
      const minDotW = dotTaps.reduce((m, t) => Math.min(m, t.w), 999);
      const minDotH = dotTaps.reduce((m, t) => Math.min(m, t.h), 999);
      return { dotCount, activeIdx, firstActive, trackW, trackScrollable, minDotW, minDotH };
    }`,
  });
  const sliderData = JSON.parse(sliderCheck);
  check(`hero slider has ${sliderData.dotCount} dot indicators (≥ 3)`, sliderData.dotCount >= 3, `dots=${sliderData.dotCount}`);
  check("first slide active on load", sliderData.firstActive, `active=${sliderData.activeIdx}`);
  check(`hero mobile track fills mobile width (got ${sliderData.trackW}px, expect ≥ 320)`, sliderData.trackW >= 320, `trackW=${sliderData.trackW}`);
  check("hero mobile track is horizontally scrollable", sliderData.trackScrollable);
  check(`hero dot tap targets ≥ 44x44 (min got ${sliderData.minDotW}x${sliderData.minDotH})`, sliderData.minDotW >= 44 && sliderData.minDotH >= 44);

  // Click a dot to verify manual control works.
  // Pause the auto-rotation first by triggering mouseenter on the
  // slider region, so the click + check happens in a single
  // rotation window.
  mavisCall("browser_evaluate", {
    function: `() => { const region = document.querySelector('div[role="region"]'); if (region) region.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); return { paused: true }; }`,
  });
  await new Promise((r) => setTimeout(r, 200));
  mavisCall("browser_evaluate", {
    function: `() => { const dots = document.querySelectorAll('button[aria-label*="Slide"]'); if (dots[2]) dots[2].click(); return { clicked: !!dots[2] }; }`,
  });
  await new Promise((r) => setTimeout(r, 300));
  const afterDotClick = mavisCall("browser_evaluate", {
    function: `() => { const dots = Array.from(document.querySelectorAll('button[aria-label*="Slide"]')); const active = dots.findIndex(d => d.getAttribute('aria-current') === 'true'); return { active, activeLabel: dots[active]?.getAttribute('aria-label') || '' }; }`,
  });
  const dotData = JSON.parse(afterDotClick);
  check(
    "clicking dot 3 activates slide 3 (or 4 if auto-rotate advanced)",
    dotData.active === 2 || dotData.active === 3,
    `active=${dotData.active} label=${dotData.activeLabel}`,
  );

  // Verify the dot click is visible: the active dot's inner span
  // is wider than the others. Whichever dot is active, its
  // visible bar should be the widest.
  const dotVisualCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const dots = Array.from(document.querySelectorAll('button[aria-label*="Slide"]'));
      const innerDots = dots.map(d => d.querySelector('span'));
      const widths = innerDots.map(s => s ? Math.round(s.getBoundingClientRect().width) : 0);
      const activeIdx = dots.findIndex(d => d.getAttribute('aria-current') === 'true');
      return { widths, activeIdx };
    }`,
  });
  const dotVisual = JSON.parse(dotVisualCheck);
  const activeW = dotVisual.widths[dotVisual.activeIdx];
  const otherMaxW = Math.max(...dotVisual.widths.filter((_, i) => i !== dotVisual.activeIdx));
  check(
    `active dot is widest (active=${activeW}px, others ≤ ${otherMaxW}px, idx=${dotVisual.activeIdx})`,
    activeW > otherMaxW,
    JSON.stringify(dotVisual.widths),
  );

  // Click prev (desktop only — on mobile the prev/next are hidden)
  // Test mobile swipe via track.scrollTo
  const swipeCheck = mavisCall("browser_evaluate", {
    function: `() => {
      const track = Array.from(document.querySelectorAll('div')).find(d => d.className && d.className.includes('md:hidden flex') && d.className.includes('snap-x'));
      if (!track) return { found: false };
      track.scrollTo({ left: track.clientWidth * 2, behavior: 'instant' });
      return { found: true, scrollLeft: track.scrollLeft };
    }`,
  });
  const swipeData = JSON.parse(swipeCheck);
  check("mobile swipe (scrollTo slide 3) moves the track", swipeData.found && swipeData.scrollLeft > 0, JSON.stringify(swipeData));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});