"use client";
import { useState, useEffect, useCallback } from "react";
import {
  FX_CNY_BDT,
  DEFAULT_BUYER_MARKUP_PCT,
  ORDER_MIN_WEIGHT_KG,
  orderMinWeightMet,
  airShippingBreakdown,
  seaShippingBdt,
  SIDE_SERVICE_RATES_PUBLIC,
  type ShippingMode,
} from "./pricing";

export type CartItem = {
  productId: string;
  title_en: string;
  title_bn: string;
  image: string;
  unitPriceCny: number; // fen (locked when added)
  factory_moq: number;
  qty: number;
  // Locked at add time so the cart subtotal matches what the buyer
  // saw on the PDP (SkyBuy model: "Product price" includes our
  // markup on top of the factory FOB). Without this, a markup
  // change in admin would silently re-price the cart.
  markup_pct: number;
  weight_kg: number;
  volume_cbm: number;
  category: string;
  customs_duty_per_kg: number;
  addedAt: number;
};

const STORAGE_KEY = "banglasource.cart.v1";

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  // Notify same-tab subscribers (storage event is cross-tab only)
  window.dispatchEvent(new CustomEvent("cart:update"));
}

let listeners: Array<() => void> = [];

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readCart());
    setHydrated(true);

    const onUpdate = () => setItems(readCart());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) onUpdate();
    };
    window.addEventListener("cart:update", onUpdate);
    window.addEventListener("storage", onStorage);
    listeners.push(onUpdate);

    return () => {
      window.removeEventListener("cart:update", onUpdate);
      window.removeEventListener("storage", onStorage);
      listeners = listeners.filter((l) => l !== onUpdate);
    };
  }, []);

  const add = useCallback(
    (item: Omit<CartItem, "addedAt">) => {
      const current = readCart();
      const existing = current.find((c) => c.productId === item.productId);
      let next: CartItem[];
      if (existing) {
        // merge: bump qty, lock the lower price
        next = current.map((c) =>
          c.productId === item.productId
            ? {
                ...c,
                qty: c.qty + item.qty,
                unitPriceCny: Math.min(c.unitPriceCny, item.unitPriceCny),
              }
            : c,
        );
      } else {
        next = [...current, { ...item, addedAt: Date.now() }];
      }
      writeCart(next);
    },
    [],
  );

  const remove = useCallback((productId: string) => {
    const next = readCart().filter((c) => c.productId !== productId);
    writeCart(next);
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    const next = readCart()
      .map((c) => (c.productId === productId ? { ...c, qty } : c))
      .filter((c) => c.qty > 0);
    writeCart(next);
  }, []);

  const clear = useCallback(() => writeCart([]), []);
  const count = items.reduce((sum, c) => sum + c.qty, 0);

  return { items, hydrated, count, add, remove, updateQty, clear };
}

/**
 * Per-piece product price in BDT for a cart line — includes our
 * markup on top of the factory FOB. Mirrors `unitProductBdt()` in
 * pricing.ts but operates on the locked cart snapshot (so an admin
 * markup change can't re-price an in-flight cart).
 *
 *   unitProductBdt = round((unitPriceCny_fen / 100) × FX × (1 + markup/100))
 */
export function cartUnitProductBdt(it: CartItem, fx = FX_CNY_BDT): number {
  const unitBdt = (it.unitPriceCny / 100) * fx;
  // Phase 11: the per-cart-item markup_pct is what the buyer
  // saw on the PDP at add-time. We honour that locked value
  // even if the admin later changes the product. Falls back
  // to the company default if the locked value is missing or 0.
  const markupPct = it.markup_pct && it.markup_pct > 0
    ? it.markup_pct
    : DEFAULT_BUYER_MARKUP_PCT;
  const mul = 1 + markupPct / 100;
  return Math.ceil(unitBdt * mul);
}

/** Line subtotal in BDT (product price × qty). */
export function cartLineProductBdt(it: CartItem, fx = FX_CNY_BDT): number {
  return cartUnitProductBdt(it, fx) * it.qty;
}

/** Cart product-price subtotal in BDT (across all lines). */
export function cartProductSubtotalBdt(items: CartItem[], fx = FX_CNY_BDT): number {
  return items.reduce((s, it) => s + cartLineProductBdt(it, fx), 0);
}

/**
 * Total chargeable weight of the cart, in kg.
 *
 * Sum of (item weight × qty) across all lines. This is the number
 * the cart drawer and /cart page show in the "X.X / 5 kg"
 * progress bar, and the value the server validates against
 * ORDER_MIN_WEIGHT_KG at order placement.
 */
export function cartTotalWeightKg(items: CartItem[]): number {
  return items.reduce((s, it) => s + it.weight_kg * it.qty, 0);
}

/**
 * Convenience: is the cart's total weight above the minimum
 * for order placement?
 */
export function cartMinWeightMet(items: CartItem[]): boolean {
  return orderMinWeightMet(cartTotalWeightKg(items));
}

/**
 * Re-export the policy constants so cart consumers don't have to
 * import from both files. The cart-drawer / cart-page use these
 * for the progress bar and the "Place order" disable state.
 */
export { ORDER_MIN_WEIGHT_KG, DEFAULT_BUYER_MARKUP_PCT };

/**
 * Per-line landed cost breakdown for a single cart item, using
 * the same math as `landedCost` in `src/lib/pricing.ts` but
 * operating on the locked cart snapshot (no `price_tiers`; the
 * unit FOB was frozen at add time).
 *
 * Phase 13 (full-prepayment model): the cart surfaces the full
 * landed cost (product + shipping + customs + VAT + AIT) on the
 * drawer and the /cart page so the buyer sees what they'll pay
 * before they place the order. The 70/30 split is gone.
 *
 * Returned shape mirrors `LandedBreakdown` from pricing.ts:
 *   - productBdt: FOB×FX + markup (the "Product price" line)
 *   - intlBdt, cnDomesticBdt, agentBdt, consolBdt: shipping stack
 *   - dutyBdt: customs duty (৳/kg × weight)
 *   - vatBdt, aitBdt: 15% / 5%
 *   - markupBdt: per-product markup
 *   - totalBdt: sum of everything (the amount the buyer pays)
 */
export type CartLandedBreakdown = {
  productBdt: number;
  intlBdt: number;
  cnDomesticBdt: number;
  agentBdt: number;
  consolBdt: number;
  dutyBdt: number;
  vatBdt: number;
  aitBdt: number;
  markupBdt: number;
  totalBdt: number;
  // Diagnostic fields the UI uses to render the breakdown rows
  weightKg: number;
  volumeCbm: number;
  dutyPerKg: number;
};

export function cartLineLandedCost(
  it: CartItem,
  mode: ShippingMode = "air",
  fx = FX_CNY_BDT,
): CartLandedBreakdown {
  const markupPct =
    it.markup_pct && it.markup_pct > 0
      ? it.markup_pct
      : DEFAULT_BUYER_MARKUP_PCT;
  const unitCny = it.unitPriceCny / 100; // fen → CNY
  const cnSubtotalCny = unitCny * it.qty;
  const cnSubtotalBdt = cnSubtotalCny * fx;
  const markupBdt = cnSubtotalBdt * (markupPct / 100);
  const productBdt = cnSubtotalBdt + markupBdt;

  const totalWeight = it.weight_kg * it.qty;
  const totalVol = it.volume_cbm * it.qty;
  // CN first-mile (135/kg, min 337)
  const cnDomesticBdt = Math.max(
    SIDE_SERVICE_RATES_PUBLIC.cnDomestic.minBdt,
    Math.round(totalWeight * SIDE_SERVICE_RATES_PUBLIC.cnDomestic.bdtPerKg),
  );
  // Sourcing agent (3% of FOB BDT, min 506)
  const agentBdt = Math.max(
    SIDE_SERVICE_RATES_PUBLIC.agent.minBdt,
    Math.round(cnSubtotalBdt * SIDE_SERVICE_RATES_PUBLIC.agent.pct),
  );
  // Consolidation: 0 for a single-line cart line; the /cart page
  // adds the per-order ৳33,700/CBM fee when the order has
  // multiple distinct SKUs (consol applies to the whole shipment,
  // not per line).
  const consolBdt = 0;
  // Int'l freight — same helpers as the server uses
  const intlBdt = mode === "sea"
    ? seaShippingBdt(totalVol)
    : airShippingBreakdown(totalWeight, totalVol).totalBdt;
  // Customs duty: per-kg specific, locked at add time
  const dutyPerKg = it.customs_duty_per_kg && it.customs_duty_per_kg > 0
    ? it.customs_duty_per_kg
    : 750; // Cat A fallback (the server does the same)
  const dutyBdt = Math.round(totalWeight * dutyPerKg);
  // CIF: FOB+markup + shipping stack
  const cifBdt = cnSubtotalBdt + cnDomesticBdt + agentBdt + consolBdt + intlBdt;
  const vatBdt = Math.round((cifBdt + dutyBdt) * 0.15);
  const aitBdt = Math.round(cifBdt * 0.05);
  const totalBdt = cifBdt + dutyBdt + vatBdt + aitBdt + markupBdt;

  return {
    productBdt: Math.round(productBdt),
    intlBdt: Math.round(intlBdt),
    cnDomesticBdt,
    agentBdt,
    consolBdt,
    dutyBdt,
    vatBdt,
    aitBdt,
    markupBdt: Math.round(markupBdt),
    totalBdt: Math.round(totalBdt),
    weightKg: totalWeight,
    volumeCbm: totalVol,
    dutyPerKg,
  };
}

/**
 * Cart-wide landed total in BDT, summed across all lines, with
 * the per-order consolidation fee applied when there are 2+
 * distinct SKUs (matching the server's behaviour). Uses air
 * freight by default; the /cart page lets the buyer toggle to
 * sea and recomputes via this helper.
 */
export function cartTotalLandedBdt(
  items: CartItem[],
  mode: ShippingMode = "air",
  fx = FX_CNY_BDT,
): {
  productBdt: number;
  intlBdt: number;
  cnDomesticBdt: number;
  agentBdt: number;
  consolBdt: number;
  dutyBdt: number;
  vatBdt: number;
  aitBdt: number;
  totalBdt: number;
  weightKg: number;
  volumeCbm: number;
} {
  let productBdt = 0,
    intlBdt = 0,
    cnDomesticBdt = 0,
    agentBdt = 0,
    dutyBdt = 0,
    weightKg = 0,
    volumeCbm = 0;
  for (const it of items) {
    const b = cartLineLandedCost(it, mode, fx);
    productBdt += b.productBdt;
    intlBdt += b.intlBdt;
    cnDomesticBdt += b.cnDomesticBdt;
    agentBdt += b.agentBdt;
    dutyBdt += b.dutyBdt;
    weightKg += b.weightKg;
    volumeCbm += b.volumeCbm;
  }
  // Per-order consolidation: only for multi-SKU carts in air/sea
  // mode. Single SKU = no consolidation (matches server).
  const consolBdt =
    items.length > 1
      ? mode === "sea"
        ? Math.round(seaShippingBdt(volumeCbm)) // sea consol = ৳33,700/CBM × volume
        : 0
      : 0;
  const cifBdt = productBdt + cnDomesticBdt + agentBdt + consolBdt + intlBdt;
  const vatBdt = Math.round((cifBdt + dutyBdt) * 0.15);
  const aitBdt = Math.round(cifBdt * 0.05);
  const totalBdt = cifBdt + dutyBdt + vatBdt + aitBdt;
  return {
    productBdt: Math.round(productBdt),
    intlBdt: Math.round(intlBdt),
    cnDomesticBdt,
    agentBdt,
    consolBdt,
    dutyBdt,
    vatBdt,
    aitBdt,
    totalBdt: Math.round(totalBdt),
    weightKg,
    volumeCbm,
  };
}
