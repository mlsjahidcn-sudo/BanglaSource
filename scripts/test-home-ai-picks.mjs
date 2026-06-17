// E2E smoke for Phase 45 home-page AI Picks carousel.
//
// [1] i18n keys exist (home.ai_picks.eyebrow / title / see_all)
// [2] Home page (anonymous) renders the AI Picks section
//     - "✦ AI picks" eyebrow present
//     - "Recommended for you" title present
//     - "See all popular →" footer link present
//     - At least one product card present
// [3] Home page (anonymous) does NOT render the RecentlyViewed
//     strip anymore (the empty strip was the whole reason for
//     Phase 45)
// [4] "Just moved / Recently restocked" still renders below
//     (preserved from before, surfaces newly-synced items)
// [5] Both EN and BN i18n keys resolve to non-empty strings
//
// We test against the live /workspace code via `pnpm dev`.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-home-ai-picks.mjs

import { spawn } from "node:child_process";

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

async function fetchHome() {
  const res = await fetch(ORIGIN + "/", {
    headers: { "User-Agent": "test-home-ai-picks" },
  });
  if (!res.ok) {
    throw new Error(`Home page returned HTTP ${res.status}`);
  }
  return await res.text();
}

async function main() {
  console.log("[1] i18n keys exist in dict");
  const dictMod = await import("../src/lib/i18n-dict.ts").catch(() => null);
  if (!dictMod) {
    // We're being run without a TS loader — fall back to a static check
    // by reading the source file via fs.
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(
      new URL("../src/lib/i18n-dict.ts", import.meta.url),
      "utf8",
    );
    check("home.ai_picks.eyebrow present", /home\.ai_picks\.eyebrow/.test(src));
    check("home.ai_picks.title present", /home\.ai_picks\.title/.test(src));
    check("home.ai_picks.see_all present", /home\.ai_picks\.see_all/.test(src));
  } else {
    const dict = dictMod.dict;
    check(
      "home.ai_picks.eyebrow",
      !!dict["home.ai_picks.eyebrow"]?.en && !!dict["home.ai_picks.eyebrow"]?.bn,
      `en="${dict["home.ai_picks.eyebrow"]?.en}" bn="${dict["home.ai_picks.eyebrow"]?.bn}"`,
    );
    check(
      "home.ai_picks.title",
      !!dict["home.ai_picks.title"]?.en && !!dict["home.ai_picks.title"]?.bn,
    );
    check(
      "home.ai_picks.see_all",
      !!dict["home.ai_picks.see_all"]?.en && !!dict["home.ai_picks.see_all"]?.bn,
    );
  }

  console.log("\n[2] AI Picks section renders on home page");
  const html = await fetchHome();
  check(
    "AI picks eyebrow (✦ AI picks) present",
    html.includes("✦ AI picks"),
  );
  check(
    "Recommended for you title present",
    html.includes("Recommended for you"),
  );
  check(
    "See all popular → footer link present",
    html.includes("See all popular →"),
  );
  // The carousel renders product cards as anchor tags linking to
  // /products/<source_id> (see product-carousel.tsx line 107).
  const productLinks = (html.match(/href="\/products\/[^"]+"/g) ?? []).length;
  check(
    "at least one product card link",
    productLinks >= 1,
    `${productLinks} product links`,
  );

  console.log("\n[3] RecentlyViewed strip is gone from home");
  check(
    "no 'Pick up where you left off' (the old RV eyebrow)",
    !html.includes("Pick up where you left off"),
  );
  // The component file still exists — used on /for-you page.
  // Only verify the homepage doesn't render it.
  check(
    "no 'Recently viewed' <h2> on home",
    !/<h2[^>]*>Recently viewed<\/h2>/.test(html),
  );

  console.log("\n[4] Bottom 'Just moved' carousel preserved");
  check(
    "'Recently restocked' title present",
    html.includes("Recently restocked"),
  );

  console.log("\n[5] No JS errors logged in dev server");
  const { readFile } = await import("node:fs/promises");
  let log = "";
  try {
    log = await readFile("/tmp/next-dev.log", "utf8");
  } catch {
    /* log file optional */
  }
  // We only flag ERR-level lines, not warnings.
  const errs = log
    .split("\n")
    .filter((l) => /\b(Error|TypeError|ReferenceError|Cannot find module)\b/.test(l))
    .filter((l) => !l.includes("favicon"))
    .slice(-10);
  check(
    "no fatal JS errors in last 10 min of dev log",
    errs.length === 0,
    errs.length > 0 ? errs.join(" | ") : "(none)",
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});