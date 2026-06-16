// scripts/test-pricing-tiers.mts
//
// Smoke-tests the tiered air/express/sea freight pricing AND the
// per-kg customs duty (Bangladesh air-cargo specific duty schedule).
// All shipping rates are in BDT — only the factory FOB uses CNY.
//
// Run with:
//   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/test-pricing-tiers.mts

import { airShippingBdt, seaShippingBdt, airRateTier, chargeableWeightKg, FX_CNY_BDT, landedCost, airShippingBreakdown, unitProductBdt } from "../src/lib/pricing";

let pass = 0;
let fail = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function approx(actual: number, expected: number, tol = 1) {
  return Math.abs(actual - expected) <= tol;
}

console.log("\n=== Air freight tiering (in BDT) ===\n");

// Weight-aware minimum ladder — small parcels have a smaller realistic
// minimum than 1kg+ parcels (the carrier still has to handle them,
// but the handling cost is much less than 1kg+).
//
//   ≤0.2 kg    min ৳1,500  (document-class)
//   ≤0.5 kg    min ৳2,200
//   ≤1.0 kg    min ৳3,000
//   ≤2.0 kg    min ৳4,000
//   >2.0 kg    no floor (per-kg rate takes over)

// 0.05 kg (1 sunglass, the user's reported case)
check(
  "0.05kg via air → floor ৳1,500 (document tier)",
  airShippingBdt(0.05, 0.00045) === 1500,
);
check(
  "0.05kg via air → tier shows ৳1,348/kg (small-parcel premium)",
  airRateTier(0.05).rateBdtPerKg === 1348,
);
check(
  "0.05kg via air → min ৳1,500 (NOT ৳4,718)",
  airRateTier(0.05).minBdt === 1500,
);

// 0.10 kg (2 sunglasses)
check(
  "0.10kg via air → floor ৳1,500 (NOT ৳4,718)",
  airShippingBdt(0.10, 0.0005) === 1500,
);

// 0.16 kg (2 Pro6)
check(
  "0.16kg via air → floor ৳1,500 (NOT ৳4,718)",
  airShippingBdt(0.16, 0.00032) === 1500,
);

// 0.40 kg (5 Pro6) → 0.2-0.5kg tier, min ৳2,200
check(
  "0.40kg via air → still ৳1,348/kg tier",
  airRateTier(0.40).rateBdtPerKg === 1348,
);
check(
  "0.40kg via air → 0.40*1348=539 → floor ৳2,200",
  airShippingBdt(0.40, 0.00032) === 2200,
);

// 0.7 kg
check(
  "0.7kg via air → floor ৳3,000 (0.5-1.0kg tier)",
  airShippingBdt(0.7, 0.001) === 3000,
);

// 1.5 kg
check(
  "1.5kg via air → floor ৳4,000 (1.0-2.0kg tier)",
  airShippingBdt(1.5, 0.002) === 4000,
);

// 3 kg: no floor (over 2kg, per-kg rate takes over)
check(
  "3kg via air → 3*843=2529, no floor",
  airShippingBdt(3, 0.005) === 2529,
);

// 8 kg: 8*843=6744, no floor
check("8kg via air → ৳6,744 (no floor)", airShippingBdt(8, 0.01) === 6744);

// 12 kg: drops to 10-50kg tier (৳590/kg)
check("12kg via air → ৳590/kg tier", airRateTier(12).rateBdtPerKg === 590);
check("12kg via air → 12*590=7080", airShippingBdt(12, 0.02) === 7080);

// 60 kg: drops to 50kg+ tier (৳421/kg)
check("60kg via air → ৳421/kg tier", airRateTier(60).rateBdtPerKg === 421);
check("60kg via air → 60*421=25260", airShippingBdt(60, 0.1) === 25260);

// Just at the tier boundary
check("2kg via air → still 0-2kg tier (≤)", airRateTier(2).rateBdtPerKg === 1348);
check("2.01kg via air → drops to 2-10kg tier", airRateTier(2.01).rateBdtPerKg === 843);
check("10kg via air → still 2-10kg tier (≤)", airRateTier(10).rateBdtPerKg === 843);
check("10.01kg via air → drops to 10-50kg tier", airRateTier(10.01).rateBdtPerKg === 590);

// airShippingBreakdown() helper
const bd05 = airShippingBreakdown(0.05, 0.00045);
check("0.05kg breakdown: perKgAmount = 67 (0.05*1348)", bd05.perKgAmount === 67);
check("0.05kg breakdown: floorApplied = true", bd05.floorApplied === true);
check("0.05kg breakdown: totalBdt = 1500", bd05.totalBdt === 1500);
const bd3 = airShippingBreakdown(3, 0.005);
check("3kg breakdown: perKgAmount = 2529", bd3.perKgAmount === 2529);
check("3kg breakdown: floorApplied = false", bd3.floorApplied === false);
check("3kg breakdown: totalBdt = 2529 (no floor)", bd3.totalBdt === 2529);

console.log("\n=== Sea freight ===\n");
check("0.001 CBM sea → floor ৳5,055", seaShippingBdt(0.001) === 5055);
check("0.1 CBM sea → floor ৳5,055 (0.1*33700=3370, below floor)", seaShippingBdt(0.1) === 5055);
check("0.2 CBM sea → ৳6,740 (above floor)", seaShippingBdt(0.2) === 6740);
check("1.0 CBM sea → ৳33,700", seaShippingBdt(1.0) === 33700);

console.log("\n=== Chargeable weight (max(actual, volumetric)) ===\n");
check(
  "Pro6 80g + 0.00032 CBM → 0.08kg (vol 0.002 is lower)",
  approx(chargeableWeightKg(0.08, 0.00032), 0.08),
);
check(
  "Bulky box 5kg + 0.5 CBM → 5kg (vol 2.99 < actual)",
  approx(chargeableWeightKg(5, 0.5), 5),
);
check(
  "Light fluffy item 1kg + 0.5 CBM → 2.99kg (vol > actual)",
  approx(chargeableWeightKg(1, 0.5), 2.99, 0.01),
);

console.log("\n=== /api/quote/landed live ===\n");

const API = process.env.API_URL ?? "http://localhost:3000";

interface QuoteResponse {
  ok: boolean;
  warnings: string[];
  quote: {
    cnSubtotalBdt: number;
    cnDomesticBdt: number;
    agentBdt: number;
    intlBdt: number;
    chargeableKg: number;
    volumetricKg: number;
    rateTier?: { tierMaxKg: number; rateBdtPerKg: number; minBdt: number } | null;
    shippingBreakdown?: { perKgAmount: number; floorApplied: boolean } | null;
    totalBdt: number;
    unitBdt: number;
    shippingDominantPct: number;
    tooSmallForAir: boolean;
    dutyBdt: number;
    dutyPerKg: number;
    dutyClass: string;
    cifBdt: number;
    vatBdt: number;
    aitBdt: number;
    markupBdt: number;
    markupPct: number;
    productBdt: number;
    deliveryBdt: number;
  };
}

async function getQuote(productId: string, qty: number, mode: "air" | "sea" | "express") {
  const r = await fetch(`${API}/api/quote/landed?productId=${productId}&qty=${qty}&mode=${mode}`);
  if (!r.ok) throw new Error(`quote api ${r.status}`);
  return (await r.json()) as QuoteResponse;
}

const pro6_2 = await getQuote("873514490218", 2, "air");
check("Pro6 × 2 air: rateTier present", pro6_2.quote.rateTier != null);
check("Pro6 × 2 air: rateTier.tierMaxKg = 2", pro6_2.quote.rateTier?.tierMaxKg === 2);
check("Pro6 × 2 air: rateTier.rateBdtPerKg = 1348", pro6_2.quote.rateTier?.rateBdtPerKg === 1348);
check(
  "Pro6 × 2 air: rateTier.minBdt = 1500 (weight-aware floor, NOT ৳4,718)",
  pro6_2.quote.rateTier?.minBdt === 1500,
);
check(
  "Pro6 × 2 air: intlBdt = 1500 (weight-aware floor, NOT ৳4,718)",
  pro6_2.quote.intlBdt === 1500,
);
check(
  "Pro6 × 2 air: shippingBreakdown.perKgAmount = 216",
  pro6_2.quote.shippingBreakdown?.perKgAmount === 216,
);
check(
  "Pro6 × 2 air: shippingBreakdown.floorApplied = true",
  pro6_2.quote.shippingBreakdown?.floorApplied === true,
);
check("Pro6 × 2 air: cnDomesticBdt = 337 (floor)", pro6_2.quote.cnDomesticBdt === 337);
check("Pro6 × 2 air: agentBdt = 506 (floor)", pro6_2.quote.agentBdt === 506);
check("Pro6 × 2 air: volumetricKg present", typeof pro6_2.quote.volumetricKg === "number");
check("Pro6 × 2 air: tooSmallForAir = true", pro6_2.quote.tooSmallForAir === true);
check(
  "Pro6 × 2 air: small-parcel warning present",
  pro6_2.warnings.some((w) => w.includes("Small-parcel premium")),
);
check(
  "Pro6 × 2 air: warning text uses ৳ not ¥",
  !pro6_2.warnings.some((w) => w.includes("¥")),
);

const pro6_100 = await getQuote("873514490218", 100, "air");
check(
  "Pro6 × 100 air: 8kg → ৳843/kg tier (2-10kg)",
  pro6_100.quote.rateTier?.rateBdtPerKg === 843,
);
check("Pro6 × 100 air: tooSmallForAir = false", pro6_100.quote.tooSmallForAir === false);

const pro6_500 = await getQuote("873514490218", 500, "air");
check(
  "Pro6 × 500 air: 40kg → ৳590/kg tier (10-50kg)",
  pro6_500.quote.rateTier?.rateBdtPerKg === 590,
);

const pro6_2_sea = await getQuote("873514490218", 2, "sea");
check("Pro6 × 2 sea: rateTier = null", pro6_2_sea.quote.rateTier === null);
check("Pro6 × 2 sea: intlBdt = 5055 (floor)", pro6_2_sea.quote.intlBdt === 5055);

console.log("\n=== Per-kg customs duty (BD air-cargo specific) ===\n");

// 873514490218 = Pro6 TWS earbuds → bluetooth-c, ৳1,200/kg
// 828004158031 = sunglasses → sunglasses-c, ৳3,500/kg
// 631962844096 = shoes → cat-a, ৳750/kg
// 1009299231859 = smart watch → smart-watch-c, ৳1,200/kg
// 972586101760 = USB heated lash curler → beauty-electronics-b, ৳1,150/kg
// 1038465546819 = PDRN serum spray → liquid-cosmetic-c, ৳1,150/kg

const sun = await getQuote("828004158031", 5, "air");
check("Sunglasses × 5 air: ৳3,500/kg", sun.quote.dutyPerKg === 3500);
check("Sunglasses × 5 air: dutyClass = sunglasses-c", sun.quote.dutyClass === "sunglasses-c");
check(
  "Sunglasses × 5 air: dutyBdt = 0.25 * 3500 = 875",
  sun.quote.dutyBdt === 875,
  `actual: ${sun.quote.dutyBdt}`,
);

const pro6 = await getQuote("873514490218", 2, "air");
check("Pro6 × 2 air: ৳1,200/kg (bluetooth-c)", pro6.quote.dutyPerKg === 1200);
check("Pro6 × 2 air: dutyClass = bluetooth-c", pro6.quote.dutyClass === "bluetooth-c");
check(
  "Pro6 × 2 air: dutyBdt = 0.16 * 1200 = 192",
  pro6.quote.dutyBdt === 192,
  `actual: ${pro6.quote.dutyBdt}`,
);

const shoes = await getQuote("631962844096", 5, "air");
check("Shoes × 5 air: ৳750/kg (cat-a)", shoes.quote.dutyPerKg === 750);
check("Shoes × 5 air: dutyClass = cat-a", shoes.quote.dutyClass === "cat-a");
check(
  "Shoes × 5 air: dutyBdt = 3.00 * 750 = 2250",
  shoes.quote.dutyBdt === 2250,
);

const watch = await getQuote("1009299231859", 2, "air");
check("Smart watch × 2 air: ৳1,200/kg (smart-watch-c)", watch.quote.dutyPerKg === 1200);
check("Smart watch × 2 air: dutyClass = smart-watch-c", watch.quote.dutyClass === "smart-watch-c");

const lash = await getQuote("972586101760", 2, "air");
check("USB lash curler × 2 air: ৳1,150/kg (beauty-electronics-b)", lash.quote.dutyPerKg === 1150);
check("USB lash curler × 2 air: dutyClass = beauty-electronics-b", lash.quote.dutyClass === "beauty-electronics-b");

const serum = await getQuote("1038465546819", 5, "air");
check("PDRN serum × 5 air: ৳1,150/kg (liquid-cosmetic-c)", serum.quote.dutyPerKg === 1150);
check("PDRN serum × 5 air: dutyClass = liquid-cosmetic-c", serum.quote.dutyClass === "liquid-cosmetic-c");

// VAT/AIT formula sanity: vat = round((cif + duty) * 0.15), ait = round(cif * 0.05)
const checkVatAit = async (pid: string, qty: number) => {
  const r = await getQuote(pid, qty, "air");
  const expectedVat = Math.round((r.quote.cifBdt + r.quote.dutyBdt) * 0.15);
  const expectedAit = Math.round(r.quote.cifBdt * 0.05);
  return {
    vatOk: r.quote.vatBdt === expectedVat,
    aitOk: r.quote.aitBdt === expectedAit,
    actualVat: r.quote.vatBdt,
    expectedVat,
    actualAit: r.quote.aitBdt,
    expectedAit,
  };
};
for (const [pid, qty, label] of [
  ["828004158031", 5, "sunglasses"],
  ["873514490218", 2, "Pro6"],
  ["1009299231859", 2, "smart watch"],
] as const) {
  const r = await checkVatAit(pid, qty);
  check(
    `${label}: VAT = round((CIF + duty) * 0.15)`,
    r.vatOk,
    `actual ${r.actualVat} vs expected ${r.expectedVat}`,
  );
  check(
    `${label}: AIT = round(CIF * 0.05)`,
    r.aitOk,
    `actual ${r.actualAit} vs expected ${r.expectedAit}`,
  );
}

// landedCost() pure function (no API) — verify with hand-classified product
const handTest = landedCost(
  {
    source_id: "test-sun",
    title_zh: "",
    title_en: "Sunglasses test",
    title_bn: "",
    category: "eyewear",
    price_min_cny: 13,
    price_max_cny: 13,
    factory_moq: 1,
    price_tiers: [{ qty_min: 1, qty_max: 999999, price_cny_fen: 1300 }],
    weight_kg: 0.05,
    volume_cbm: 0.0005,
    supplier_name: "test",
    supplier_province: "test",
    supplier_city: "test",
    stock_total: 0,
    order_count_30d: 0,
    rating_overall: 0,
    badges: [],
    images: [],
    description_en: "",
    description_bn: "",
    source_url: "",
    markup_pct: 25,
    customs_duty_per_kg: 3500,
    customs_duty_class: "sunglasses-c",
  },
  5,
  "air",
);
check("Hand-rolled sunglasses × 5: per-kg 3500", handTest.dutyPerKg === 3500);
check("Hand-rolled sunglasses × 5: dutyBdt 0.25 × 3500 = 875", handTest.dutyBdt === 875);

// SkyBuy-style two-line regrouping:
//   productBdt  = supplier FOB (BDT) + our markup
//   deliveryBdt = CN first-mile + agent + intl freight + duty + VAT + AIT
//   totalBdt    = productBdt + deliveryBdt (the previous all-in)
check(
  "Hand test: productBdt = FOB × (1 + markup%)",
  handTest.productBdt === Math.round(handTest.cnSubtotalBdt * 1.25),
);
check(
  "Hand test: productBdt excludes shipping (FOB 13*5=65 CNY = 1095 BDT × 1.25 = 1369)",
  handTest.productBdt === 1369,
  `actual ${handTest.productBdt}`,
);
check(
  "Hand test: deliveryBdt = sum of all logistics + duty + tax",
  handTest.deliveryBdt ===
    handTest.cnDomesticBdt +
      handTest.agentBdt +
      handTest.consolBdt +
      handTest.intlBdt +
      handTest.dutyBdt +
      handTest.vatBdt +
      handTest.aitBdt,
);
check(
  "Hand test: totalBdt = productBdt + deliveryBdt (the SkyBuy add-up)",
  handTest.totalBdt === handTest.productBdt + handTest.deliveryBdt,
);
check(
  "Hand test: productBdt < totalBdt (sanity — shipping/duty make up the rest)",
  handTest.productBdt < handTest.totalBdt,
);

// unitProductBdt helper — used by product cards and cross-sell
// (without the in-flight quote, just the per-piece product price
//  including markup, at the LOWEST price tier)
// 5 pieces → tier covers qty 1+ at 13.00 CNY/pc. FX 16.85. 25% markup.
//   = ceil(13 × 16.85 × 1.25) = ceil(273.81) = 274
const sunglassProduct: Parameters<typeof unitProductBdt>[0] = {
  source_id: "test", title_zh: "", title_en: "", title_bn: "",
  category: "eyewear", price_min_cny: 13, price_max_cny: 13,
  factory_moq: 1,
  price_tiers: [{ qty_min: 1, qty_max: 9999, price_cny_fen: 1300 }],
  weight_kg: 0.05, volume_cbm: 0.0005,
  supplier_name: "", supplier_province: "", supplier_city: "",
  stock_total: 0, order_count_30d: 0, rating_overall: 0,
  badges: [], images: [], description_en: "", description_bn: "",
  source_url: "", markup_pct: 25, customs_duty_per_kg: 3500,
  customs_duty_class: "sunglasses-c",
};
check(
  "unitProductBdt at qty 5 = ceil(13 × 16.85 × 1.25) = 274",
  unitProductBdt(sunglassProduct, 5) === 274,
);
check(
  "unitProductBdt at qty 100 (lower tier 11 CNY) = ceil(11 × 16.85 × 1.25) = 232",
  unitProductBdt({ ...sunglassProduct, price_tiers: [
    { qty_min: 1, qty_max: 9, price_cny_fen: 1500 },
    { qty_min: 10, qty_max: 99, price_cny_fen: 1300 },
    { qty_min: 100, qty_max: 9999, price_cny_fen: 1100 },
  ] }, 100) === 232,
);

// SkyBuy-style product-only 70/30 split (used on the PDP headline).
// Pay now 70% / Pay on delivery 30% are computed on `productBdt` only —
// shipping + customs are settled on delivery in Dhaka to the courier.
// The legacy `depositBdt`/`balanceBdt` (70/30 of total) is still kept
// for the formal PDF quote path.
const handProduct: Parameters<typeof landedCost>[0] = {
  source_id: "x", title_zh: "", title_en: "", title_bn: "",
  category: "eyewear", price_min_cny: 13, price_max_cny: 13,
  factory_moq: 1,
  price_tiers: [{ qty_min: 1, qty_max: 9999, price_cny_fen: 1300 }],
  weight_kg: 0.05, volume_cbm: 0.0005,
  supplier_name: "", supplier_province: "", supplier_city: "",
  stock_total: 0, order_count_30d: 0, rating_overall: 0,
  badges: [], images: [], description_en: "", description_bn: "",
  source_url: "", markup_pct: 25, customs_duty_per_kg: 3500,
  customs_duty_class: "sunglasses-c",
};
const hand2 = landedCost(handProduct, 2, "air");
check(
  "Hand test: productDepositBdt = round(productBdt × 0.70)",
  hand2.productDepositBdt === Math.round(hand2.productBdt * 0.7),
);
check(
  "Hand test: productBalanceBdt = productBdt − productDepositBdt",
  hand2.productBalanceBdt === hand2.productBdt - hand2.productDepositBdt,
);
check(
  "Hand test: productDepositBdt + productBalanceBdt == productBdt (no rounding loss)",
  hand2.productDepositBdt + hand2.productBalanceBdt === hand2.productBdt,
);
check(
  "Hand test: productDepositBdt is for PRODUCT only — well under depositBdt (all-in)",
  hand2.productDepositBdt < hand2.depositBdt,
  `productDeposit=৳${hand2.productDepositBdt} vs all-in deposit=৳${hand2.depositBdt}`,
);
check(
  "Hand test: depositBdt + balanceBdt == totalBdt (legacy split still adds up)",
  hand2.depositBdt + hand2.balanceBdt === hand2.totalBdt,
);
check(
  "Hand test: depositPct / balancePct are 0.7 / 0.3 (not changed by split math)",
  hand2.depositPct === 0.7 && hand2.balancePct === 0.3,
);

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
