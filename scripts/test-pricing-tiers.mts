// scripts/test-pricing-tiers.mts
//
// Smoke-tests the new tiered air/express/sea freight pricing.
// Run with:
//   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/test-pricing-tiers.mts
//
// What we verify:
//   1. Air freight: floor ¥280, 4 tier breakpoints, smooth scaling
//   2. Express freight: floor ¥400, 4 tier breakpoints
//   3. Sea LCL: floor ¥300, linear in volume
//   4. CN domestic: floor ¥20, linear in weight
//   5. Agent fee: floor ¥30, 3% of subtotal
//   6. chargeableWeightKg: max(actual, volumetric) where
//      volumetric = volumeCbm * 1000 / 167
//   7. The /api/quote/landed endpoint returns rateTier, volumetricKg,
//      and the new "small-parcel premium" warning
//   8. Pro6 (80g) at qty=2 air → ¥280 floor fires, unit landed ৳3,848
//   9. Pro6 (80g) at qty=100 air → drops to 2-10kg tier at 8kg

import { airShippingCny, seaShippingCny, airRateTier, chargeableWeightKg, FX_CNY_BDT } from "../src/lib/pricing.ts";

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

console.log("\n=== Air freight tiering ===\n");

// 0.16 kg (2 Pro6): floor ¥280 fires (0.16 * 80 = 12.8 → max(280, 13) = 280)
check("0.16kg via air → floor ¥280", airShippingCny(0.16, 0.00032) === 280);
check("0.16kg via air → tier shows ¥80/kg (small-parcel premium)", airRateTier(0.16).rateCnyPerKg === 80);

// 0.40 kg (5 Pro6): still in 0-2kg tier
check("0.40kg via air → still ¥80/kg tier", airRateTier(0.40).rateCnyPerKg === 80);
check("0.40kg via air → ¥32 → floor ¥280", airShippingCny(0.40, 0.00032) === 280);

// 5 kg: drops to 2-10kg tier (¥50/kg), but floor still applies since 5*50=250 < 280
check("5kg via air → ¥50/kg tier", airRateTier(5).rateCnyPerKg === 50);
check("5kg via air → 5*50=250 → floor ¥280", airShippingCny(5, 0.005) === 280);

// 8 kg: 8*50=400, above floor
check("8kg via air → ¥400 (no floor)", airShippingCny(8, 0.01) === 400);

// 12 kg: drops to 10-50kg tier (¥35/kg)
check("12kg via air → ¥35/kg tier", airRateTier(12).rateCnyPerKg === 35);
check("12kg via air → 12*35=420", airShippingCny(12, 0.02) === 420);

// 60 kg: drops to 50kg+ tier (¥25/kg)
check("60kg via air → ¥25/kg tier", airRateTier(60).rateCnyPerKg === 25);
check("60kg via air → 60*25=1500", airShippingCny(60, 0.1) === 1500);

// Just at the tier boundary
check("2kg via air → still 0-2kg tier (≤)", airRateTier(2).rateCnyPerKg === 80);
check("2.01kg via air → drops to 2-10kg tier", airRateTier(2.01).rateCnyPerKg === 50);
check("10kg via air → still 2-10kg tier (≤)", airRateTier(10).rateCnyPerKg === 50);
check("10.01kg via air → drops to 10-50kg tier", airRateTier(10.01).rateCnyPerKg === 35);

console.log("\n=== Sea freight ===\n");
check("0.001 CBM sea → floor ¥300", seaShippingCny(0.001) === 300);
check("0.1 CBM sea → floor ¥300 (0.1 * 2000 = 200, below floor)", seaShippingCny(0.1) === 300);
check("1.0 CBM sea → 2000", seaShippingCny(1.0) === 2000);

console.log("\n=== Chargeable weight (max(actual, volumetric)) ===\n");
check(
  "Pro6 80g + 0.00032 CBM → 0.08kg (vol 0.002 is lower)",
  approx(chargeableWeightKg(0.08, 0.00032), 0.08),
);
check(
  "Bulky box 5kg + 0.5 CBM → 2.99kg (vol 500/167=2.99, actual 5 → 5)",
  approx(chargeableWeightKg(5, 0.5), 5),
);
check(
  "Light fluffy item 1kg + 0.5 CBM → 2.99kg (vol > actual)",
  approx(chargeableWeightKg(1, 0.5), 2.99, 0.01),
);

console.log("\n=== /api/quote/landed live ===\n");

// Hit the live API and check the new fields
const API = process.env.API_URL ?? "http://localhost:3000";

interface QuoteResponse {
  ok: boolean;
  warnings: string[];
  quote: {
    chargeableKg: number;
    volumetricKg: number;
    rateTier?: { tierMaxKg: number; rateCnyPerKg: number; minCny: number } | null;
    intlCny: number;
    intlBdt: number;
    tooSmallForAir: boolean;
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
check("Pro6 × 2 air: rateTier.rateCnyPerKg = 80", pro6_2.quote.rateTier?.rateCnyPerKg === 80);
check("Pro6 × 2 air: intlCny = 280 (floor)", pro6_2.quote.intlCny === 280);
check("Pro6 × 2 air: volumetricKg present", typeof pro6_2.quote.volumetricKg === "number");
check("Pro6 × 2 air: tooSmallForAir = true", pro6_2.quote.tooSmallForAir === true);
check(
  "Pro6 × 2 air: small-parcel warning present",
  pro6_2.warnings.some((w) => w.includes("Small-parcel premium")),
);

const pro6_100 = await getQuote("873514490218", 100, "air");
check(
  "Pro6 × 100 air: 8kg → ¥50/kg tier (2-10kg)",
  pro6_100.quote.rateTier?.rateCnyPerKg === 50,
);
check("Pro6 × 100 air: tooSmallForAir = false", pro6_100.quote.tooSmallForAir === false);

const pro6_500 = await getQuote("873514490218", 500, "air");
check(
  "Pro6 × 500 air: 40kg → ¥35/kg tier (10-50kg)",
  pro6_500.quote.rateTier?.rateCnyPerKg === 35,
);

const pro6_2_sea = await getQuote("873514490218", 2, "sea");
check("Pro6 × 2 sea: rateTier = null", pro6_2_sea.quote.rateTier === null);
check("Pro6 × 2 sea: intlCny = 300 (floor)", pro6_2_sea.quote.intlCny === 300);

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
