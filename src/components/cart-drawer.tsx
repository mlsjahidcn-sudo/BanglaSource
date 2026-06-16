"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  useCart,
  cartProductSubtotalBdt,
  cartUnitProductBdt,
  cartTotalWeightKg,
  cartMinWeightMet,
  ORDER_MIN_WEIGHT_KG,
} from "@/lib/cart";
import { useLang } from "@/lib/i18n";
import { fmtBdt, FX_CNY_BDT, effectiveMarkupPct } from "@/lib/pricing";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CartDrawer({ open, onClose }: Props) {
  const { t } = useLang();
  const { items, hydrated, updateQty, remove, count } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus trap: when opened, focus the close button. Esc to close.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Phase 13: the cart-drawer footer now shows the full landed
  // cost (product + shipping + customs + VAT + AIT) via
  // cartTotalLandedBdt(). We keep the productSubtotalBdt helper
  // for the cross-sell suggestions (it computes per-piece prices
  // for the "Add to your order" cards below).
  const productSubtotalBdt = cartProductSubtotalBdt(items);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-slate-900/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("cart.title")}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-[420px] bg-bg shadow-2xl border-l border-border flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <p className="section-eyebrow plain !text-[10.5px] !tracking-[0.1em]">
              {t("cart.title")}
            </p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.01em]">
              {count} {t("cart.items")}
            </h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label={t("cart.close")}
            className="w-9 h-9 rounded-md border border-border hover:bg-slate-50 text-fg-muted transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!hydrated ? (
            <Skeleton />
          ) : items.length === 0 ? (
            <Empty />
          ) : (
            <>
              <ul className="divide-y divide-border">
                {items.map((it) => (
                  <li key={it.productId} className="p-4 flex gap-3">
                    <div className="relative w-20 h-20 rounded-md overflow-hidden bg-slate-50 border border-border shrink-0">
                      <Image
                        src={it.image}
                        alt={it.title_en}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium leading-snug line-clamp-2">
                        {it.title_en}
                      </p>
                      {/*
                        Per-piece price + factory reference are HIDDEN in
                        the cart. The buyer already saw them on the PDP
                        when they added the line — at the cart stage the
                        only number that matters for committing is the
                        LINE TOTAL. The unit price and factory ¥-reference
                        would just create "should I shop around?" noise
                        right before the buyer clicks "Request quote".
                      */}
                      <p className="mt-1 text-[11px] text-fg-subtle font-mono tnum">
                        Qty {it.qty}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center border border-border rounded-md">
                          <button
                            onClick={() =>
                              updateQty(it.productId, it.qty - 1)
                            }
                            className="w-7 h-7 text-fg-muted hover:bg-slate-50"
                            aria-label="Decrease"
                          >
                            −
                          </button>
                          <span className="w-8 h-7 text-center text-[12px] price-tag font-medium flex items-center justify-center">
                            {it.qty}
                          </span>
                          <button
                            onClick={() =>
                              updateQty(it.productId, it.qty + 1)
                            }
                            className="w-7 h-7 text-fg-muted hover:bg-slate-50"
                            aria-label="Increase"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => remove(it.productId)}
                          className="text-[11px] text-fg-subtle hover:text-fg"
                        >
                          {t("cart.remove")}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <CartCrossSell items={items} />
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border p-5 space-y-3 bg-bg-soft">
            {/* Phase 14: the buyer only sees the product subtotal in
                the drawer. The landed cost (shipping + customs + VAT +
                AIT) is NOT shown — per user instruction, our team
                confirms the amount by email or WhatsApp after the
                buyer places the order. The product subtotal is the
                only number the drawer needs to surface; the place
                order button stays. */}
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-fg-muted">
                {t("cart.product_subtotal")} ({items.length} {t("cart.skus")})
              </span>
              <span className="price-tag font-semibold text-[16px]">
                {fmtBdt(productSubtotalBdt)}
              </span>
            </div>
            <p className="text-[10.5px] text-fg-subtle leading-relaxed">
              {t("cart.disclaimer")}
            </p>

            {/* Phase 11: weight progress + min-weight gate. */}
            {(() => {
              const totalWeightKg = cartTotalWeightKg(items);
              const minWeightMet = cartMinWeightMet(items);
              return (
                <div>
                  <div className="flex items-baseline justify-between text-[11.5px]">
                    <span className="text-fg-muted">{t("cart.weight_label")}</span>
                    <span
                      className={
                        minWeightMet
                          ? "text-cyan-700 font-mono tnum font-medium"
                          : "text-fg font-mono tnum"
                      }
                    >
                      {totalWeightKg.toFixed(2)} / {ORDER_MIN_WEIGHT_KG} kg
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-bg overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        minWeightMet ? "bg-emerald-600" : "bg-amber-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (totalWeightKg / ORDER_MIN_WEIGHT_KG) * 100).toFixed(1)}%`,
                      }}
                    />
                  </div>
                  <p
                    className={`mt-1.5 text-[11px] ${
                      minWeightMet ? "text-cyan-700" : "text-fg-muted"
                    }`}
                  >
                    {minWeightMet
                      ? t("cart.weight_progress_met")
                      : t("cart.weight_progress_below", {
                          kg: `${(ORDER_MIN_WEIGHT_KG - totalWeightKg).toFixed(2)} kg`,
                        })}
                  </p>
                </div>
              );
            })()}

            <p className="text-[10.5px] text-fg-subtle leading-relaxed">
              {t("cart.disclaimer")}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                href="/cart"
                onClick={onClose}
                className="h-10 inline-flex items-center justify-center text-[13px] font-medium border border-border rounded-md hover:bg-bg transition-colors"
              >
                {t("cart.view_all")}
              </Link>
              {cartMinWeightMet(items) ? (
                <Link
                  href="/checkout"
                  onClick={onClose}
                  className="h-10 inline-flex items-center justify-center text-[13px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"
                >
                  {t("cart.place_order")}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="h-10 inline-flex items-center justify-center text-[13px] font-medium rounded-md bg-bg-soft text-fg-subtle border border-border cursor-not-allowed"
                >
                  {t("cart.place_order")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Empty() {
  const { t } = useLang();
  return (
    <div className="p-10 text-center">
      <div className="w-12 h-12 mx-auto rounded-full border border-border flex items-center justify-center text-fg-subtle">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.8h8.6a2 2 0 0 0 2-1.6L21 8H6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="20" r="1.4" fill="currentColor" />
          <circle cx="18" cy="20" r="1.4" fill="currentColor" />
        </svg>
      </div>
      <p className="mt-4 text-[14px] font-medium">{t("cart.empty.title")}</p>
      <p className="mt-1 text-[12.5px] text-fg-muted">
        {t("cart.empty.body")}
      </p>
      <Link
        href="/categories"
        className="mt-5 inline-flex h-10 items-center px-4 text-[13px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700"
      >
        {t("cart.empty.cta")}
      </Link>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="p-5 space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-20 h-20 rounded-md bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-100 rounded w-3/4" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
            <div className="h-6 bg-slate-100 rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// /components/cart-drawer.tsx — CartCrossSell
//
// "Add to your order" cross-sell at the bottom of the cart.
// Picks 3 popular products from the same categories already
// in the cart, excluding any item the user already has in
// their order list. Loads on mount, swaps as cart changes.

type CrossItem = {
  source_id: string;
  title_en: string;
  title_bn: string;
  image: string;
  price_cny_fen: number;
  markup_pct: number;
  weight_kg: number;
  volume_cbm: number;
  category: string;
  customs_duty_per_kg: number;
};

function CartCrossSell({
  items,
}: {
  items: ReturnType<typeof useCart>["items"];
}) {
  const [suggestions, setSuggestions] = useState<CrossItem[]>([]);
  // Always call useCart() at the top of the component — never after
  // an early return — to keep hook order stable across renders.
  const { add } = useCart();
  const inCartIds = new Set(items.map((i) => i.productId));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/ai/cart-cross-sell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_ids: items.map((i) => i.productId),
          }),
        });
        if (!r.ok) return;
        const j = (await r.json()) as { items?: CrossItem[] };
        if (!cancelled) setSuggestions(j.items ?? []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const filtered = suggestions.filter((s) => !inCartIds.has(s.source_id));
  if (filtered.length === 0) return null;

  return (
    <div className="border-t border-border p-4 bg-bg-soft/50">
      <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
        Add to your order
      </p>
      <ul className="mt-2 space-y-2">
        {filtered.slice(0, 3).map((s) => (
          <li
            key={s.source_id}
            className="flex items-center gap-2 bg-bg rounded-md p-2 border border-border"
          >
            <div className="relative w-10 h-10 rounded overflow-hidden bg-slate-50 shrink-0">
              {s.image && (
                // The cart drawer is a one-at-a-time interaction
                // so the image is always near the fold. `decoding="async"`
                // lets the browser paint the rest of the drawer
                // before the image finishes decoding (visible speedup
                // for the typical 200-400ms product-image fetch).
                <img
                  src={s.image}
                  alt={s.title_en}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] font-medium leading-tight line-clamp-1">
                {s.title_en}
              </p>
              <p className="text-[10px] text-fg-subtle font-mono tnum">
                {fmtBdt(
                  Math.ceil(
                    (s.price_cny_fen / 100) *
                      FX_CNY_BDT *
                      (1 + (s.markup_pct ?? 25) / 100),
                  ),
                )}{" "}
                / pc
              </p>
            </div>
            <button
              onClick={() =>
                add({
                  productId: s.source_id,
                  title_en: s.title_en,
                  title_bn: s.title_bn,
                  image: s.image,
                  unitPriceCny: s.price_cny_fen,
                  factory_moq: 1,
                  qty: 1,
                  // Phase 11: snapshot the per-product markup at
                  // add-time. effectiveMarkupPct falls back to
                  // the company default (10%) when the
                  // product's markup_pct is missing/0.
                  markup_pct: effectiveMarkupPct(s as any),
                  weight_kg: s.weight_kg ?? 0,
                  volume_cbm: s.volume_cbm ?? 0,
                  category: s.category,
                  customs_duty_per_kg: s.customs_duty_per_kg ?? 0,
                })
              }
              className="text-[10.5px] font-medium text-cyan-600 hover:text-cyan-700 px-2 py-1 rounded hover:bg-cyan-50"
            >
              + Add
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
