// /lib/blog.ts
//
// Phase 25: a minimal blog content store. The first post is
// a deep-dive on Bangladesh import duty (BD customs
// classification, AT/VAT math, common mistakes). The second
// is a beginner-friendly "how to import from China to
// Bangladesh" guide that ranks for the high-intent keyword.
//
// Phase 27 (2026-06-15): the 1688-specific framing was replaced
// with the actual hand-picked flow — Pinduoduo + Taobao + other
// trending China sources — since BanglaSource no longer
// auto-imports from 1688. Use BanglaSource's /admin/products/new
// flow or a sourcing agent to add a product; the workflow on
// the buyer side (BDT, landed cost, customs math) is unchanged.
//
// We keep posts as code (not in a CMS) because:
//   1. The volume is 1-2 posts/month, low enough that the
//      edit-deploy cycle is fast and zero-cost.
//   2. Posts must be statically generated at build time
//      (Vercel Edge) for fast first paint + good Core Web
//      Vitals. A CMS lookup at request time would push the
//      LCP above 2.5s.
//   3. The author (you) is the only editor. A GitHub PR
//      flow is the right shape; the alternative (a CMS)
//      is over-engineering at this scale.
//
// When the volume passes 50 posts or there are > 2
// contributors, swap this for a real CMS (Sanity,
// Contentful) — but keep the same shape so callers don't
// change.

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO date
  updatedAt?: string;
  author: string;
  readingMinutes: number;
  /**
   * The body. We use a small AST of "blocks" so the page
   * component can render with predictable styling without
   * pulling in a markdown parser (which would add ~30kb
   * to the bundle). Each block is one of:
   *
   *   { type: "h2" | "h3", text: string }
   *   { type: "p", text: string }
   *   { type: "ul" | "ol", items: string[] }
   *   { type: "callout", tone: "info" | "warn", text: string }
   *   { type: "code", lang?: string, text: string }
   */
  body: BlogBlock[];
  /** Optional hero image (URL or absolute path). */
  heroImage?: string;
};

export type BlogBlock =
  | { type: "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "callout"; tone: "info" | "warn"; text: string }
  | { type: "code"; lang?: string; text: string };

const POSTS: BlogPost[] = [
  {
    slug: "bangladesh-customs-duty-import-from-china-2026",
    title:
      "Bangladesh customs duty on China imports: the 2026 guide for new wholesalers",
    description:
      "How Bangladesh-specific ৳/kg customs duty works, what triggers the 5% AIT and 15% VAT, and the three mistakes first-time importers make that double their landed cost.",
    publishedAt: "2026-06-12",
    author: "BanglaSource",
    readingMinutes: 9,
    body: [
      {
        type: "p",
        text: "If you're importing from China to Bangladesh for the first time, the customs math is the part that surprises you. The factory FOB is the easy bit — it's the import duty, VAT, and Advance Income Tax (AIT) layered on top that flip your margin if you don't model them up front.",
      },
      { type: "h2", text: "The 3-tier duty stack" },
      {
        type: "p",
        text: "Every shipment that clears Bangladesh customs is liable for three levies, in this order:",
      },
      {
        type: "ol",
        items: [
          "Customs duty (CD) — a specific ৳/kg rate per HS code, set by the NBR.",
          "Value Added Tax (VAT) — 15% of (CIF value + CD). VAT is computed off the post-duty value, not the FOB.",
          "Advance Income Tax (AIT) — 5% of the CIF value. AIT is absorbed by the importer (i.e. you pay it; it's not creditable against your other taxes).",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text: "CIF = Cost (factory FOB in CNY, converted to BDT) + Insurance + Freight. The customs broker computes the BDT-equivalent FOB at the bank rate on the day of clearance — not the rate you saw on the supplier's invoice.",
      },
      { type: "h2", text: "Where the specific ৳/kg duty comes from" },
      {
        type: "p",
        text: "Bangladesh uses a per-kilogram specific duty (not the ad-valorem % that the rest of the world uses). Each HS code maps to a ৳/kg number, e.g. 6109 T-shirts = ৳150/kg, 8517 phone accessories = ৳240/kg. The product you import is the duty class it falls into — not the category on the supplier's listing.",
      },
      {
        type: "p",
        text: "This is the bit that bites new importers. Two products in the same supplier category (e.g. \"phone case\") can land in completely different HS codes depending on the material (silicone vs leather vs plastic) and the function (case vs stand vs mount). A misclassification can cost you 3-5x the actual duty.",
      },
      { type: "h2", text: "Mistake 1 — not adding weight-conditional floors" },
      {
        type: "p",
        text: "If your shipment is small (under 5 kg), the per-kg air-freight rate is not the only floor. The minimum air charge for Bangladesh is ৳1,500 for 200g, ৳2,200 for 500g, ৳3,000 for 1kg. The freight on a 200g sample is not ৳270 — it's ৳1,500. Forgetting this turns \"cheap sample\" into \"expensive mistake\".",
      },
      { type: "h2", text: "Mistake 2 — assuming VAT and AIT cancel out" },
      {
        type: "p",
        text: "They don't. VAT is 15% × (CIF + CD). AIT is 5% × CIF. So on a ৳10,000 CIF + ৳2,000 CD shipment, you pay ৳1,800 VAT + ৳500 AIT = ৳2,300 of taxes the factory never told you about. That's 23% of the CIF — more than most retail margins.",
      },
      { type: "h2", text: "Mistake 3 — using the wrong FX rate" },
      {
        type: "p",
        text: "BDT is managed against the USD, not the CNY. The bangladesh-bank CNY→BDT rate is ~3% worse than the interbank mid-rate you'd see on Google. The customs broker uses the bank rate on clearance day, not the rate the supplier's accountant uses. This 3% adds up to thousands on a bulk order.",
      },
      { type: "h2", text: "The right way to model landed cost" },
      {
        type: "p",
        text: "Stop thinking in terms of FOB + freight. Think in terms of:",
      },
      {
        type: "ul",
        items: [
          "Factory FOB (CNY) × bangladesh-bank rate (BDT/CNY) = FOB in BDT",
          "+ Air or sea freight (BDT) = CIF in BDT",
          "+ Customs duty (৳/kg × weight kg) = post-duty value",
          "+ 15% × (CIF + CD) = VAT",
          "+ 5% × CIF = AIT",
          "= total landed cost in BDT, before your markup",
        ],
      },
      {
        type: "p",
        text: "Once you have that, divide by unit count to get per-unit landed cost, then add your markup. That's the retail price you need to clear your margin. We built the BanglaSource landed-cost calculator around exactly this model — you can try it on any product at /shipping-rates.",
      },
      {
        type: "callout",
        tone: "warn",
        text: "Wholesale ≠ import-and-resell. Most first-time importers forget to model the 6-8 weeks of cash tied up between deposit and delivery. Bank financing, credit card FX fees, and the demurrage on a held shipment all add up. Build a cashflow model, not just a unit-cost model.",
      },
    ],
  },
  {
    slug: "how-to-import-from-china-to-bangladesh",
    title:
      "How to import from China to Bangladesh: a first-order guide for new wholesalers",
    description:
      "From finding a trending product on Pinduoduo or Taobao to a shipment clearing Bangladesh customs — the exact 7-step flow, what to pay in CNY vs BDT, and how to avoid the 3 most common payment scams.",
    publishedAt: "2026-06-15",
    author: "BanglaSource",
    readingMinutes: 8,
    body: [
      {
        type: "p",
        text: "Most of the goods on Bangladeshi shelves started as a single product on a Chinese wholesale site — Pinduoduo, Taobao, or one of a dozen smaller ones. The prices are 30-60% lower than what you'd find locally because there's no middleman — you're buying direct from the factory or the wholesaler. But the platforms are in Chinese, payments are in CNY, and shipping to Bangladesh needs a freight forwarder. Here's the actual workflow.",
      },
      { type: "h2", text: "Why hand-pick instead of bulk-import" },
      {
        type: "p",
        text: "Scraping the entire 1688 catalog and re-listing it is a 2018 play. The bulk of that inventory is now 2-3 years old, the trending products have moved on, and your competitor already has the same listings. The current play is to spot a trending product on Pinduoduo or Taobao (where Chinese consumers are actually buying), verify it's not yet saturated in Bangladesh, and add it to your catalog before anyone else does. BanglaSource does this curation for you on the home page — every product is hand-picked by our China team, with the price and landed cost pre-computed.",
      },
      { type: "h2", text: "Step 1 — find the right product" },
      {
        type: "p",
        text: "Browse the trending tabs on Pinduoduo (pinduoduo.com) and Taobao (world.taobao.com). Look for products with:",
      },
      {
        type: "ul",
        items: [
          "≥ 10,000 units sold in the last 30 days (the trend is real, not a flash sale)",
          "Recent launch (within 6-8 months — older items are saturated)",
          "Visible tier pricing (lower per-unit at higher quantities)",
          "Bangladesh-relevant audience: electronics, beauty, watches, jewelry, bags, shoes, sunglasses",
        ],
      },
      {
        type: "p",
        text: "Cross-check on Alibaba (alibaba.com) for the same factory. If the same factory shows up on the international site at a 30-50% markup, the source is real and can be exported.",
      },
      { type: "h2", text: "Step 2 — verify HS code + duty" },
      {
        type: "p",
        text: "Before you commit, look up the HS code in the Bangladesh customs tariff. Use the NBR's online search at banglepad.gov.bd or this older fallback: bangladeshcustoms.gov.bd. The HS code tells you the ৳/kg specific duty, which is 30-50% of your landed cost for most goods. On BanglaSource, every product's PDP shows the customs class + per-kg duty that's been verified by our team — use it as a sanity check.",
      },
      {
        type: "callout",
        tone: "info",
        text: "If the duty seems high (৳300+/kg), check the next 2-3 HS code variations. \"Cotton t-shirt\" can be 6109.10, 6109.90, or 6110.20 depending on knit vs woven, GSM, and gender. The wrong code costs you thousands per shipment.",
      },
      { type: "h2", text: "Step 3 — request samples (CNY 100-500)" },
      {
        type: "p",
        text: "Always sample. The catalog photos are taken under ideal lighting on units the supplier hand-picked. The real production batch is 5-10% off in color, weight, or finish. Sample cost is 1-3% of your bulk order; it prevents 100% of a bad-batch disaster.",
      },
      {
        type: "p",
        text: "Pay for samples via Wise (cheapest FX) or PayPal (most protected for new buyers). DO NOT pay samples via bank wire to a personal account — that's the #1 scam pattern on Chinese wholesale sites.",
      },
      { type: "h2", text: "Step 4 — negotiate (yes, you can)" },
      {
        type: "p",
        text: "The listed price is not the final price. Open the chat, send a polite message in Chinese (use Translate), and ask for the \"best price for 1,000 pcs\". The supplier will come back 5-15% lower. If you're placing a 5,000+ pcs order, ask for \"VIP price\" — that's another 5-10% off.",
      },
      { type: "h2", text: "Step 5 — choose your freight" },
      {
        type: "p",
        text: "Three options:",
      },
      {
        type: "ul",
        items: [
          "Air — 4-7 days door-to-door, ৳1,348-421/kg, 5kg minimum. Good for samples + small reorders.",
          "Sea LCL — 35-50 days, ৳33,700/CBM, 1 CBM minimum. Good for bulk (1,000+ pcs) where the per-unit freight is < ৳50.",
          "Express (DHL/FedEx) — 3-5 days, fastest but most expensive. Only for time-sensitive or high-value (phone accessories, electronics).",
        ],
      },
      {
        type: "p",
        text: "You don't book this directly. A third-party agent (search \"Bangladesh sourcing agent\" on Google) or a platform like BanglaSource consolidates orders from 5-10 factories and ships them together. That's how you hit 5kg+ on air and 1+ CBM on sea.",
      },
      { type: "h2", text: "Step 6 — pay (100% upfront via BanglaSource, or 30/70 with a sourcing agent)" },
      {
        type: "p",
        text: "If you use BanglaSource, the order is 100% upfront in BDT (full prepayment) — you pay once, we pay the factory in CNY, the forwarder in BDT, and the customs broker in BDT. No FX exposure, no multi-currency reconciliation. The order sits in escrow until you confirm delivery.",
      },
      {
        type: "p",
        text: "If you use a sourcing agent directly, industry standard is 30% deposit on order, 70% balance against a copy of the Bill of Lading. For air shipments it's usually 100% upfront because the order is smaller and the factory's risk is higher. Pay via bank wire to the factory's corporate account (verify the account name matches their business license — this catches 95% of the personal-account scams).",
      },
      { type: "h2", text: "Step 7 — customs clearance + final-mile" },
      {
        type: "p",
        text: "Your freight forwarder or sourcing agent handles the customs broker in Bangladesh. They file the Import General Manifest (IGM), pay the duty + VAT + AIT on your behalf, and deliver the shipment to your door (or your warehouse in Chittagong / Dhaka). Expect to pay the broker 1-2% of the CIF value as a fee, usually cash in advance — factor that into your model.",
      },
      {
        type: "callout",
        tone: "warn",
        text: "Bangladeshi customs has a long memory. Mis-declaring HS codes, under-valuing, or running a side-hustle import business without a trade license can get your name added to a watchlist. Once you're on the list, every future shipment gets pulled for inspection (5-10 day delay). Get a trade license (TIN certificate from NBR) before your second order.",
      },
    ],
  },
];

export function getAllPosts(): BlogPost[] {
  return [...POSTS].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

export function getPost(slug: string): BlogPost | null {
  return POSTS.find((p) => p.slug === slug) ?? null;
}
