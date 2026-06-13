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

// Bangladesh Customs air-cargo specific duties (per-kg rates).
// Source: NBR (National Board of Revenue) HS-code-based specific
// duty schedule for air cargo. The duty is **specific** (per kg of
// imported weight), not ad-valorem (% of CIF).
//
//   Category A — ৳750/kg  (shoes, bags, jewelry, machinery, stickers,
//                            regular electronics, computer accessories,
//                            ceramic, metal, leather, rubber, plastic,
//                            toys excluding battery-operated)
//   Category B — ৳1,150/kg (battery-operated products, duplicate/counterfeit
//                            brand items, seeds, chemicals, networking
//                            equipment, magnet/laser products)
//   Category C — mixed (per product type, see below)
//
//   sunglasses              ৳3,500/kg
//   CCTV camera             ৳1,500/kg
//   battery / power bank    ৳1,350/kg
//   food / kitchen knife    ৳1,200/kg
//   powder                  ৳1,200/kg
//   smart watch             ৳1,200/kg
//   bluetooth headphone     ৳1,200/kg
//   clothing / hijab / orna ৳750/kg
//   liquid cosmetics        ৳1,150/kg
//   regular watch           ৳1,150/kg
//
// Per-product rates are stored in products.customs_duty_per_kg
// (auto-classified from title keywords at insert; admin can override).
// DUTY_BY_CATEGORY is kept as a fallback for products that don't
// have the column set yet (e.g. legacy data before migration 0021).
export const DUTY_BY_CATEGORY: Record<string, number> = {
  // Defaults — used only if products.customs_duty_per_kg is null/0
  // for the row. After backfill, every active product has it set.
  gadgets: 750,
  eyewear: 750,
  shoes: 750,
  bags: 750,
  watches: 1150,
  beauty: 1150,
  jewelry: 750,
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
// The per-kg rate is a *base* — the carrier also charges a "service
// minimum" that scales with the actual weight (a 0.1kg document
// doesn't cost ৳1,348 × 0.1 = ৳135 in real life; it costs about
// ৳1,500-2,000 because the carrier still has to handle it). We
// model this as a weight-aware minimum ladder — the floor for a
// 0.1kg parcel is much lower than the floor for a 1.5kg parcel
// because the carrier work is different.
//
//   0–0.2 kg    min ৳1,500   (document-class small parcel)
//   0.2–0.5 kg  min ৳2,200
//   0.5–1.0 kg  min ৳3,000
//   1.0–2.0 kg  min ৳4,000
//   2.0+ kg     no floor (per-kg rate takes over)
const AIR_TIERS: Array<{ maxKg: number; rateBdtPerKg: number }> = [
  { maxKg: 2, rateBdtPerKg: 1348 },
  { maxKg: 10, rateBdtPerKg: 843 },
  { maxKg: 50, rateBdtPerKg: 590 },
  { maxKg: Infinity, rateBdtPerKg: 421 },
];
const AIR_MIN_LADDER: Array<{ maxKg: number; minBdt: number }> = [
  { maxKg: 0.2, minBdt: 1500 },
  { maxKg: 0.5, minBdt: 2200 },
  { maxKg: 1.0, minBdt: 3000 },
  { maxKg: 2.0, minBdt: 4000 },
];
function airMinBdt(chargeableKg: number): number {
  const tier = AIR_MIN_LADDER.find((t) => chargeableKg <= t.maxKg);
  return tier?.minBdt ?? 0;
}

// Express (DHL/FedEx/UPS-equivalent) — premium tier for 1-5kg parcels.
// Real rates: $17-19/kg for 0-1kg, $11-13/kg for 1-5kg, $8-10/kg for
// 5-20kg, $6-7/kg for 20kg+. Express carriers also have weight-aware
// service minimums (DHL/FedEx bill a base "shipment" fee + per-kg;
// that base fee is higher than air freight's because of the
// premium service).
//
//   ≤0.5 kg   min ৳2,500  (DHL "envelope" tier)
//   ≤1.0 kg   min ৳3,500
//   ≤2.0 kg   min ৳5,000
//   ≤5.0 kg   min ৳6,740
//   >5.0 kg   no floor (per-kg rate takes over)
const EXPRESS_TIERS: Array<{ maxKg: number; rateBdtPerKg: number }> = [
  { maxKg: 1, rateBdtPerKg: 2359 },
  { maxKg: 5, rateBdtPerKg: 1601 },
  { maxKg: 20, rateBdtPerKg: 1180 },
  { maxKg: Infinity, rateBdtPerKg: 927 },
];
const EXPRESS_MIN_LADDER: Array<{ maxKg: number; minBdt: number }> = [
  { maxKg: 0.5, minBdt: 2500 },
  { maxKg: 1.0, minBdt: 3500 },
  { maxKg: 2.0, minBdt: 5000 },
  { maxKg: 5.0, minBdt: 6740 },
];
function expressMinBdt(chargeableKg: number): number {
  const tier = EXPRESS_MIN_LADDER.find((t) => chargeableKg <= t.maxKg);
  return tier?.minBdt ?? 0;
}

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
  // Bangladesh air-cargo specific customs duty in ৳/kg.
  // Auto-classified from title keywords at insert time; admin
  // can override per product. Default: 750 (Category A).
  customs_duty_per_kg?: number;
  customs_duty_class?: string;
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
 *
 * The per-kg rate is the BASE; we also apply a weight-aware
 * minimum that scales with the actual chargeable weight:
 *   ≤0.2 kg  min ৳1,500  (document-class small parcel)
 *   ≤0.5 kg  min ৳2,200
 *   ≤1.0 kg  min ৳3,000
 *   ≤2.0 kg  min ৳4,000
 *   >2.0 kg  no floor (per-kg rate takes over)
 *
 * Returns BDT (the currency the Bangladeshi freight forwarder quotes).
 * The companion `airShippingBreakdown()` returns the computed value,
 * the floor applied, and the effective per-kg rate — so the UI can
 * show the buyer the math: "৳135 (per-kg) + ৳1,500 (small-parcel
 * service fee) = ৳1,635".
 */
export function airShippingBdt(actualKg: number, volumeCbm: number): number {
  const cw = chargeableWeightKg(actualKg, volumeCbm);
  const tier =
    AIR_TIERS.find((t) => cw <= t.maxKg) ?? AIR_TIERS[AIR_TIERS.length - 1];
  const base = Math.round(cw * tier.rateBdtPerKg);
  const min = airMinBdt(cw);
  return Math.max(min, base);
}

/** Detailed air-shipping breakdown for UI display. */
export function airShippingBreakdown(actualKg: number, volumeCbm: number): {
  chargeableKg: number;
  tierMaxKg: number;
  rateBdtPerKg: number;
  perKgAmount: number;
  minBdt: number;
  totalBdt: number;
  floorApplied: boolean;
} {
  const cw = chargeableWeightKg(actualKg, volumeCbm);
  const tier =
    AIR_TIERS.find((t) => cw <= t.maxKg) ?? AIR_TIERS[AIR_TIERS.length - 1];
  const perKg = Math.round(cw * tier.rateBdtPerKg);
  const min = airMinBdt(cw);
  return {
    chargeableKg: cw,
    tierMaxKg: tier.maxKg === Infinity ? 9999 : tier.maxKg,
    rateBdtPerKg: tier.rateBdtPerKg,
    perKgAmount: perKg,
    minBdt: min,
    totalBdt: Math.max(min, perKg),
    floorApplied: perKg < min,
  };
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
    minBdt: airMinBdt(chargeableKg),
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
  const base = Math.round(cw * tier.rateBdtPerKg);
  const min = expressMinBdt(cw);
  return Math.max(min, base);
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
    minBdt: expressMinBdt(chargeableKg),
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
  // Detailed air/express shipping breakdown. Tells the UI:
  //   - perKgAmount: what the per-kg rate alone would have cost
  //   - minBdt:     the carrier service minimum that applies
  //   - totalBdt:   max of the two (the actual billed amount)
  //   - floorApplied: true if minBdt > perKgAmount (the small-
  //     parcel service fee kicked in)
  // The UI uses this to show: "৳135 (per-kg) + ৳1,500 (small-parcel
  // service fee) = ৳1,635" instead of just "৳4,718".
  shippingBreakdown?: {
    perKgAmount: number;
    floorApplied: boolean;
  } | null;
  // CIF (Cost + Insurance + Freight) — total cost in Bangladesh
  // before duty (the basis for duty/VAT calculation)
  cifBdt: number;
  // BD side
  dutyBdt: number;
  // Specific customs duty rate (৳/kg) used for this product.
  // Set from products.customs_duty_per_kg (auto-classified by
  // title) or DUTY_BY_CATEGORY fallback.
  dutyPerKg: number;
  // Human label like "cat-a", "sunglasses-c", "smart-watch-c".
  // Useful for the UI to show "Customs duty: ৳1,200/kg (smart
  // watch class)".
  dutyClass: string;
  vatBdt: number;
  aitBdt: number;
  // Markup
  markupBdt: number;
  markupPct: number;
  // ── Buyer-facing regrouping (SkyBuy model) ──
  // "Product price" = what the buyer pays for the product itself.
  //   = factory FOB (BDT) × (1 + markup%).
  //   This is OUR selling price. It includes our profit margin on
  //   top of the supplier cost.
  productBdt: number;
  // "Shipping & delivery" = everything else the buyer pays to get
  //   the product from the CN factory to their door in Dhaka.
  //   = CN domestic + sourcing agent + consolidation + int'l freight
  //     + customs duty + VAT + AIT.
  //   We roll all of these into a single buyer-facing line because
  //   the buyer doesn't care about our internal cost structure —
  //   they care about "what does it cost to get this to me".
  deliveryBdt: number;
  // Totals
  totalBdt: number;
  unitBdt: number;
  // Lead time estimate
  transitDays: string;
  // Validity
  quoteId: string;
  quotedAt: string;
  expiresAt: string;
  // Payment split (70/30 importer convention).
  // We track TWO splits because the buyer mental model is:
  //   "Product price" → 70% now, 30% on delivery (this is the
  //                       "what you pay for the goods" split)
  //   Shipping + China Courier Charge → 100% on delivery in Dhaka
  // (the carrier and the customs broker both want cash in hand
  // before they release the parcel). This is how skybuybd.com and
  // every other BD import agent actually invoice the buyer.
  // We also keep the OLD `depositBdt`/`balanceBdt` (70/30 of the
  // total landed) for the request-quote / PDF path.
  depositPct: number;
  balancePct: number;
  // Product-only split (used on the PDP headline).
  productDepositBdt: number;
  productBalanceBdt: number;
  // All-in split (used by the quote PDF / formal quote path).
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
  let shippingBreakdown: { perKgAmount: number; floorApplied: boolean } | null = null;
  if (mode === "air") {
    const bd = airShippingBreakdown(totalWeight, totalVol);
    rateTier = {
      tierMaxKg: bd.tierMaxKg,
      rateBdtPerKg: bd.rateBdtPerKg,
      minBdt: bd.minBdt,
    };
    shippingBreakdown = {
      perKgAmount: bd.perKgAmount,
      floorApplied: bd.floorApplied,
    };
  } else if (mode === "express") {
    const cw = chargeableWeightKg(totalWeight, totalVol);
    const perKg = Math.round(
      cw *
        (EXPRESS_TIERS.find((t) => cw <= t.maxKg) ??
          EXPRESS_TIERS[EXPRESS_TIERS.length - 1]).rateBdtPerKg,
    );
    const min = expressMinBdt(cw);
    rateTier = expressRateTier(chargeableKg);
    shippingBreakdown = {
      perKgAmount: perKg,
      floorApplied: perKg < min,
    };
  }

  // 3. CIF (BDT) — total landed cost in Bangladesh before duty
  const cifBdt =
    cnSubtotalBdt + cnDomesticBdt + agentBdt + consolBdt + intlBdt;

  // 4. Bangladesh Customs air-cargo specific duty (৳/kg).
  //    Most HS codes for air cargo are *specific* (per kg of
  //    imported weight) rather than ad-valorem. The rate comes
  //    from the product row (auto-classified by title at insert,
  //    admin-overridable). Falls back to DUTY_BY_CATEGORY for
  //    legacy rows that don't have it set.
  const perKg =
    p.customs_duty_per_kg && p.customs_duty_per_kg > 0
      ? p.customs_duty_per_kg
      : DUTY_BY_CATEGORY[p.category] ?? 750;
  const dutyPct = perKg; // legacy field name kept for API compat;
  // (the UI no longer treats this as a percent — it now displays
  // the absolute ৳/kg rate via the `dutyPerKg` field on the
  // breakdown)
  const dutyBdt = Math.round(totalWeight * perKg);
  // VAT on (CIF + CD); SD is folded into CD above
  const vatBdt = Math.round((cifBdt + dutyBdt) * VAT_PCT);
  const aitBdt = Math.round(cifBdt * AIT_PCT);

  // 5. Our markup (% of CN subtotal BDT)
  const markupPct = p.markup_pct;
  const markupBdt = Math.round(cnSubtotalBdt * (markupPct / 100));

  // 6. Total
  const totalBdt = cifBdt + dutyBdt + vatBdt + aitBdt + markupBdt;
  const unitBdt = Math.ceil(totalBdt / qty);

  // 7. Payment split (70/30 importer convention).
  //    productDepositBdt / productBalanceBdt = 70/30 of productBdt
  //      (shown on the PDP as "Pay now 70%" / "Pay on delivery 30%")
  //    depositBdt / balanceBdt = 70/30 of totalBdt
  //      (shown on the formal PDF quote)
  //    Both splits are inlined directly in the return object so we
  //    don't have to repeat the computation.
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
    shippingBreakdown,
    cifBdt,
    dutyBdt,
    dutyPerKg: perKg,
    dutyClass: p.customs_duty_class ?? (perKg >= 1500 ? "cat-c-high" : perKg >= 1150 ? "cat-b-or-c" : "cat-a"),
    vatBdt,
    aitBdt,
    markupBdt,
    markupPct,
    // Buyer-facing regrouping:
    //   Product price  = supplier FOB (BDT) + our markup
    //   Shipping       = CN first-mile + int'l freight + duty + VAT + AIT
    productBdt: cnSubtotalBdt + markupBdt,
    deliveryBdt:
      cnDomesticBdt + agentBdt + consolBdt + intlBdt + dutyBdt + vatBdt + aitBdt,
    totalBdt,
    unitBdt,
    transitDays: TRANSIT_DAYS[mode],
    quoteId: generateQuoteId(),
    quotedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    depositPct: DEPOSIT_PCT,
    balancePct: BALANCE_PCT,
    productDepositBdt: Math.round((cnSubtotalBdt + markupBdt) * DEPOSIT_PCT),
    productBalanceBdt:
      cnSubtotalBdt +
      markupBdt -
      Math.round((cnSubtotalBdt + markupBdt) * DEPOSIT_PCT),
    depositBdt,
    balanceBdt,
    shippingDominantPct,
    tooSmallForAir,
  };
}

// ── Display formatters ────────────────────────────────────────────────────

/**
 * Human label for the customs duty class slug (used in the buyer
 * disclosure tooltip on the PDP). Truncated to keep the label
 * short — these show up under "Customs ৳/kg".
 */
export function classLabel(slug: string): string {
  const map: Record<string, string> = {
    "cat-a": "Category A (general)",
    "cat-b": "Category B (battery / restricted)",
    "cat-c-high": "Category C (high-specific)",
    "cat-b-or-c": "Category B/C",
    "sunglasses-c": "Sunglasses (high specific)",
    "smart-watch-c": "Smart watch",
    "bluetooth-c": "Bluetooth headphone",
    "regular-watch-c": "Regular watch",
    "liquid-cosmetic-c": "Liquid cosmetics",
    "powder-c": "Powder",
    "beauty-electronics-b": "Battery grooming tool",
    "power-bank-c": "Power bank",
    "cctv-c": "CCTV camera",
  };
  return map[slug] ?? slug;
}

/** Per-piece product price (BDT) at a given qty — used for product
 * cards and "from ৳X" headlines on the PDP.
 *
 *   = (unit factory price in CNY × FX × (1 + markup%)) per piece
 *
 * No shipping, no duty — that's the "Product price" line on the PDP
 * (SkyBuy-style: product price is separate from shipping).
 */
export function unitProductBdt(
  p: Product,
  qty: number,
  fx = FX_CNY_BDT,
): number {
  const unitCny = tierPrice(p.price_tiers, qty);
  const unitBdt = unitCny * fx;
  const markupMul = 1 + (p.markup_pct ?? 25) / 100;
  return Math.ceil(unitBdt * markupMul);
}

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
