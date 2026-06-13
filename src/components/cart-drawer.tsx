"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useLang } from "@/lib/i18n";
import { fmtBdt, fmtCny, FX_CNY_BDT } from "@/lib/pricing";

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

  const subtotalFen = items.reduce(
    (s, i) => s + i.qty * i.unitPriceCny,
    0,
  );

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
            <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
              {t("cart.title")}
            </p>
            <h2 className="mt-0.5 text-[18px] font-semibold tracking-tight">
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
                    <p className="mt-1 text-[11px] text-fg-subtle font-mono tnum">
                      {fmtBdt(Math.ceil((it.unitPriceCny / 100) * FX_CNY_BDT))} / pc · {fmtCny(it.unitPriceCny)} factory
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
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border p-5 space-y-3 bg-bg-soft">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-fg-muted">
                {t("cart.est_fob")} ({items.length} {t("cart.skus")})
              </span>
              <span className="price-tag font-semibold text-[16px]">
                {fmtBdt(Math.ceil((subtotalFen / 100) * FX_CNY_BDT))}
              </span>
            </div>
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
              <Link
                href="/cart/request-quote"
                onClick={onClose}
                className="h-10 inline-flex items-center justify-center text-[13px] font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                {t("cart.request_quote")}
              </Link>
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
        className="mt-5 inline-flex h-10 items-center px-4 text-[13px] font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
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
