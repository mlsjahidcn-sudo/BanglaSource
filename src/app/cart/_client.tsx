"use client";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { useLang } from "@/lib/i18n";
import { useCart, cartUnitProductBdt, cartProductSubtotalBdt, cartTotalWeightKg, cartMinWeightMet, ORDER_MIN_WEIGHT_KG } from "@/lib/cart";
import { fmtBdt, FX_CNY_BDT } from "@/lib/pricing";
import { useState, useEffect } from "react";
import { useCatalog } from "@/lib/use-catalog";
import { type ShippingMode, type LandedBreakdown } from "@/lib/pricing";
import { getBrowserClient } from "@/lib/supabase/browser";

export function CartClient() {
  const { t, lang } = useLang();
  const { items, hydrated, updateQty, remove, count } = useCart();
  const { products: allProducts } = useCatalog();
  const [mode, setMode] = useState<ShippingMode>("air");
  const [quote, setQuote] = useState<LandedBreakdown | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setSignedInEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setSignedInEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Build an effective "super-product" for landed-cost calc
  // (we sum weight/volume across all cart items)
  const enriched = items.map((it) => {
    const product = allProducts.find((p) => p.source_id === it.productId);
    return { item: it, product };
  });

  // Product subtotal (BDT) — includes our markup. Shipping is added
  // when the buyer picks a mode + clicks "Request quote".
  const productSubtotalBdt = cartProductSubtotalBdt(items);
  // Phase 11: total cart weight (kg) for the progress bar + the
  // min-weight gate. Computed from each item's locked weight × qty.
  const totalWeightKg = cartTotalWeightKg(items);
  const minWeightMet = cartMinWeightMet(items);

  async function requestQuote() {
    if (enriched.length === 0) return;
    setQuoteLoading(true);
    setQuote(null);
    setSavedQuoteId(null);
    setSaveError(null);
    try {
      // For demo: compute the first item's full landed cost at the total cart qty.
      // In real backend, the server sums across all items.
      const first = enriched[0];
      if (!first.product) return;
      const totalQty = enriched.reduce((s, e) => s + e.item.qty, 0);
      // Average per-pc factory price (locked at add time, no markup —
      // markup is in the per-piece product BDT for the cart line)
      const avgUnitFen = Math.round(
        items.reduce((s, i) => s + i.qty * i.unitPriceCny, 0) /
          Math.max(1, totalQty),
      );
      // Build a synthetic product with locked unit price for the calculator
      const synth = {
        ...first.product,
        price_tiers: [
          {
            qty_min: 1,
            qty_max: 9999,
            price_cny_fen: avgUnitFen,
          },
        ],
        weight_kg:
          enriched.reduce((s, e) => s + (e.product?.weight_kg ?? 0) * e.item.qty, 0) /
          Math.max(1, totalQty),
        volume_cbm:
          enriched.reduce((s, e) => s + (e.product?.volume_cbm ?? 0) * e.item.qty, 0) /
          Math.max(1, totalQty),
      };
      const r = await fetch(
        `/api/quote/landed?productId=${synth.source_id}&qty=${totalQty}&mode=${mode}`,
      );
      const j = await r.json();
      if (!j.ok) return;
      setQuote(j.quote);

      // Persist to Supabase if signed in
      if (signedInEmail) {
        try {
          const save = await fetch("/api/quote/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quote: j.quote,
              product_ids: enriched.map((e) => e.item.productId),
              shipping_mode: mode,
              total_qty: totalQty,
            }),
          });
          const saveJ = await save.json();
          if (saveJ.ok) setSavedQuoteId(saveJ.quote.quote_id);
          else setSaveError(saveJ.error ?? "Save failed");
        } catch (e) {
          setSaveError(e instanceof Error ? e.message : "Save failed");
        }
      }
    } finally {
      setQuoteLoading(false);
    }
  }

  if (!hydrated) {
    return (
      <Container className="py-16">
        <p className="text-[13px] text-fg-muted">Loading…</p>
      </Container>
    );
  }

  if (items.length === 0) {
    return (
      <Container className="py-16 text-center">
        <h1 className="text-[24px] font-semibold tracking-tight">
          {t("cart.empty.title")}
        </h1>
        <p className="mt-2 text-[14px] text-fg-muted">
          {t("cart.empty.body")}
        </p>
        <Link
          href="/categories"
          className="mt-6 inline-flex h-11 items-center px-5 text-[13.5px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700"
        >
          {t("cart.empty.cta")}
        </Link>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <h1 className="text-[28px] font-semibold tracking-[-0.01em]">
        {t("cart.title")}{" "}
        <span className="text-fg-muted font-normal text-[20px]">
          · {count} {t("cart.items")}
        </span>
      </h1>

      <div className="mt-6 grid lg:grid-cols-12 gap-8">
        <ul className="lg:col-span-8 divide-y divide-border card">
          {enriched.map(({ item, product }) => (
            <li key={item.productId} className="p-5 flex gap-4">
              <Link
                href={`/products/${item.productId}`}
                className="relative w-24 h-24 rounded-md overflow-hidden bg-slate-50 border border-border shrink-0"
              >
                <Image
                  src={item.image}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/products/${item.productId}`}
                  className="text-[14px] font-medium leading-snug hover:underline"
                >
                  {lang === "bn" ? item.title_bn : item.title_en}
                </Link>
                {/*
                  Per-piece product price + factory ¥-reference are
                  HIDDEN in the cart. The buyer already saw them on
                  the PDP; in the cart we keep only the line total so
                  the buyer commits to the order without second-guessing
                  the per-piece math.
                */}
                <p className="mt-1 text-[12px] text-fg-subtle font-mono tnum">
                  {product?.supplier_city ?? "—"},{" "}
                  {product?.supplier_province ?? "—"} · MOQ{" "}
                  {product?.factory_moq ?? "—"} · Qty {item.qty}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center border border-border rounded-md">
                    <button
                      onClick={() => updateQty(item.productId, item.qty - 1)}
                      className="w-8 h-8 text-fg-muted hover:bg-slate-50"
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <span className="w-10 h-8 text-center text-[13px] price-tag font-medium flex items-center justify-center">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.productId, item.qty + 1)}
                      className="w-8 h-8 text-fg-muted hover:bg-slate-50"
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                  <p className="price-tag font-semibold text-[15px]">
                    {fmtBdt(cartUnitProductBdt(item) * item.qty)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => remove(item.productId)}
                aria-label={t("cart.remove")}
                className="self-start text-fg-subtle hover:text-fg"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <aside className="lg:col-span-4 space-y-4">
          <div className="card p-5">
            {/* Phase 14: the buyer only sees the product subtotal on
                the cart page. The landed cost (shipping + customs +
                VAT + AIT) is NOT shown — per user instruction, our
                team confirms the amount by email or WhatsApp after
                the buyer places the order. The product subtotal is
                the only number the buyer needs to see in the cart
                summary; the place order button stays. */}
            <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
              {t("cart.product_subtotal")}
            </p>
            <p className="mt-1 price-tag text-[28px] font-semibold">
              {fmtBdt(productSubtotalBdt)}
            </p>
            <p className="text-[12px] text-fg-muted mt-2">
              {t("cart.disclaimer")}
            </p>

            <div className="mt-5">
              <label className="text-[12px] text-fg-subtle uppercase tracking-wider font-medium">
                Shipping mode
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["air", "sea"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`h-10 px-3 text-[13px] font-medium rounded-md border transition-colors ${
                      mode === m
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-bg text-fg border-border hover:border-border-strong"
                    }`}
                  >
                    {m === "air" ? "Air freight" : "Sea freight (LCL)"}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Weight progress bar (Phase 11) ── */}
            <div className="mt-5">
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
              <div className="mt-1.5 h-1.5 rounded-full bg-bg-soft overflow-hidden">
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

            <button
              onClick={requestQuote}
              disabled={quoteLoading}
              className="mt-5 w-full h-11 rounded-md bg-cyan-600 text-white text-[13.5px] font-medium hover:bg-cyan-700 disabled:opacity-60"
            >
              {quoteLoading ? "Calculating…" : t("cart.request_quote")}
            </button>
            {minWeightMet ? (
              <Link
                href={signedInEmail ? "/checkout" : "/login?redirect=/checkout"}
                className="mt-2 w-full h-11 rounded-md bg-cyan-600 text-white text-[13.5px] font-medium hover:bg-cyan-700 flex items-center justify-center"
              >
                {t("cart.place_order")} →
              </Link>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="mt-2 w-full h-11 rounded-md border border-border bg-bg-soft text-fg-subtle text-[13.5px] font-medium cursor-not-allowed flex items-center justify-center"
              >
                {t("cart.place_order")} →
              </button>
            )}
            {!signedInEmail && (
              <Link
                href="/login?redirect=/cart"
                className="mt-2 block text-center text-[11.5px] text-fg-subtle hover:text-fg underline-offset-2 hover:underline"
              >
                Sign in to save this quote to your account
              </Link>
            )}
            {savedQuoteId && (
              <p className="mt-2 text-[11.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2">
                ✓ Saved as <span className="font-mono">{savedQuoteId}</span> — view in <Link href="/account" className="underline">account</Link>
              </p>
            )}
            {saveError && (
              <p className="mt-2 text-[11.5px] text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                {saveError}
              </p>
            )}
          </div>

          {quote && (
            <div className="card p-5 space-y-3">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] text-cyan-700 uppercase tracking-wider font-semibold">
                  Quote {quote.quoteId}
                </p>
                <p className="text-[10.5px] text-fg-subtle">
                  Valid 7 days
                </p>
              </div>

              {/* Phase 14: the quote panel on the cart page no longer
                  shows the landed cost breakdown. We saved the
                  quote server-side so ops can reference it (the
                  `/api/quote/landed` response has the full math,
                  used by the order page) but the buyer only sees
                  the product price + a one-line "landed cost
                  shared after order" note. */}
              <div className="space-y-1.5 text-[12.5px]">
                <Row
                  label="Product price"
                  value={fmtBdtDisplay(quote.productBdt)}
                />
              </div>

              <p className="text-[11px] text-fg-muted leading-relaxed pt-2 border-t border-border">
                {t("pdp.landed.body")}
              </p>
              <p className="text-[10.5px] text-fg-subtle">
                Transit: {quote.transitDays}.
              </p>
            </div>
          )}
        </aside>
      </div>
    </Container>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-muted">{label}</span>
      <span className="price-tag font-medium">{value}</span>
    </div>
  );
}

function fmtBdtDisplay(n: number): string {
  return "৳" + Math.round(n).toLocaleString("en-IN");
}
