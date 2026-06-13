// ============================================================================
// Pricing engine — BDT, FX, landed cost
// All money is stored as integer fen (CNY) or integer poisha (BDT) internally
// ============================================================================

// Approximate CNY → BDT rate (locked at "checkout")
// In production: pulled from Bangladesh Bank reference rate, refreshed daily.
export const FX_CNY_BDT = 16.85;

// Air freight volumetric divisor: 1 CBM = 167 kg chargeable (standard IATA).
// Carriers charge MAX(actual_weight, volume_weight).
const AIR_VOLUMETRIC_DIVISOR = 167;

// CN-side domestic shipping rate (¥/kg)
const CN_DOMESTIC_CNY_PER_KG = 8;

// Sourcing agent commission (% of subtotal)
const AGENT_PCT = 0.03;

// Consolidation fee (¥/order) — only charged when the cart has multiple
// items OR multiple suppliers. Single-product quotes skip it.
const CONSOL_CNY = 2000;

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

// Air rate (¥/kg chargeable weight) — corresponds to ~$5/kg at current FX
const AIR_CNY_PER_KG = 35;
// Express premium tier (DHL/UPS-equivalent): ~$10/kg
const EXPRESS_CNY_PER_KG = 70;
// Sea LCL (¥/CBM)
const SEA_CNY_PER_CBM = 2000;

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

/** Chargeable weight in kg — max(actual, volumetric). */
function chargeableWeightKg(actualKg: number, volumeCbm: number): number {
  const volumetric = (volumeCbm * 1000) / AIR_VOLUMETRIC_DIVISOR; // kg
  return Math.max(actualKg, volumetric);
}

/**
 * Air freight (CN → BD). ¥/kg chargeable weight, no artificial minimum.
 * For very small orders (< 0.1 kg chargeable) the absolute cost is
 * tiny (< ¥4), so the per-piece landed cost correctly reflects the
 * real freight. The product card will warn when shipping exceeds
 * 30% of the unit landed cost — that's a sign the buyer needs to
 * order more pieces.
 */
export function airShippingCny(actualKg: number, volumeCbm: number): number {
  const cw = chargeableWeightKg(actualKg, volumeCbm);
  return Math.max(50, Math.round(cw * AIR_CNY_PER_KG));
}

/** Express freight — premium tier (DHL/UPS equivalent). */
export function expressShippingCny(
  actualKg: number,
  volumeCbm: number,
): number {
  const cw = chargeableWeightKg(actualKg, volumeCbm);
  return Math.max(100, Math.round(cw * EXPRESS_CNY_PER_KG));
}

/** Sea LCL freight — based on volume, no minimum. */
export function seaShippingCny(volumeCbm: number): number {
  return Math.max(150, Math.round(volumeCbm * SEA_CNY_PER_CBM));
}

export function intlShippingCny(
  weightKg: number,
  volumeCbm: number,
  mode: ShippingMode,
): number {
  if (mode === "sea") return seaShippingCny(volumeCbm);
  if (mode === "express")
    return expressShippingCny(weightKg, volumeCbm);
  return airShippingCny(weightKg, volumeCbm);
}

export type LandedBreakdown = {
  qty: number;
  mode: ShippingMode;
  fx: number;
  // CNY side
  unitPriceCny: number;
  cnSubtotalCny: number;
  cnSubtotalBdt: number;
  cnDomesticCny: number;
  cnDomesticBdt: number;
  agentCny: number;
  agentBdt: number;
  consolCny: number;
  consolBdt: number;
  intlCny: number;
  intlBdt: number;
  // chargeable weight for transparency
  chargeableKg: number;
  // CIF
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
  tooSmallForAir: boolean; // < 5kg → sea is probably better
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
  // 1. Tier price
  const unitCny = tierPrice(p.price_tiers, qty);
  const cnSubtotalCny = unitCny * qty;
  const cnSubtotalBdt = Math.round(cnSubtotalCny * fx);

  // 2. CN-side costs
  const totalWeight = p.weight_kg * qty;
  const totalVol = p.volume_cbm * qty;
  const cnDomesticCny = Math.round(totalWeight * CN_DOMESTIC_CNY_PER_KG);
  const agentCny = Math.round(cnSubtotalCny * AGENT_PCT);
  // Consolidation fee: ONLY applied when the order has multiple
  // products / suppliers. Single-product quotes skip it. Caller
  // passes `qty` as the number of pieces of ONE product; a future
  // multi-product quote can be added by passing a count param. For
  // now, a single-product cart = no consolidation.
  const consolCny = 0;
  const intlCny = intlShippingCny(totalWeight, totalVol, mode);
  const chargeableKg = chargeableWeightKg(totalWeight, totalVol);

  // 3. CIF (BDT) — total landed cost in Bangladesh before duty
  const cnTotalCny =
    cnSubtotalCny + cnDomesticCny + agentCny + consolCny + intlCny;
  const cifBdt = Math.round(cnTotalCny * fx);

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
      ? Math.round(((intlCny + consolCny) * fx * 100) / totalBdt)
      : 0;
  const tooSmallForAir = mode === "air" && totalWeight < 5 && totalVol < 0.05;

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
    cnDomesticCny,
    cnDomesticBdt: Math.round(cnDomesticCny * fx),
    agentCny,
    agentBdt: Math.round(agentCny * fx),
    consolCny,
    consolBdt: Math.round(consolCny * fx),
    intlCny,
    intlBdt: Math.round(intlCny * fx),
    chargeableKg: Math.round(chargeableKg * 100) / 100,
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
