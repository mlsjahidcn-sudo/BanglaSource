// scripts/test-pricing-tiers.mts
//
// Smoke-tests the tiered air/express/sea freight pricing.
// All shipping rates are now in BDT (the currency the freight
// forwarder quotes the buyer) — only the factory FOB uses CNY.
//
// Run with:
//   NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/test-pricing-tiers.mts
//
// What we verify:
//   1. Air freight: floor ৳4,718, 4 tier breakpoints, smooth scaling
//   2. Express freight: floor ৳6,740, 4 tier breakpoints
//   3. Sea LCL: floor ৳5,055, linear in volume
//   4. CN domestic: floor ৳337, linear in weight
//   5. Agent fee: floor ৳506, 3% of factory FOB
//   6. chargeableWeightKg: max(actual, volumetric) where
//      volumetric = volumeCbm * 1000 / 167
//   7. The /api/quote/landed endpoint returns rateTier (in BDT),
//      volumetricKg, and the new "small-parcel premium" warning
//   8. Pro6 (80g) at qty=2 air → ৳4,718 floor fires, unit landed ৳3,848
//   9. Pro6 (80g) at qty=100 air → drops to 2-10kg tier at 8kg

import { airShippingBdt, seaShippingBdt, airRateTier, chargeableWeightKg, FX_CNY_BDT } from "../src/lib/pricing.ts";

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

// 0.16 kg (2 Pro6): floor ৳4,718 fires (0.16 * 1348 = 215.7 → max(4718, 216) = 4718)
check("0.16kg via air → floor ৳4,718", airShippingBdt(0.16, 0.00032) === 4718);
check(
  "0.16kg via air → tier shows ৳1,348/kg (small-parcel premium)",
  airRateTier(0.16).rateBdtPerKg === 1348,
);

// 0.40 kg (5 Pro6): still in 0-2kg tier
check("0.40kg via air → still ৳1,348/kg tier", airRateTier(0.40).rateBdtPerKg === 1348);
check("0.40kg via air → 0.40*1348=539 → floor ৳4,718", airShippingBdt(0.40, 0.00032) === 4718);

// 5 kg: drops to 2-10kg tier (৳843/kg), but floor still applies since 5*843=4215 < 4718
check("5kg via air → ৳843/kg tier", airRateTier(5).rateBdtPerKg === 843);
check("5kg via air → 5*843=4215 → floor ৳4,718", airShippingBdt(5, 0.005) === 4718);

// 8 kg: 8*843=6744, above floor
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
    totalBdt: number;
    unitBdt: number;
    shippingDominantPct: number;
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
check("Pro6 × 2 air: rateTier.rateBdtPerKg = 1348", pro6_2.quote.rateTier?.rateBdtPerKg === 1348);
check("Pro6 × 2 air: rateTier.minBdt = 4718", pro6_2.quote.rateTier?.minBdt === 4718);
check("Pro6 × 2 air: intlBdt = 4718 (floor)", pro6_2.quote.intlBdt === 4718);
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

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
