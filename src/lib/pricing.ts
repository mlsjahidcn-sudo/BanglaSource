// ============================================================================
// Pricing engine — BDT, FX, landed cost
// All money is stored as integer poisha (BDT) or integer fen (CNY) internally
// ============================================================================

// Approximate CNY → BDT rate (locked at "checkout")
// In production: pulled from Bangladesh Bank reference rate, refreshed daily.
// FX is only used for the factory FOB price (factories quote in CNY).
// Every other cost line — shipping, agent, markup, duty, VAT, AIT — is
// quoted by Bangladeshi freight forwarders in BDT directly, so we model
// them in BDT.
export const FX_CNY_BDT = 16.85;

// Air freight volumetric divisor: 1 CBM = 167 kg chargeable (standard IATA).
// Carriers charge MAX(actual_weight, volume_weight).
const AIR_VOLUMETRIC_DIVISOR = 167;

// CN-side domestic shipping rate (৳/kg, after FX). Quoted by the
// Guangzhou freight agent to move the goods from factory to airport.
// ~¥8/kg × 16.85 = ৳135/kg. Floor ৳337 for tiny first-mile pickups.
const CN_DOMESTIC_BDT_PER_KG = 135;
const CN_DOMESTIC_MIN_BDT = 337;

// Sourcing agent commission. Real sourcing agents in Yiwu/Guangzhou
// charge 3-5% of FOB + a fixed service fee of ৳500-3,000 per order.
// We model it as 3% of CN subtotal (in BDT) with a ৳506 floor.
const AGENT_PCT = 0.03;
const AGENT_MIN_BDT = 506;

// Consolidation fee (৳/order) — only charged when the cart has multiple
// items OR multiple suppliers. Single-product quotes skip it.
const CONSOL_BDT = 33700; // ~¥2000

// Bangladesh duty stack (FY 2024-25 reference; verify per HS chapter at quote time)
// HS chapter notes:
//   8517 (smartwatches, phones, accessories) → ~10%
//   9101-9102 (wrist watches)                → ~10%
//   9004 (sunglasses, frames)                → ~10%
//   6401-6405 (footwear)                     → ~25%
//   4202 (handbags, luggage)                 → ~25%
//   7117 (imitation jewelry)                 → ~20%
//   3304 (cosmetics, skincare)               → ~20%
export const DUTY_BY_CATEGORY: Record<string, number> = {
  gadgets: 0.10,
  eyewear: 0.10,
  shoes: 0.25,
  bags: 0.25,
  watches: 0.10,
  beauty: 0.20,
  jewelry: 0.20,
};

// Bangladesh supplementary duty is folded into CD for our category buckets above.
// VAT = 15% on (CIF + CD + SD). AIT = 5% on CIF. AT = 4% (we omit, absorbed).
const VAT_PCT = 0.15;
const AIT_PCT = 0.05;

// ─── Freight rates (in BDT, quoted by the Bangladeshi freight forwarder) ───
//
// Air freight China→Bangladesh is tiered: small parcels (1-5kg) cost
// substantially more per kg than bulk air. Real-world quotes from
// Guangzhou→Dhaka via standard air freight agents (Yusen, DHL eCommerce,
// SF Air), converted from $11-12/kg for small parcels down to $3-4/kg
// for 50+ kg bulk:
//
//   0–2 kg   ৳1,348/kg  (small-parcel premium, ~$11-12/kg)
//   2–10 kg  ৳843/kg    (~$7-8/kg)
//   10–50 kg ৳590/kg    (~$5/kg — the historical "bulk" rate)
//   50 kg+   ৳421/kg    (~$3-4/kg — bulk discount)
//
// We model this as a step function: pick the tier for the chargeable kg
// of the whole shipment, then multiply. The floor is the minimum service
// charge any carrier applies, regardless of how small the parcel is.
// ৳4,718 ≈ $40 ≈ realistic minimum for a 1kg parcel Guangzhou→Dhaka.
const AIR_TIERS: Array<{ maxKg: number; rateBdtPerKg: number }> = [
  { maxKg: 2, rateBdtPerKg: 1348 },
  { maxKg: 10, rateBdtPerKg: 843 },
  { maxKg: 50, rateBdtPerKg: 590 },
  { maxKg: Infinity, rateBdtPerKg: 421 },
];
const AIR_MIN_BDT = 4718;

// Express (DHL/FedEx/UPS-equivalent) — premium tier for 1-5kg parcels.
// Real rates: $17-19/kg for 0-1kg, $11-13/kg for 1-5kg, $8-10/kg for
// 5-20kg, $6-7/kg for 20kg+. Min ৳6,740 because express carriers charge
// a base service fee even for 0.5kg documents.
const EXPRESS_TIERS: Array<{ maxKg: number; rateBdtPerKg: number }> = [
  { maxKg: 1, rateBdtPerKg: 2359 },
  { maxKg: 5, rateBdtPerKg: 1601 },
  { maxKg: 20, rateBdtPerKg: 1180 },
  { maxKg: Infinity, rateBdtPerKg: 927 },
];
const EXPRESS_MIN_BDT = 6740;

// Sea LCL (৳/CBM) — based on Guangzhou→Chittagong rates (~$15-17/CBM).
// ৳33,700/CBM ≈ $240/CBM (LCL is priced per-CBM because vessels charge
// by space, not weight). Floor ৳5,055: LCL carriers charge a minimum
// per shipment (often called "CBM minimum") of about 0.15 CBM even if
// the physical volume is less.
const SEA_BDT_PER_CBM = 33700;
const SEA_MIN_BDT = 5055;

// ── Payment split ──────────────────────────────────────────────────────
// Bangladeshi importer convention: 70% deposit on order confirmation,
// 30% balance on delivery (cash on delivery in BDT).
export const DEPOSIT_PCT = 0.70;
export const BALANCE_PCT = 0.30;

export type PriceTier = {
  qty_min: number;
  qty_max: number;
  price_cny_fen: number; // price per piece in CNY fen
};

export type Product = {
  source_id: string;
  title_zh: string;
  title_en: string;
  title_bn: string;
  category: string;
  price_min_cny: number;
  price_max_cny: number;
  factory_moq: number;
  price_tiers: PriceTier[];
  weight_kg: number;
  volume_cbm: number;
  supplier_name: string;
  supplier_province: string;
  supplier_city: string;
  stock_total: number;
  order_count_30d: number;
  rating_overall: number;
  badges: string[];
  images: string[];
  description_en: string;
  description_bn: string;
  source_url: string;
  markup_pct: number;
  quality_score?: number;
};

export type ShippingMode = "air" | "sea" | "express";

/** Find the price-per-piece in CNY yuan (NOT fen) for a given qty. */
export function tierPrice(tiers: PriceTier[], qty: number): number {
  const t = tiers.find((t) => qty >= t.qty_min && qty <= t.qty_max);
  const fen = t?.price_cny_fen ?? tiers[tiers.length - 1].price_cny_fen;
  return fen / 100; // convert fen → yuan
}

/** Chargeable weight in kg — max(actual, volumetric).
 * Public so the UI can show "your 4kg box is being charged for
 * 5.3kg volumetric — pack tighter and save".
 */
export function chargeableWeightKg(actualKg: number, volumeCbm: number): number {
  const volumetric = (volumeCbm * 1000) / AIR_VOLUMETRIC_DIVISOR; // kg
  return Math.max(actualKg, volumetric);
}

/**
 * Air freight (CN → BD), tiered. Real-world rates from Guangzhou
 * to Dhaka via standard air-freight agents:
 *   0–2 kg   ৳1,348/kg (small-parcel premium, $11-12/kg)
 *   2–10 kg  ৳843/kg
 *   10–50 kg ৳590/kg
 *   50 kg+   ৳421/kg
 * with a ৳4,718 minimum service charge (real carriers don't ship
 * a 0.16 kg parcel for less than ~$40). The tier is selected
 * by the *chargeable* weight of the whole shipment.
 *
 * Returns BDT (the currency the Bangladeshi freight forwarder quotes).
 */
export function airShippingBdt(actualKg: number, volumeCbm: number): number {
  const cw = chargeableWeightKg(actualKg, volumeCbm);
  const tier =
    AIR_TIERS.find((t) => cw <= t.maxKg) ?? AIR_TIERS[AIR_TIERS.length - 1];
  return Math.max(AIR_MIN_BDT, Math.round(cw * tier.rateBdtPerKg));
}

/** Which air-rate tier applies for a given chargeable kg (for UI). */
export function airRateTier(chargeableKg: number): {
  tierMaxKg: number;
  rateBdtPerKg: number;
  minBdt: number;
} {
  const tier =
    AIR_TIERS.find((t) => chargeableKg <= t.maxKg) ?? AIR_TIERS[AIR_TIERS.length - 1];
  return {
    tierMaxKg: tier.maxKg === Infinity ? 9999 : tier.maxKg,
    rateBdtPerKg: tier.rateBdtPerKg,
    minBdt: AIR_MIN_BDT,
  };
}

/** Express freight — premium tier (DHL/FedEx/UPS equivalent), tiered.
 * Returns BDT.
 */
export function expressShippingBdt(
  actualKg: number,
  volumeCbm: number,
): number {
  const cw = chargeableWeightKg(actualKg, volumeCbm);
  const tier =
    EXPRESS_TIERS.find((t) => cw <= t.maxKg) ??
    EXPRESS_TIERS[EXPRESS_TIERS.length - 1];
  return Math.max(EXPRESS_MIN_BDT, Math.round(cw * tier.rateBdtPerKg));
}

export function expressRateTier(chargeableKg: number): {
  tierMaxKg: number;
  rateBdtPerKg: number;
  minBdt: number;
} {
  const tier =
    EXPRESS_TIERS.find((t) => chargeableKg <= t.maxKg) ??
    EXPRESS_TIERS[EXPRESS_TIERS.length - 1];
  return {
    tierMaxKg: tier.maxKg === Infinity ? 9999 : tier.maxKg,
    rateBdtPerKg: tier.rateBdtPerKg,
    minBdt: EXPRESS_MIN_BDT,
  };
}

/** Sea LCL freight — based on volume. ৳33,700/CBM with ৳5,055 minimum.
 * Returns BDT.
 */
export function seaShippingBdt(volumeCbm: number): number {
  return Math.max(SEA_MIN_BDT, Math.round(volumeCbm * SEA_BDT_PER_CBM));
}

export function intlShippingBdt(
  weightKg: number,
  volumeCbm: number,
  mode: ShippingMode,
): number {
  if (mode === "sea") return seaShippingBdt(volumeCbm);
  if (mode === "express") {
    return expressShippingBdt(weightKg, volumeCbm);
  }
  return airShippingBdt(weightKg, volumeCbm);
}

export type LandedBreakdown = {
  qty: number;
  mode: ShippingMode;
  fx: number;
  // CNY side (factory FOB) — converted to BDT via `fx`
  unitPriceCny: number;
  cnSubtotalCny: number;
  cnSubtotalBdt: number;
  // BD-side service costs (all in BDT, quoted by the freight
  // forwarder / agent — no further FX conversion needed)
  cnDomesticBdt: number;
  agentBdt: number;
  consolBdt: number;
  intlBdt: number;
  // chargeable weight for transparency
  chargeableKg: number;
  // Volumetric weight (CBM → kg) shown alongside actual weight so
  // the UI can explain "we charged you for 8kg volumetric, your
  // actual is 4kg — pack tighter and save ৳X".
  volumetricKg: number;
  // Air/express rate tier used (for the small-parcel premium
  // explanation). Null for sea.
  rateTier?: {
    tierMaxKg: number;
    rateBdtPerKg: number;
    minBdt: number;
  } | null;
  // CIF (Cost + Insurance + Freight) — total cost in Bangladesh
  // before duty (the basis for duty/VAT calculation)
  cifBdt: number;
  // BD side
  dutyBdt: number;
  dutyPct: number;
  vatBdt: number;
  aitBdt: number;
  // Markup
  markupBdt: number;
  markupPct: number;
  // Totals
  totalBdt: number;
  unitBdt: number;
  // Lead time estimate
  transitDays: string;
  // Validity
  quoteId: string;
  quotedAt: string;
  expiresAt: string;
  // Payment split (70/30 importer convention)
  depositPct: number;
  balancePct: number;
  depositBdt: number;
  balanceBdt: number;
  // Diagnostic flags (UI shows warnings when truthy)
  shippingDominantPct: number; // intl+consol as % of total
  tooSmallForAir: boolean; // < 2kg + in the small-parcel premium tier
};

/**
 * Generate a quote ID. Format: Q-YYYYMMDD-XXXXX (base36, 5 chars).
 * In production, use a real sequence (Postgres SERIAL/UUID).
 */
export function generateQuoteId(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `Q-${ymd}-${rand}`;
}

const TRANSIT_DAYS: Record<ShippingMode, string> = {
  air: "5–9 days",
  express: "3–5 days",
  sea: "30–45 days",
};

/**
 * Full landed-cost calculation. Result in BDT.
 * All numbers are integer taka (we round once at the end).
 */
export function landedCost(
  p: Product,
  qty: number,
  mode: ShippingMode = "air",
  fx = FX_CNY_BDT,
): LandedBreakdown {
  // 1. Factory FOB (in CNY, converted to BDT)
  const unitCny = tierPrice(p.price_tiers, qty);
  const cnSubtotalCny = unitCny * qty;
  const cnSubtotalBdt = Math.round(cnSubtotalCny * fx);

  // 2. Service costs — all in BDT, quoted by the Bangladeshi
  //    freight forwarder / agent. No FX conversion needed.
  const totalWeight = p.weight_kg * qty;
  const totalVol = p.volume_cbm * qty;
  // First-mile pickup (CN domestic trucking, paid to CN agent
  // but quoted in BDT to the buyer as part of the bundled service)
  const cnDomesticBdt = Math.max(
    CN_DOMESTIC_MIN_BDT,
    Math.round(totalWeight * CN_DOMESTIC_BDT_PER_KG),
  );
  // Sourcing agent fee: 3% of factory FOB (in BDT), ৳506 minimum
  const agentBdt = Math.max(
    AGENT_MIN_BDT,
    Math.round(cnSubtotalBdt * AGENT_PCT),
  );
  // Consolidation fee: ONLY applied when the order has multiple
  // products / suppliers. Single-product quotes skip it. Caller
  // passes `qty` as the number of pieces of ONE product; a future
  // multi-product quote can be added by passing a count param. For
  // now, a single-product cart = no consolidation.
  const consolBdt = 0;
  // Int'l freight (air/express/sea) — already in BDT
  const intlBdt = intlShippingBdt(totalWeight, totalVol, mode);
  const chargeableKg = chargeableWeightKg(totalWeight, totalVol);
  const volumetricKg = (totalVol * 1000) / AIR_VOLUMETRIC_DIVISOR;
  // Rate tier used for the chosen mode (so the UI can show
  // "small-parcel premium — air at ৳1,348/kg tier" for tiny orders)
  let rateTier: ReturnType<typeof airRateTier> | null = null;
  if (mode === "air") rateTier = airRateTier(chargeableKg);
  else if (mode === "express") rateTier = expressRateTier(chargeableKg);

  // 3. CIF (BDT) — total landed cost in Bangladesh before duty
  const cifBdt =
    cnSubtotalBdt + cnDomesticBdt + agentBdt + consolBdt + intlBdt;

  // 4. Bangladesh duty stack
  const dutyPct = DUTY_BY_CATEGORY[p.category] ?? 0.15;
  const dutyBdt = Math.round(cifBdt * dutyPct);
  // VAT on (CIF + CD); SD is folded into CD above
  const vatBdt = Math.round((cifBdt + dutyBdt) * VAT_PCT);
  const aitBdt = Math.round(cifBdt * AIT_PCT);

  // 5. Our markup (% of CN subtotal BDT)
  const markupPct = p.markup_pct;
  const markupBdt = Math.round(cnSubtotalBdt * (markupPct / 100));

  // 6. Total
  const totalBdt = cifBdt + dutyBdt + vatBdt + aitBdt + markupBdt;
  const unitBdt = Math.ceil(totalBdt / qty);

  // 7. Payment split (70/30 importer convention)
  const depositBdt = Math.round(totalBdt * DEPOSIT_PCT);
  const balanceBdt = totalBdt - depositBdt;

  // 8. Diagnostics
  const shippingDominantPct =
    totalBdt > 0
      ? Math.round(((intlBdt + consolBdt) * 100) / totalBdt)
      : 0;
  // "Too small for air" fires when actual weight under 2kg AND
  // the air-freight small-parcel premium tier is in effect
  // (৳1,348/kg = the highest air tier). That's the signal to
  // consolidate with sea or order more pieces.
  const tooSmallForAir =
    mode === "air" && totalWeight < 2 && rateTier?.rateBdtPerKg === 1348;

  // 9. Quote envelope
  const now = new Date();
  const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7); // 7 days

  return {
    qty,
    mode,
    fx,
    unitPriceCny: unitCny,
    cnSubtotalCny,
    cnSubtotalBdt,
    cnDomesticBdt,
    agentBdt,
    consolBdt,
    intlBdt,
    chargeableKg: Math.round(chargeableKg * 100) / 100,
    volumetricKg: Math.round(volumetricKg * 100) / 100,
    rateTier,
    cifBdt,
    dutyBdt,
    dutyPct,
    vatBdt,
    aitBdt,
    markupBdt,
    markupPct,
    totalBdt,
    unitBdt,
    transitDays: TRANSIT_DAYS[mode],
    quoteId: generateQuoteId(),
    quotedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    depositPct: DEPOSIT_PCT,
    balancePct: BALANCE_PCT,
    depositBdt,
    balanceBdt,
    shippingDominantPct,
    tooSmallForAir,
  };
}

// ── Display formatters ────────────────────────────────────────────────────

/** Display formatter — BDT with the ৳ symbol, no decimals. */
export function fmtBdt(n: number): string {
  return "৳" + Math.round(n).toLocaleString("en-IN");
}

/** Display formatter — CNY with ¥ symbol, two decimals. */
export function fmtCny(fen: number): string {
  return "¥" + (fen / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Display formatter — kg with 2 decimals. */
export function fmtKg(kg: number): string {
  if (kg < 1) return `${Math.round(kg * 1000)} g`;
  return `${kg.toFixed(2)} kg`;
}

/** Display formatter — CBM with 4 decimals. */
export function fmtCbm(cbm: number): string {
  if (cbm < 0.001) return `${Math.round(cbm * 1_000_000)} cc`;
  return `${cbm.toFixed(4)} m³`;
}

/** Display formatter — pct, e.g. 0.15 → "15%". */
export function fmtPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}
