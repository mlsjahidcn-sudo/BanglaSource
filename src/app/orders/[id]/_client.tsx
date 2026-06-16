"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fmtBdt, FX_CNY_BDT } from "@/lib/pricing";

type OrderRow = {
  id: number;
  user_id: string;
  status: "pending_payment" | "paid" | "in_transit" | "delivered" | "cancelled";
  shipping_mode: "air" | "sea";
  product_subtotal_bdt: number;
  shipping_bdt: number;
  duty_bdt: number;
  vat_bdt: number;
  ait_bdt: number;
  total_bdt: number;
  /** Amount paid upfront at order confirm. In full_prepay mode
   *  (Phase 13+) this equals total_bdt. In legacy deposit_balance
   *  mode this was 70% of product_subtotal. */
  deposit_bdt: number;
  /** Amount due on delivery. 0 in full_prepay mode. 30% of
   *  product_subtotal in legacy mode. */
  balance_bdt: number;
  paid_at: string | null;
  payment_method: "bkash" | "bank" | "cod" | "usdt";
  payment_model: "full_prepay" | "deposit_balance";
  address_snapshot: null | {
    full_name: string;
    phone: string;
    district: string;
    address_line: string;
    country?: string;
  };
  buyer_note: string | null;
  tracking_number: string | null;
  created_at: string;
};

type OrderItemRow = {
  id: number;
  qty: number;
  title_snapshot: string;
  image_snapshot: string | null;
  unit_cny_fen: number;
  fx_cny_to_bdt: number;
  markup_pct: number;
  weight_kg: number;
  volume_cbm: number;
  category: string | null;
  customs_duty_per_kg: number;
  unit_bdt: number;
  line_bdt: number;
  line_duty_bdt: number;
  position: number;
};

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const { t } = useLang();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    const sb = getBrowserClient();
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      // We can't use the anon client to fetch directly because
      // service-role RLS only allows owner SELECT — which works
      // for the signed-in user, but to keep the API surface
      // tidy we read through a tiny helper.
      const r = await fetch(`/api/orders/${orderId}`);
      if (r.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!r.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const j = await r.json();
      setOrder(j.order);
      setItems(j.items ?? []);
      setLoading(false);
    })();
  }, [orderId]);

  async function markOrderPaid() {
    if (!order) return;
    setMarkingPaid(true);
    try {
      const r = await fetch(`/api/orders/${orderId}/paid`, { method: "POST" });
      if (r.ok) {
        setMarked(true);
        setOrder({ ...order, status: "paid", paid_at: new Date().toISOString() });
      }
    } finally {
      setMarkingPaid(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-6 py-24 text-fg-subtle">Loading…</div>;
  }
  if (notFound || !order) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Order not found</h1>
        <Link
          href="/buyer/orders"
          className="mt-4 inline-block text-cyan-700 hover:text-cyan-700 text-sm font-medium"
        >
          ← View all orders
        </Link>
      </div>
    );
  }

  const orderNumber = `BS-${String(order.id).padStart(6, "0")}`;

  return (
    <div className="mx-auto max-w-5xl px-6 md:px-10 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
        <div>
          <p className="text-[12px] font-medium tracking-wider uppercase text-fg-subtle">
            {t("order.title")}
          </p>
          <h1 className="mt-1 text-[28px] md:text-[36px] font-semibold tracking-[-0.02em] font-mono">
            {orderNumber}
          </h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            {t("order.placed_on")}{" "}
            {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Payment instructions (if pending) — Phase 13: full prepayment */}
      {order.status === "pending_payment" ? (
        <section className="card p-6 mb-6 border-emerald-200 bg-emerald-50/40">
          <h2 className="text-[15px] font-semibold flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-[12px] font-semibold flex items-center justify-center">
              !
            </span>
            {t("order.payment_instructions")}
          </h2>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            {t("order.payment_help")}
          </p>

          <PaymentInstructions
            method={order.payment_method}
            orderNumber={orderNumber}
            amount={null /* Phase 14: amount is shared by email/WhatsApp, not hard-coded here */}
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={markOrderPaid}
              disabled={markingPaid || marked}
              className="px-4 h-10 rounded-md bg-cyan-600 text-white text-[13px] font-medium hover:bg-cyan-700 disabled:opacity-60"
            >
              {marked
                ? "✓ Marked paid"
                : markingPaid
                  ? "…"
                  : t("order.mark_paid")}
            </button>
            <a
              href="https://wa.me/8617325764171"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12.5px] text-cyan-700 hover:text-cyan-800 font-medium"
            >
              Need help? WhatsApp →
            </a>
          </div>
        </section>
      ) : null}

      {/* Paid confirmation banner */}
      {order.status === "paid" && order.paid_at ? (
        <section className="card p-4 mb-6 border-cyan-200 bg-cyan-50/40 text-[13px]">
          <p className="font-medium text-cyan-900">
            ✓ {t("order.paid_at")}: {new Date(order.paid_at).toLocaleString()}
          </p>
        </section>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items + summary */}
        <div className="lg:col-span-2 space-y-6">
          <section className="card p-6">
            <h2 className="text-[15px] font-semibold">
              {t("order.items")} ({items.length})
            </h2>
            <ul className="mt-4 divide-y divide-border">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="relative w-14 h-14 rounded-md overflow-hidden bg-bg-soft border border-border shrink-0">
                    {it.image_snapshot ? (
                      <Image
                        src={it.image_snapshot}
                        alt={it.title_snapshot}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium truncate">
                      {it.title_snapshot}
                    </p>
                    <p className="text-[12px] text-fg-muted mt-0.5">
                      {t("order.line_unit")}: {fmtBdt(it.unit_bdt)} ·{" "}
                      {t("order.line_qty")}: {it.qty}
                    </p>
                    <p className="text-[11.5px] text-fg-subtle mt-0.5">
                      factory ¥{(it.unit_cny_fen / 100).toFixed(2)} · FX {it.fx_cny_to_bdt} · {it.weight_kg} kg/pc
                    </p>
                  </div>
                  <span className="font-mono tnum text-[13px] shrink-0">
                    {fmtBdt(it.line_bdt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-6">
            <h2 className="text-[15px] font-semibold">{t("order.summary")}</h2>
            <div className="mt-3 space-y-1.5 text-[12.5px]">
              <Row label="Product subtotal" value={fmtBdt(order.product_subtotal_bdt)} />
            </div>
            {/* Phase 14: the order summary on the buyer-facing page
                only shows the product subtotal. The shipping /
                customs / VAT / AIT breakdown and the grand total
                are stored on the order row for audit (admins see
                them in /admin/orders — not yet built) but are NOT
                shown to the buyer. Per user instruction, our team
                confirms the landed cost by email or WhatsApp
                after the order is placed. */}
            <div className="mt-4 p-3 rounded-md bg-cyan-50 border border-cyan-200/60 text-[12.5px] text-cyan-900">
              <p className="font-medium">{t("order.amount_to_pay")}</p>
              <p className="mt-1.5 text-[11.5px] text-cyan-800/90 leading-relaxed">
                {t("order.full_prepay_note")}
              </p>
            </div>
          </section>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <section className="card p-5">
            <h3 className="text-[12px] uppercase tracking-wider text-fg-subtle font-medium">
              {t("order.address")}
            </h3>
            {order.address_snapshot ? (
              <div className="mt-2 text-[13px] text-fg space-y-0.5">
                <p className="font-medium">{order.address_snapshot.full_name}</p>
                <p>{order.address_snapshot.phone}</p>
                <p>{order.address_snapshot.address_line}</p>
                <p>
                  {order.address_snapshot.district}
                  {order.address_snapshot.country
                    ? `, ${order.address_snapshot.country}`
                    : ""}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-fg-muted">—</p>
            )}
            {order.buyer_note ? (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">
                  {t("checkout.buyer_note")}
                </p>
                <p className="mt-1 text-[12.5px] text-fg-muted">
                  {order.buyer_note}
                </p>
              </div>
            ) : null}
          </section>

          <section className="card p-5">
            <h3 className="text-[12px] uppercase tracking-wider text-fg-subtle font-medium">
              {t("order.shipping_mode")}
            </h3>
            <p className="mt-2 text-[13px] text-fg">
              {order.shipping_mode === "air"
                ? t("checkout.shipping.air")
                : t("checkout.shipping.sea")}
            </p>
            {order.tracking_number ? (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">
                  Tracking
                </p>
                <p className="mt-1 text-[12.5px] font-mono">
                  {order.tracking_number}
                </p>
              </div>
            ) : null}
          </section>

          <Link
            href="/buyer/orders"
            className="block text-center text-[12.5px] text-fg-muted hover:text-fg"
          >
            ← All orders
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: OrderRow["status"];
}) {
  const { t } = useLang();
  const map: Record<OrderRow["status"], { tone: string; label: string }> = {
    pending_payment: { tone: "bg-amber-50 text-amber-800 border-amber-200", label: t("order.status.pending_payment") },
    paid: { tone: "bg-cyan-50 text-cyan-800 border-cyan-200", label: t("order.status.paid") },
    in_transit: { tone: "bg-violet-50 text-violet-800 border-violet-200", label: t("order.status.in_transit") },
    delivered: { tone: "bg-emerald-50 text-emerald-800 border-emerald-200", label: t("order.status.delivered") },
    cancelled: { tone: "bg-slate-100 text-slate-700 border-slate-200", label: t("order.status.cancelled") },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12px] font-medium ${s.tone}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

function PaymentInstructions({
  method,
  orderNumber,
  amount,
}: {
  method: OrderRow["payment_method"];
  orderNumber: string;
  /** Phase 14: null = amount is shared by email/WhatsApp, not hard-coded.
   *  Number = legacy Phase 13 path (full prepayment with the amount on
   *  this page). Kept for back-compat; the buyer flow now always
   *  passes null. */
  amount: number | null;
}) {
  const { t } = useLang();
  const amountLine = amount == null
    ? { label: "Amount", value: t("order.amount_after_confirm") }
    : { label: "Amount", value: fmtBdt(amount) };
  const details: Record<
    OrderRow["payment_method"],
    { title: string; lines: Array<{ label: string; value: string; copy?: boolean }> }
  > = {
    bkash: {
      title: "bKash Personal",
      lines: [
        { label: "Number", value: "0173-25764171", copy: true },
        { label: "Reference", value: orderNumber, copy: true },
        amountLine,
      ],
    },
    bank: {
      title: "Bank transfer",
      lines: [
        { label: "Bank", value: "City Bank" },
        { label: "A/C", value: "1234-567890-1", copy: true },
        { label: "Beneficiary", value: "Skybuy Limited" },
        { label: "Reference", value: orderNumber, copy: true },
        amountLine,
      ],
    },
    cod: {
      title: "Cash on delivery",
      lines: [
        { label: "Warehouse", value: "Badda, Dhaka" },
        { label: "Hours", value: "Sat-Thu 10:00-19:00 BST" },
        { label: "Reference", value: orderNumber, copy: true },
        amountLine,
      ],
    },
    usdt: {
      title: "USDT (TRC20)",
      lines: [
        { label: "Wallet", value: "TXyz... (shown after order is placed)" },
        { label: "Reference", value: orderNumber, copy: true },
        amountLine,
      ],
    },
  };
  const d = details[method];
  return (
    <div className="mt-4 p-4 rounded-md bg-bg border border-border">
      <p className="text-[13px] font-semibold">{d.title}</p>
      <dl className="mt-2 space-y-1 text-[12.5px]">
        {d.lines.map((l, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3">
            <dt className="text-fg-muted shrink-0">{l.label}</dt>
            <dd
              className={`font-mono tnum text-right break-all ${l.copy ? "select-all" : ""}`}
            >
              {l.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
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
