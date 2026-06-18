"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { useCart, cartUnitProductBdt, cartProductSubtotalBdt } from "@/lib/cart";
import { useCatalog } from "@/lib/use-catalog";
import { getBrowserClient } from "@/lib/supabase/browser";
import {
  landedCost,
  type ShippingMode,
  fmtBdt,
  FX_CNY_BDT,
} from "@/lib/pricing";

type Address = {
  full_name: string;
  phone: string;
  district: string;
  address_line: string;
};

type SavedAddress = {
  id: number;
  label: "Home" | "Office" | "3PL" | "Factory" | "Other";
  full_name: string;
  phone: string;
  country: string;
  district: string;
  address_line: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

// Empty sentinel — no saved address selected. User is filling
// out the form fresh (e.g. first-time buyer, or one-off delivery).
const SAVED_NONE = -1;

export function CheckoutClient() {
  const { t } = useLang();
  const router = useRouter();
  const { items, hydrated } = useCart();
  const { products: allProducts } = useCatalog();
  const [mode, setMode] = useState<ShippingMode>("air");
  const [payment, setPayment] = useState<"bkash" | "bank" | "cod" | "usdt">(
    "bkash",
  );
  const [address, setAddress] = useState<Address>({
    full_name: "",
    phone: "",
    district: "",
    address_line: "",
  });
  const [buyerNote, setBuyerNote] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [signedInUserId, setSignedInUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // Phase 19: saved addresses. -1 = "type a new one" (default
  // when the user has no saved addresses, or chooses not to use
  // one).
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number>(SAVED_NONE);
  const [addressesLoaded, setAddressesLoaded] = useState(false);

  // Session
  useEffect(() => {
    const sb = getBrowserClient();
    sb.auth.getSession().then(({ data }) => {
      setSignedInEmail(data.session?.user?.email ?? null);
      setSignedInUserId(data.session?.user?.id ?? null);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => {
      setSignedInEmail(session?.user?.email ?? null);
      setSignedInUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Phase 19: load saved addresses. The buyer is signed-in here
  // (sign-in guard above). We pre-select the default so the
  // buyer doesn't have to do anything; if there's no default
  // we pre-select the most-recent. If there are no addresses
  // at all, we leave the form empty.
  useEffect(() => {
    if (!signedInUserId) {
      setAddressesLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/buyer/addresses");
        if (!res.ok) {
          setAddressesLoaded(true);
          return;
        }
        const j = await res.json();
        if (cancelled) return;
        const list: SavedAddress[] = j.addresses ?? [];
        setSavedAddresses(list);
        // Pre-select: default first, else most-recent, else none.
        const def = list.find((a) => a.is_default) ?? list[0];
        if (def) {
          setSelectedAddressId(def.id);
          setAddress({
            full_name: def.full_name,
            phone: def.phone,
            district: def.district,
            address_line: def.address_line,
          });
        } else {
          setSelectedAddressId(SAVED_NONE);
        }
      } finally {
        if (!cancelled) setAddressesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedInUserId]);

  // When the user switches saved addresses, hydrate the form.
  function applyAddress(id: number) {
    setSelectedAddressId(id);
    if (id === SAVED_NONE) {
      setAddress({ full_name: "", phone: "", district: "", address_line: "" });
      return;
    }
    const a = savedAddresses.find((x) => x.id === id);
    if (a) {
      setAddress({
        full_name: a.full_name,
        phone: a.phone,
        district: a.district,
        address_line: a.address_line,
      });
    }
  }

  // Empty-cart guard
  if (hydrated && items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">{t("checkout.empty")}</h1>
        <Link
          href="/categories"
          className="mt-6 inline-block px-5 py-2.5 rounded-md bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700"
        >
          {t("checkout.empty.cta")}
        </Link>
      </div>
    );
  }

  // Sign-in guard
  if (hydrated && !signedInUserId) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">{t("checkout.sign_in")}</h1>
        <Link
          href="/login?redirect=/checkout"
          className="mt-6 inline-block px-5 py-2.5 rounded-md bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700"
        >
          {t("nav.signin")}
        </Link>
      </div>
    );
  }

  if (!hydrated) {
    return <div className="mx-auto max-w-7xl px-6 py-24" />;
  }

  // ── Compute totals client-side (for display). The server
  //    re-computes these and they're the source of truth.
  const productSubtotalBdt = cartProductSubtotalBdt(items);

  // Aggregate shipping/duty/vat/ait across all cart lines using
  // the same pricing math the server uses. We use the buyer's
  // locked markup_pct (already on each cart item).
  let shippingBdt = 0;
  let dutyBdt = 0;
  for (const it of items) {
    const product = allProducts.find((p) => p.source_id === it.productId);
    if (!product) continue;
    const legacy = dbProductToLegacy(product);
    legacy.markup_pct = it.markup_pct;
    const breakdown = landedCost(legacy, it.qty, mode, FX_CNY_BDT);
    shippingBdt +=
      breakdown.intlBdt +
      breakdown.cnDomesticBdt +
      breakdown.agentBdt +
      breakdown.consolBdt;
    dutyBdt += breakdown.dutyBdt;
  }
  const cifBdt = productSubtotalBdt + shippingBdt;
  const vatBdt = Math.round(cifBdt * 0.15);
  const aitBdt = Math.round(cifBdt * 0.05);
  const totalBdt = cifBdt + dutyBdt + vatBdt + aitBdt;
  // Phase 13 (full prepayment): the buyer pays 100% of the
  // landed cost at order confirm. No balance on delivery.
  // The legacy `depositBdt` / `balanceBdt` are kept for
  // schema compat (the API still writes them) but the UI
  // surfaces only the total.
  const depositBdt = totalBdt;
  const balanceBdt = 0;

  async function placeOrder() {
    setErrorKey(null);
    if (
      !address.full_name.trim() ||
      !address.phone.trim() ||
      !address.district.trim() ||
      !address.address_line.trim()
    ) {
      setErrorKey("checkout.error.address");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_mode: mode,
          payment_method: payment,
          address: {
            full_name: address.full_name.trim(),
            phone: address.phone.trim(),
            district: address.district.trim(),
            address_line: address.address_line.trim(),
            country: "Bangladesh",
          },
          // Phase 19: only send address_id if the user actively
          // selected one of their saved addresses. If they typed
          // a one-off, we don't claim it came from the address
          // book.
          ...(selectedAddressId !== SAVED_NONE
            ? { address_id: selectedAddressId }
            : {}),
          buyer_note: buyerNote.trim() || undefined,
          items: items.map((it) => ({
            source_id: it.productId,
            qty: it.qty,
            markup_pct: it.markup_pct,
            weight_kg: it.weight_kg,
            volume_cbm: it.volume_cbm,
            category: it.category,
            customs_duty_per_kg: it.customs_duty_per_kg,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        if (res.status === 401) setErrorKey("checkout.error.unauth");
        else setErrorKey("checkout.error.network");
        return;
      }
      // Clear the cart and redirect to the order detail page.
      try {
        window.localStorage.removeItem("banglasource.cart.v1");
        window.dispatchEvent(new CustomEvent("cart:update"));
      } catch {
        /* localStorage may be blocked — the order is still placed */
      }
      router.push(`/orders/${json.order.id}`);
    } catch {
      setErrorKey("checkout.error.network");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 md:px-10 py-10">
      <div className="mb-8">
        <p className="text-[12px] font-medium tracking-wider uppercase text-fg-subtle">
          BanglaSource
        </p>
        <h1 className="mt-2 text-[28px] md:text-[36px] leading-[1.05] font-semibold tracking-[-0.02em]">
          {t("checkout.title")}
        </h1>
        <p className="mt-2 text-[14px] text-fg-muted max-w-2xl">
          {t("checkout.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: form */}
        <div className="lg:col-span-7 space-y-6">
          {/* Address */}
          <section className="card p-6">
            <h2 className="text-[15px] font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 text-[12px] font-semibold flex items-center justify-center">
                1
              </span>
              {t("checkout.address")}
            </h2>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              {t("checkout.address.help")}
            </p>
            {addressesLoaded && savedAddresses.length > 0 && (
              <div className="mt-4">
                <label
                  htmlFor="saved_address"
                  className="block text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium mb-1.5"
                >
                  Ship to
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    id="saved_address"
                    value={selectedAddressId}
                    onChange={(e) => applyAddress(Number(e.target.value))}
                    className="flex-1 h-9 px-3 rounded-md border border-border bg-bg text-[13px] outline-none focus:border-cyan-500"
                  >
                    {savedAddresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.is_default ? "★ " : ""}
                        {a.label} — {a.full_name}, {a.district}
                      </option>
                    ))}
                    <option value={SAVED_NONE}>+ Use a different address</option>
                  </select>
                  <a
                    href="/buyer/addresses"
                    className="h-9 px-3 inline-flex items-center justify-center text-[12px] border border-border rounded-md text-fg-muted hover:text-fg hover:bg-bg-soft shrink-0"
                  >
                    Manage saved
                  </a>
                </div>
                {selectedAddressId !== SAVED_NONE && (
                  <p className="mt-2 text-[11.5px] text-fg-muted">
                    Editing these fields will use the address for this
                    order only — it won't update your saved address.
                  </p>
                )}
              </div>
            )}
            {addressesLoaded && savedAddresses.length === 0 && (
              <div className="mt-4 text-[12px] text-fg-muted bg-cyan-50 border border-cyan-200 rounded-md p-2.5 flex items-center justify-between gap-3">
                <span>
                  Save this address for next time — one tap at /checkout.
                </span>
                <a
                  href="/buyer/addresses?action=new"
                  className="shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center px-2 text-[12px] font-medium text-cyan-700 hover:underline"
                >
                  Save now →
                </a>
              </div>
            )}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                id="full_name"
                label={t("checkout.full_name")}
                placeholder={t("checkout.full_name_ph")}
                value={address.full_name}
                onChange={(v) => setAddress({ ...address, full_name: v })}
              />
              <Field
                id="phone"
                label={t("checkout.phone")}
                placeholder="01XXX-XXXXXX"
                value={address.phone}
                onChange={(v) => setAddress({ ...address, phone: v })}
              />
              <Field
                id="district"
                label={t("checkout.district")}
                placeholder={t("checkout.district_ph")}
                value={address.district}
                onChange={(v) => setAddress({ ...address, district: v })}
              />
              <Field
                id="address_line"
                label={t("checkout.address_line")}
                placeholder={t("checkout.address_line_ph")}
                value={address.address_line}
                onChange={(v) => setAddress({ ...address, address_line: v })}
              />
            </div>
            <div className="mt-3">
              <label
                htmlFor="buyer_note"
                className="block text-[12px] font-medium text-fg"
              >
                {t("checkout.buyer_note")}
              </label>
              <textarea
                id="buyer_note"
                rows={2}
                value={buyerNote}
                onChange={(e) => setBuyerNote(e.target.value)}
                placeholder={t("checkout.buyer_note_ph")}
                className="mt-1.5 w-full px-3 py-2 rounded-md border border-border bg-bg text-[13px] focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>
          </section>

          {/* Shipping mode */}
          <section className="card p-6">
            <h2 className="text-[15px] font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 text-[12px] font-semibold flex items-center justify-center">
                2
              </span>
              {t("checkout.shipping")}
            </h2>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              {t("checkout.shipping.help")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ModeButton
                active={mode === "air"}
                onClick={() => setMode("air")}
                title={t("checkout.shipping.air")}
                sub="৳1,348–421 / kg"
              />
              <ModeButton
                active={mode === "sea"}
                onClick={() => setMode("sea")}
                title={t("checkout.shipping.sea")}
                sub="৳33,700 / CBM"
              />
            </div>
          </section>

          {/* Payment method */}
          <section className="card p-6">
            <h2 className="text-[15px] font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 text-[12px] font-semibold flex items-center justify-center">
                3
              </span>
              {t("checkout.payment")}
            </h2>
            <div className="mt-4 space-y-2.5">
              <PaymentRadio
                active={payment === "bkash"}
                onClick={() => setPayment("bkash")}
                title={t("checkout.payment.bkash")}
                help={t("checkout.payment.bkash_help")}
              />
              <PaymentRadio
                active={payment === "bank"}
                onClick={() => setPayment("bank")}
                title={t("checkout.payment.bank")}
                help={t("checkout.payment.bank_help")}
              />
              <PaymentRadio
                active={payment === "cod"}
                onClick={() => setPayment("cod")}
                title={t("checkout.payment.cod")}
                help={t("checkout.payment.cod_help")}
              />
              <PaymentRadio
                active={payment === "usdt"}
                onClick={() => setPayment("usdt")}
                title={t("checkout.payment.usdt")}
                help={t("checkout.payment.usdt_help")}
              />
            </div>
          </section>
        </div>

        {/* Right: summary */}
        <div className="lg:col-span-5">
          <div className="card p-6 sticky top-6">
            <h2 className="text-[15px] font-semibold">
              {t("checkout.summary")}
            </h2>

            <ul className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
              {items.map((it) => {
                const product = allProducts.find(
                  (p) => p.source_id === it.productId,
                );
                const img = product?.images?.[0];
                const unitBdt = cartUnitProductBdt(it);
                const lineBdt = unitBdt * it.qty;
                return (
                  <li
                    key={it.productId}
                    className="flex items-start gap-2.5 text-[12.5px]"
                  >
                    <div className="relative w-10 h-10 rounded-md overflow-hidden bg-bg-soft border border-border shrink-0">
                      {img ? (
                        <Image
                          src={img}
                          alt={it.title_en}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{it.title_en}</p>
                      <p className="text-fg-subtle">
                        {it.qty} × {fmtBdt(unitBdt)}
                      </p>
                    </div>
                    <span className="font-mono tnum shrink-0">
                      {fmtBdt(lineBdt)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-[12.5px]">
              <Row label={t("checkout.summary.subtotal")} value={fmtBdt(productSubtotalBdt)} />
            </div>

            {/* Phase 14: the checkout summary no longer shows the
                landed cost breakdown. The product subtotal is the
                only number the buyer sees in their primary flow —
                the landed cost (shipping + customs + VAT + AIT) is
                NOT shown. Per user instruction, our team confirms
                the amount by email or WhatsApp after the buyer
                submits. The card below replaces the 70/30 emerald
                block from Phase 13. */}
            <div className="mt-4 p-3 rounded-md bg-cyan-50 border border-cyan-200/60 text-[12px] text-cyan-900">
              <p className="font-medium">{t("checkout.summary.deposit")}</p>
              <p className="mt-1 text-[14.5px] font-mono tnum text-cyan-900/80">
                {t("checkout.summary.balance")}
              </p>
              <p className="mt-1.5 text-cyan-800/90 text-[11.5px] leading-relaxed">
                {t("checkout.summary.deposit_help")}
              </p>
            </div>

            {errorKey ? (
              <p className="mt-3 text-[12px] text-red-600">{t(errorKey)}</p>
            ) : null}

            <button
              onClick={placeOrder}
              disabled={submitting}
              className="mt-4 w-full h-11 rounded-md bg-cyan-600 text-white text-[14px] font-medium hover:bg-cyan-700 disabled:opacity-60"
            >
              {submitting ? t("checkout.placing") : t("checkout.place")}
            </button>
            <p className="mt-2 text-[11px] text-fg-subtle text-center">
              {t("checkout.note.thanks")}
            </p>

            {signedInEmail ? (
              <p className="mt-3 text-[11px] text-fg-subtle text-center">
                Signed in as <span className="font-mono">{signedInEmail}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[12px] font-medium text-fg"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full h-10 px-3 rounded-md border border-border bg-bg text-[13px] placeholder:text-fg-subtle focus:outline-none focus:border-cyan-500"
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-md border text-left transition-colors ${
        active
          ? "bg-emerald-50 border-emerald-300"
          : "bg-bg border-border hover:border-cyan-200"
      }`}
    >
      <p
        className={`text-[13px] font-medium ${active ? "text-emerald-900" : "text-fg"}`}
      >
        {title}
      </p>
      <p className="text-[11.5px] text-fg-subtle mt-0.5">{sub}</p>
    </button>
  );
}

function PaymentRadio({
  active,
  onClick,
  title,
  help,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  help: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-3 rounded-md border text-left transition-colors ${
        active
          ? "bg-emerald-50 border-emerald-300"
          : "bg-bg border-border hover:border-cyan-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            active ? "border-cyan-600" : "border-border"
          }`}
        >
          {active ? (
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
          ) : null}
        </span>
        <span
          className={`text-[13px] font-medium ${active ? "text-emerald-900" : "text-fg"}`}
        >
          {title}
        </span>
      </div>
      <p className="mt-1.5 text-[11.5px] text-fg-muted ml-6">{help}</p>
    </button>
  );
}

function Row({
  label,
  value,
  big = false,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between ${big ? "pt-1.5 mt-1.5 border-t border-border" : ""}`}
    >
      <span className={big ? "text-[13px] font-semibold" : "text-fg-muted"}>
        {label}
      </span>
      <span
        className={`font-mono tnum ${big ? "text-[15px] font-semibold" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

// Local copy of the catalog's legacy shape converter. The full
// helper lives in @/lib/catalog.ts but is "use server" / Next.js
// internal — we mirror the fields we need (price_tiers,
// weight_kg, volume_cbm, markup_pct, category, customs_duty_per_kg,
// source_id, supplier_name, etc.) to call landedCost on the client.
type DbLite = {
  source_id: string;
  title_en: string;
  title_bn: string;
  category: string;
  factory_moq: number;
  markup_pct: number;
  weight_kg: number;
  volume_cbm: number;
  price_tiers: { qty_min: number; qty_max: number | null; price_cny_fen: number }[];
  customs_duty_per_kg: number;
  supplier_name: string;
  rating_overall: number;
  images: string[];
};
function dbProductToLegacy(p: DbLite) {
  return {
    source_id: p.source_id,
    title_zh: "",
    title_en: p.title_en,
    title_bn: p.title_bn,
    category: p.category,
    price_min_cny: p.price_tiers[0]?.price_cny_fen ?? 0,
    price_max_cny: p.price_tiers.at(-1)?.price_cny_fen ?? 0,
    factory_moq: p.factory_moq,
    // `p.price_tiers` has nullable `qty_max` (the DB row); the
    // legacy `Product` type requires `number`. Coalesce null → 0
    // (the downstream pricing code treats 0 as "no upper bound").
    price_tiers: p.price_tiers.map((t) => ({
      qty_min: t.qty_min,
      qty_max: t.qty_max ?? 0,
      price_cny_fen: t.price_cny_fen,
    })),
    weight_kg: p.weight_kg,
    volume_cbm: p.volume_cbm,
    supplier_name: p.supplier_name,
    supplier_province: "",
    supplier_city: "",
    stock_total: 0,
    order_count_30d: 0,
    rating_overall: p.rating_overall,
    badges: [],
    images: p.images,
    description_en: "",
    description_bn: "",
    source_url: "",
    markup_pct: p.markup_pct,
    customs_duty_per_kg: p.customs_duty_per_kg,
  };
}
