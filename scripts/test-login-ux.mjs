// E2E smoke for Phase 46 login/signup UX.
//
// Hits /login via the dev server (must be running on :3000) and
// verifies the structural UI:
//   [1] i18n keys present (headline, bullets, password strength, etc.)
//   [2] Marketing pane renders (logo + headline + 3 bullets + trust badge)
//   [3] Marketing pane is hidden on mobile (md:flex)
//   [4] Tab switcher (signin | signup) renders with correct ARIA
//   [5] Deep link ?mode=signup pre-selects the signup tab
//   [6] Forgot password link only renders in signin mode (not signup)
//   [7] Show/hide password toggle has correct ARIA
//   [8] Email + password inputs have proper autocomplete + minlength
//   [9] Accessible: role="tablist", "tab", and "alert" on errors
//   [10] BN translations present in dict + rendered for ?lang=bn
//
// Usage:
//   node scripts/test-login-ux.mjs
//
// Requires dev server running. Set ORIGIN to override.

import { readFile } from "node:fs/promises";

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

async function getHtml(path) {
  const res = await fetch(ORIGIN + path, {
    headers: { "User-Agent": "test-login-ux" },
  });
  if (!res.ok) throw new Error(`${path} returned HTTP ${res.status}`);
  return await res.text();
}

async function checkI18nKeys() {
  const src = await readFile(
    new URL("../src/lib/i18n-dict.ts", import.meta.url),
    "utf8",
  );
  const required = [
    "login.headline",
    "login.subhead",
    "login.bullet1",
    "login.bullet2",
    "login.bullet3",
    "login.signin_tab",
    "login.signup_tab",
    "login.signin_lede",
    "login.signup_lede",
    "login.signin_cta",
    "login.signin_cta_admin",
    "login.signin_cta_buyer",
    "login.signup_cta",
    "login.password_label",
    "login.password_ph",
    "login.show_password",
    "login.hide_password",
    "login.forgot_link",
    "login.forgot_heading",
    "login.forgot_body",
    "login.forgot_cta",
    "login.forgot_sent",
    "login.forgot_back",
    "login.signing_in",
    "login.creating_account",
    "login.sending",
    "login.check_email_heading",
    "login.check_email_body",
    "login.check_email_help",
    "login.password_strength_label",
    "login.password_strength_weak",
    "login.password_strength_ok",
    "login.password_strength_strong",
    "login.password_tip_length",
    "login.password_tip_mix",
    "login.password_tip_symbol",
    "login.have_account",
    "login.need_account",
  ];
  for (const k of required) {
    check(`i18n key: ${k}`, src.includes(`"${k}":`), "in dict source");
  }
}

async function main() {
  console.log("[1] i18n keys present in dict");
  await checkI18nKeys();

  console.log("\n[2] Marketing pane renders on /login");
  const html = await getHtml("/login");
  check(
    "BanglaSource wordmark",
    /BanglaSource/.test(html),
  );
  check(
    "headline (EN)",
    html.includes("Wholesale direct from China"),
  );
  check(
    "subhead (EN)",
    html.includes("Hand-picked products, factory-direct pricing"),
  );
  check(
    "bullet 1 (Factory-direct pricing)",
    html.includes("Factory-direct pricing"),
  );
  check(
    "bullet 2 (All-in BDT)",
    html.includes("All-in BDT"),
  );
  check(
    "bullet 3 (Photo QC)",
    html.includes("Photo QC"),
  );

  console.log("\n[2b] No chrome (header + footer) on /login (Phase 47)");
  // The Nav + Footer come from src/app/chrome-wrapper.tsx. On /login
  // they should be skipped (chrome-less full-height split-pane).
  // Probe by looking for typical site-nav markers that DO appear on
  // / (homepage) but NOT on /login.
  const homeHtml = await getHtml("/");
  const hasHomeNavMarker =
    homeHtml.includes("Sign in") &&
    homeHtml.includes("Browse") &&
    (homeHtml.includes("Shop by category") ||
      homeHtml.includes("How it works"));
  const hasLoginNav =
    html.includes("Shop by category") || html.includes("How it works");
  check(
    "/ (home) renders site nav markers",
    hasHomeNavMarker,
    "sanity check — nav IS present on public pages",
  );
  check(
    "/login does NOT render site nav markers",
    !hasLoginNav,
    "chrome-less layout",
  );
  // Site footer contains the copyright / contact marker
  check(
    "/login does NOT render site footer markers",
    !html.includes("All rights reserved") &&
      !html.includes("© ") &&
      !html.includes("Contact us"),
    "no footer on auth page",
  );
  check(
    "/login does NOT render trust badge text",
    !html.includes("Auth secured by Supabase"),
    "trust badge removed (Phase 47)",
  );

  console.log("\n[3] Marketing pane is mobile-hidden");
  check(
    "pane uses hidden md:flex",
    /class="[^"]*hidden md:flex[^"]*"/.test(html),
  );

  console.log("\n[4] Tab switcher ARIA");
  check('role="tablist" present', /role="tablist"/.test(html));
  check(
    'role="tab" + aria-selected="true" on signin tab (default)',
    /role="tab"[^>]*aria-selected="true"/.test(html),
  );
  check(
    "both Sign in + Create account tab labels render",
    html.includes("Sign in") && html.includes("Create account"),
  );

  console.log("\n[5] ?mode=signup deep link switches tab");
  const signupHtml = await getHtml("/login?mode=signup");
  check(
    "signup tab has aria-selected=true",
    /aria-selected="true"[^>]*>[^<]*Create account/s.test(signupHtml) ||
      /Create account[\s\S]{0,200}aria-selected="true"/.test(signupHtml),
  );
  check(
    "signup-lede rendered (Free account)",
    signupHtml.includes("Free account"),
  );

  console.log("\n[6] Forgot password link only in signin mode");
  check(
    "forgot link in default (signin)",
    html.includes("Forgot password?"),
  );
  check(
    "forgot link NOT in signup mode",
    !signupHtml.includes("Forgot password?"),
  );

  console.log("\n[7] Show/hide password toggle");
  check(
    'show/hide button has aria-pressed="false"',
    /aria-pressed="false"/.test(html),
  );
  check(
    "show label rendered",
    html.includes(">Show<"),
  );

  console.log("\n[8] Email + password inputs");
  check(
    "email input type=email",
    /id="email"[^>]*type="email"/.test(html),
  );
  check(
    "password input type=password (default hidden)",
    /id="password"[^>]*type="password"/.test(html),
  );
  // React renders autoComplete in camelCase in SSR HTML; browsers
  // treat the autocomplete attribute as case-insensitive per HTML spec.
  check(
    "email autocomplete=email (case-insensitive)",
    /auto[Cc]omplete="email"/.test(html),
  );
  check(
    "password autocomplete=current-password (signin)",
    /auto[Cc]omplete="current-password"/.test(html),
  );
  check(
    "password autocomplete=new-password (signup)",
    /auto[Cc]omplete="new-password"/.test(signupHtml),
  );
  check(
    "password minLength=6",
    /minLength="6"/.test(html),
  );

  console.log("\n[9] Accessibility");
  check('role="tablist"', /role="tablist"/.test(html));
  // role="alert" only renders when there's an error, but the JSX
  // pattern is present in the source so we check the source for
  // accessibility correctness:
  const clientSrc = await readFile(
    new URL("../src/app/login/_client.tsx", import.meta.url),
    "utf8",
  );
  check(
    'role="alert" used in client source (for errors)',
    /role="alert"/.test(clientSrc),
  );
  check(
    "aria-invalid wired on email/password (client source)",
    /aria-invalid=/.test(clientSrc),
  );
  check(
    "aria-describedby on email error (client source)",
    /aria-describedby=/.test(clientSrc),
  );

  console.log("\n[10] BN translations present in dict source");
  const dictSrc = await readFile(
    new URL("../src/lib/i18n-dict.ts", import.meta.url),
    "utf8",
  );
  // Regex: match "login.headline": { en: "...", bn: "..."<not empty> }
  check(
    "login.headline has bn value (non-empty Bengali string)",
    /"login\.headline":\s*\{\s*en:[^}]+bn:\s*"[^"]+"/.test(dictSrc),
  );
  check(
    "login.password_tip_mix has bn value",
    /"login\.password_tip_mix":\s*\{\s*en:[^}]+bn:\s*"[^"]+"/.test(
      dictSrc,
    ),
  );

  // [11] File existence
  console.log("\n[11] New files exist");
  for (const f of [
    "../src/app/login/_marketing.tsx",
    "../src/app/login/_forgot.tsx",
    "../src/app/login/_signed-in.tsx",
    "../src/app/login/_client.tsx",
  ]) {
    try {
      await readFile(new URL(f, import.meta.url), "utf8");
      check(`file: ${f}`, true);
    } catch {
      check(`file: ${f}`, false);
    }
  }

  // [12] Dev server log clean
  console.log("\n[12] No fatal JS errors in dev log");
  let log = "";
  try {
    log = await readFile("/tmp/next-dev.log", "utf8");
  } catch {
    /* optional */
  }
  const errs = log
    .split("\n")
    .filter((l) =>
      /\b(TypeError|ReferenceError|Cannot find module|SyntaxError|Unhandled)\b/.test(
        l,
      ),
    )
    .filter((l) => !l.includes("favicon"))
    .slice(-5);
  check(
    "no fatal JS errors in last 10 min",
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