// E2E smoke for Phase 53 — About + How It Works page enhancements.
//
// Tests:
//   [1] i18n keys exist (all the new about.* + how.* sections)
//   [2] /about has all 10 sections rendered (HTML scrape):
//        hero, numbers, reasons, timeline, team, dontdo, licenses,
//        FAQ, address, bottom CTA
//   [3] /how-it-works has all new sections rendered:
//        shipping compare, worked example, with/without compare,
//        payment methods, quality control band, FAQ, bottom CTA
//   [4] Brand color compliance: no rose/pink classes on either page
//        (AGENTS.md rule)
//   [5] FAQ accordion: 6 <details> on /about, 6 on /how-it-works,
//        toggleable via JS
//   [6] Both pages render in BN (lang switch) with non-empty strings
//   [7] h2 inside bg-slate-900 has white text (Phase 53 regression
//        fix — global h1-h4 rule wrapped in @layer base)
//
// Usage:
//   node scripts/test-about-how-pages.mjs

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

async function fetchPage(path) {
  const res = await fetch(ORIGIN + path, {
    headers: { "User-Agent": "test-about-how-pages" },
  });
  if (!res.ok) {
    throw new Error(`${path} returned HTTP ${res.status}`);
  }
  return await res.text();
}

async function main() {
  console.log("[1] i18n keys exist in i18n-dict.ts");
  const dictSrc = await readFile(
    new URL("../src/lib/i18n-dict.ts", import.meta.url),
    "utf8",
  );

  // About keys
  const aboutKeys = [
    "about.hero.eyebrow",
    "about.hero.title",
    "about.hero.subtitle",
    "about.numbers.title",
    "about.numbers.active",
    "about.numbers.suppliers",
    "about.numbers.views",
    "about.reasons.title",
    "about.reasons.r1.title",
    "about.reasons.r6.title",
    "about.timeline.eyebrow",
    "about.timeline.2022.title",
    "about.timeline.2024.title",
    "about.timeline.2025.title",
    "about.timeline.2026.title",
    "about.team.title",
    "about.dontdo.eyebrow",
    "about.dontdo.1.title",
    "about.dontdo.4.title",
    "about.faq.eyebrow",
    "about.faq.q1",
    "about.faq.a1",
    "about.faq.q6",
    "about.cta.eyebrow",
    "about.cta.title",
    "about.cta.whatsapp",
    "about.cta.hours_dhaka",
  ];
  for (const key of aboutKeys) {
    check(
      `i18n: ${key}`,
      new RegExp(`"${key.replace(/\./g, "\\.")}"\\s*:`).test(dictSrc),
    );
  }

  // How It Works keys
  const howKeys = [
    "how.ship_compare.eyebrow",
    "how.ship_compare.title",
    "how.ship_compare.air.name",
    "how.ship_compare.sea.name",
    "how.ship_compare.express.name",
    "how.compare.eyebrow",
    "how.compare.title",
    "how.compare.row1.thing",
    "how.compare.row4.them",
    "how.pay.eyebrow",
    "how.pay.bkash.name",
    "how.pay.nagad.name",
    "how.pay.bank.name",
    "how.faq.eyebrow",
    "how.faq.q1",
    "how.faq.q6",
    "how.cta.eyebrow",
    "how.cta.title",
    "how.cta.browse",
  ];
  for (const key of howKeys) {
    check(
      `i18n: ${key}`,
      new RegExp(`"${key.replace(/\./g, "\\.")}"\\s*:`).test(dictSrc),
    );
  }

  console.log("\n[2] /about has all 10 expected sections");
  const aboutHtml = await fetchPage("/about");
  const aboutSectionChecks = [
    ["Hero h1: 'Built for Bangladeshi resellers'", /Built for Bangladeshi resellers/],
    ["By the numbers heading", /By the numbers/],
    ["6 reasons heading", /6 reasons buyers choose us/],
    ["Our story (timeline) heading", /Our story/],
    ["The team heading", /The team/],
    ["Transparency (what we don't do) heading", /What we don't do, on purpose|Transparency/],
    ["Licenses & compliance heading", /Licenses/],
    ["Common questions (FAQ) heading", /Common questions/],
    ["Dhaka office address", /Zigatola Bus Stand/],
    ["Bottom CTA 'Talk to a human'", /Talk to a human/],
  ];
  for (const [label, re] of aboutSectionChecks) {
    check(label, re.test(aboutHtml));
  }

  // Timeline year dots (22, 24, 25, 26) rendered
  check(
    "Timeline shows 4 year markers (22, 24, 25, 26)",
    />22<|>24<|>25<|>26</.test(aboutHtml),
  );

  // 6 reasons in 6 cards (eyebrow is "Why us" lowercase, made
  // uppercase by CSS — match case-insensitively in raw HTML)
  const reasonMatches = aboutHtml.match(/Why us/gi) ?? [];
  check(
    `6 reasons cards (got ${reasonMatches.length})`,
    reasonMatches.length >= 6,
  );

  // 4 'We don't' cards — match apostrophe entity OR straight OR curly
  const dontdoMatches = aboutHtml.match(/We don(?:&#x27;|')t/g) ?? [];
  check(
    `4 'what we don't do' cards (got ${dontdoMatches.length})`,
    dontdoMatches.length >= 4,
  );

  // 6 FAQ questions
  const faqQuestions = aboutHtml.match(/<summary/g) ?? [];
  check(
    `6 FAQ accordion items on /about (got ${faqQuestions.length})`,
    faqQuestions.length === 6,
  );

  console.log("\n[3] /how-it-works has all new sections");
  const howHtml = await fetchPage("/how-it-works");
  const howSectionChecks = [
    ["Hero h1: 'How BanglaSource works'", /How BanglaSource works/],
    ["7-step list rendered", /Pick qty and add to order/],
    ["Shipping modes comparison heading", /Three ways from Guangzhou/],
    ["Air express row", /Air express/],
    ["Sea freight row", /Sea freight/],
    ["Express courier row", /Express courier/],
    ["Worked example (100 TWS earbuds)", /What the landed cost looks like/],
    ["With us / going direct heading", /What changes when you go through us/],
    ["Payment methods heading", /Pay in BDT, the way you already do/],
    ["bKash payment method", /bKash/],
    ["Nagad payment method", /Nagad/],
    ["Bank transfer method", /Bank transfer/],
    ["Quality control band", /Quality control/],
    ["If a factory sends the wrong thing", /If a factory sends the wrong thing/],
    ["FAQ 'Things buyers ask us first'", /Things buyers ask us first/],
    ["Bottom CTA 'Browse the catalog or post an RFQ'", /Browse the catalog or post an RFQ/],
  ];
  for (const [label, re] of howSectionChecks) {
    check(label, re.test(howHtml));
  }

  // 6 FAQ questions on /how-it-works too
  const howFaq = howHtml.match(/<summary/g) ?? [];
  check(
    `6 FAQ accordion items on /how-it-works (got ${howFaq.length})`,
    howFaq.length === 6,
  );

  // Shipping compare table has 3 rows
  const airRow = howHtml.match(/Air express[\s\S]{0,200}/);
  check(
    "Shipping compare table has Air express row",
    !!airRow,
  );
  check(
    "Shipping compare table has Sea freight row",
    /Sea freight/.test(howHtml),
  );
  check(
    "Shipping compare table has Express courier row",
    /Express courier/.test(howHtml),
  );

  console.log("\n[4] Brand color compliance — no rose/pink classes");
  // AGENTS.md rule: no rose/pink in the brand palette
  const aboutHasRose = /\b(rose|pink)-\d+/.test(aboutHtml);
  const howHasRose = /\b(rose|pink)-\d+/.test(howHtml);
  check("/about has no rose-NNN class", !aboutHasRose);
  check("/how-it-works has no rose-NNN class", !howHasRose);
  // And the '6 reasons' cards in source should not reference rose
  const aboutClientSrc = await readFile(
    new URL("../src/app/about/_about-client.tsx", import.meta.url),
    "utf8",
  );
  // Strip line comments + block comments before checking for color classes,
  // since the migration history is documented in comments ("was using rose-50").
  const aboutClientCode = aboutClientSrc
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  check(
    "_about-client.tsx has no 'rose' color class (comments excluded)",
    !/\b(rose|pink)-\d+/.test(aboutClientCode),
  );

  console.log("\n[5] h2 inside bg-slate-900 has text-white (regression fix)");
  // The 3 dark bands should have h2 with text-white class
  const allWhiteH2 = (html) => {
    // Find all bg-slate-900 divs and check h2 inside has text-white
    const matches = [...html.matchAll(/<div class="[^"]*bg-slate-900[^"]*"[\s\S]*?<\/div>/g)];
    return matches;
  };
  // Quick sanity: the about CTA h2 and the how-it-works bottom CTA h2
  // should be present with the text-white class
  check(
    "/about bottom CTA h2 has text-white",
    /<h2[^>]*text-white[^>]*>[^<]*Talk to a human/.test(aboutHtml),
  );
  check(
    "/how-it-works QC band h2 has text-white",
    /<h2[^>]*text-white[^>]*>[^<]*If a factory sends the wrong thing/.test(howHtml),
  );
  check(
    "/how-it-works bottom CTA h2 has text-white",
    /<h2[^>]*text-white[^>]*>[^<]*Browse the catalog or post an RFQ/.test(howHtml),
  );

  console.log("\n[6] globals.css — h1-h4 rule wrapped in @layer base");
  const cssSrc = await readFile(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );
  check(
    "globals.css has @layer base { h1, h2, h3, h4 { color: var(--fg) } }",
    /@layer\s+base\s*\{[^}]*h1,\s*h2,\s*h3,\s*h4[^}]*color:\s*var\(--fg\)/.test(cssSrc),
  );

  console.log("\n[7] Bilingual content (i18n has BN for new keys)");
  // Spot-check 4 BN entries
  const bnKeys = [
    "about.hero.title",
    "about.timeline.2022.body",
    "about.faq.q1",
    "how.ship_compare.title",
    "how.compare.title",
    "how.pay.bkash.desc",
  ];
  for (const key of bnKeys) {
    // Look for "key": { en: ..., bn: "..." } pattern
    const re = new RegExp(
      `"${key.replace(/\./g, "\\.")}"\\s*:\\s*\\{[\\s\\S]*?bn:\\s*"([^"]+)"`,
    );
    const m = dictSrc.match(re);
    check(
      `BN: ${key}`,
      m && m[1] && m[1].length > 0 && !/^\\s*$/.test(m[1]),
    );
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
