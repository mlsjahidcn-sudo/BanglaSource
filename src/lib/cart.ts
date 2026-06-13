"use client";
import { useState, useEffect, useCallback } from "react";
import { FX_CNY_BDT } from "./pricing";

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
  const mul = 1 + (it.markup_pct ?? 25) / 100;
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
