// /admin/orders/[id]
//
// Phase 17: admin order detail.
//
// Server-rendered. Shows the order header (BS-000123, status, dates,
// landed cost breakdown), the line items, the buyer address snapshot,
// and the order-actions form (status / tracking / internal note).
//
// All writes go through PATCH /api/admin/orders/[id] from the
// client-side OrderStatusForm.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { AdminPage } from "@/components/admin-page";
import { OrderStatusForm } from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrderStatus =
  | "pending_payment"
  | "paid"
  | "in_transit"
  | "delivered"
  | "cancelled";

type OrderRow = {
  id: number;
  user_id: string;
  status: OrderStatus;
  shipping_mode: "air" | "sea";
  product_subtotal_bdt: number;
  shipping_bdt: number;
  duty_bdt: number;
  vat_bdt: number;
  ait_bdt: number;
  total_bdt: number;
  deposit_bdt: number;
  balance_bdt: number;
  payment_model: "full_prepay" | "deposit_balance";
  payment_method: "bkash" | "bank" | "cod" | "usdt";
  paid_at: string | null;
  tracking_number: string | null;
  internal_note: string | null;
  buyer_note: string | null;
  address_snapshot: any;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  id: number;
  qty: number;
  title_snapshot: string;
  image_snapshot: string | null;
  unit_bdt: number;
  line_bdt: number;
  unit_cny_fen: number;
  markup_pct: number;
  weight_kg: number;
  position: number;
  products: { source_id: string; images: string[] | null } | null;
};

const STATUS_TONE: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-50 text-amber-800 border-amber-200",
  paid: "bg-cyan-50 text-cyan-800 border-cyan-200",
  in_transit: "bg-violet-50 text-violet-800 border-violet-200",
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  paid: "Paid",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const PAYMENT_LABEL: Record<string, string> = {
  bkash: "bKash",
  bank: "Bank transfer",
  cod: "Cash on delivery",
  usdt: "USDT",
};

function fmtBdt(n: number) {
  return `৳${n.toLocaleString("en-IN")}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtOrderNum(id: number) {
  return `BS-${String(id).padStart(6, "0")}`;
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin(`/admin/orders/[id]`);
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) notFound();

  const sb = getServiceRoleClient();
  const { data: order, error: oErr } = await sb
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (oErr || !order) notFound();

  // Resolve profile (orders.user_id is auth.users, not profiles)
  const { data: profile } = await sb
    .from("profiles")
    .select("id, email, full_name, company, country, phone")
    .eq("id", order.user_id)
    .maybeSingle();

  // Fetch items + joined product
  const { data: itemsRaw } = await sb
    .from("order_items")
    .select(
      "id, qty, title_snapshot, image_snapshot, unit_bdt, line_bdt, unit_cny_fen, markup_pct, weight_kg, position, products(source_id, images)",
    )
    .eq("order_id", orderId)
    .order("position", { ascending: true });
  const items: OrderItemRow[] = (itemsRaw ?? []) as any[];

  const o = order as OrderRow;
  const totalWeightKg = items.reduce(
    (s, it) => s + Number(it.weight_kg) * it.qty,
    0,
  );

  return (
    <AdminPage size="wide">
      {/* Breadcrumb */}
      <div className="mb-3 text-[12px] text-fg-subtle font-mono tnum">
        <Link href="/admin" className="hover:text-fg">
          admin
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <Link href="/admin/orders" className="hover:text-fg">
          orders
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <span className="text-fg-muted">{fmtOrderNum(o.id)}</span>
      </div>

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="flex items-end gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mb-3" />
            <p className="text-[12px] font-medium tracking-wider uppercase text-emerald-700">
              Inbound
            </p>
          </div>
          <h1 className="mt-3 text-[32px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.02em] font-mono">
            {fmtOrderNum(o.id)}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px] text-fg-muted">
            <span
              className={`text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border rounded ${STATUS_TONE[o.status]}`}
            >
              {STATUS_LABEL[o.status]}
            </span>
            <span>
              Placed{" "}
              <span className="text-fg font-mono tnum">
                {fmtDate(o.created_at)}
              </span>
            </span>
            {o.paid_at && (
              <span>
                · Paid{" "}
                <span className="text-fg font-mono tnum">
                  {fmtDate(o.paid_at)}
                </span>
              </span>
            )}
            <span>
              ·{" "}
              {o.shipping_mode === "air" ? "Air freight" : "Sea LCL"} ·{" "}
              {PAYMENT_LABEL[o.payment_method] ?? o.payment_method}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">
            Landed total
          </p>
          <p className="mt-1 text-[28px] md:text-[32px] font-semibold font-mono tnum leading-none">
            {fmtBdt(o.total_bdt)}
          </p>
          <p className="mt-1.5 text-[11px] text-fg-subtle">
            {o.payment_model === "full_prepay"
              ? "Full prepayment"
              : "70/30 deposit+balance (legacy)"}
          </p>
        </div>
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main column: items + cost breakdown ───────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line items */}
          <section className="card overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="text-[14px] font-semibold">
                Line items · {items.length}{" "}
                {items.length === 1 ? "line" : "lines"} ·{" "}
                {items.reduce((s, it) => s + it.qty, 0)} pcs ·{" "}
                {totalWeightKg.toFixed(2)} kg
              </h2>
            </div>
            {items.length === 0 ? (
              <div className="p-6 text-[13px] text-fg-muted">
                This order has no line items. (Shouldn't happen — the
                checkout RPC inserts order + items atomically.)
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="text-[10.5px] uppercase tracking-wider text-fg-subtle border-b border-border">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">Item</th>
                    <th className="text-right font-medium px-4 py-2.5">Qty</th>
                    <th className="text-right font-medium px-4 py-2.5">
                      Unit
                    </th>
                    <th className="text-right font-medium px-4 py-2.5">
                      Line
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-4 py-3 max-w-[300px]">
                        <div className="flex items-center gap-2.5">
                          {it.image_snapshot ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.image_snapshot}
                              alt=""
                              className="w-10 h-10 rounded object-cover border border-border shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-bg-soft border border-border shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-[12.5px] truncate">
                              {it.title_snapshot}
                            </div>
                            {it.products?.source_id ? (
                              <Link
                                href={`/admin/products/${it.products.source_id}`}
                                className="text-[10.5px] text-fg-muted font-mono tnum hover:text-cyan-700"
                              >
                                {it.products.source_id}
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tnum text-[12.5px]">
                        {it.qty}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tnum text-[12.5px]">
                        {fmtBdt(it.unit_bdt)}
                        <div className="text-[10px] text-fg-subtle">
                          {Number(it.markup_pct).toFixed(0)}% mkp
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tnum text-[12.5px] font-semibold">
                        {fmtBdt(it.line_bdt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Cost breakdown */}
          <section className="card p-5 space-y-3">
            <h2 className="text-[14px] font-semibold">Landed cost breakdown</h2>
            <Row label="Product subtotal" value={fmtBdt(o.product_subtotal_bdt)} />
            <Row label="Shipping" value={fmtBdt(o.shipping_bdt)} />
            <Row label="Customs duty" value={fmtBdt(o.duty_bdt)} />
            <Row label="VAT 15%" value={fmtBdt(o.vat_bdt)} />
            <Row label="AIT 5%" value={fmtBdt(o.ait_bdt)} />
            <div className="pt-3 mt-1 border-t border-border flex items-center justify-between">
              <span className="text-[13px] font-semibold">Landed total</span>
              <span className="text-[18px] font-semibold font-mono tnum">
                {fmtBdt(o.total_bdt)}
              </span>
            </div>
            <div className="text-[10.5px] text-fg-subtle pt-1">
              Full-prepayment model: buyer paid {fmtBdt(o.deposit_bdt)}{" "}
              upfront; {fmtBdt(o.balance_bdt)} due on delivery.
            </div>
          </section>

          {/* Buyer note */}
          {o.buyer_note && (
            <section className="card p-5">
              <h2 className="text-[14px] font-semibold mb-2">Buyer note</h2>
              <p className="text-[13px] text-fg-muted leading-relaxed whitespace-pre-wrap">
                {o.buyer_note}
              </p>
            </section>
          )}
        </div>

        {/* ── Side column: actions + buyer + address ────────── */}
        <div className="space-y-6">
          <OrderStatusForm
            orderId={o.id}
            currentStatus={o.status}
            currentTracking={o.tracking_number}
            currentInternalNote={o.internal_note}
            buyerEmail={profile?.email ?? null}
          />

          {/* Buyer */}
          <section className="card p-5 space-y-2">
            <h2 className="text-[14px] font-semibold">Buyer</h2>
            <p className="text-[13px] font-medium">
              {profile?.full_name ?? "—"}
            </p>
            <p className="text-[12px] text-fg-muted font-mono tnum">
              {profile?.email ?? "—"}
            </p>
            {profile?.company && (
              <p className="text-[12px] text-fg-muted">
                {profile.company}
                {profile.country ? ` · ${profile.country}` : ""}
              </p>
            )}
            {profile?.phone && (
              <p className="text-[12px] text-fg-muted font-mono tnum">
                {profile.phone}
              </p>
            )}
            <Link
              href={`/admin/users?q=${encodeURIComponent(profile?.email ?? "")}`}
              className="text-[11.5px] text-cyan-700 hover:underline mt-1 inline-block"
            >
              View all orders from this buyer →
            </Link>
          </section>

          {/* Delivery address snapshot */}
          <section className="card p-5 space-y-2">
            <h2 className="text-[14px] font-semibold">Delivery address</h2>
            {o.address_snapshot ? (
              <div className="text-[12.5px] leading-relaxed">
                <p className="font-medium">
                  {(o.address_snapshot as any).full_name}
                </p>
                <p>{(o.address_snapshot as any).address_line}</p>
                <p className="text-fg-muted">
                  {(o.address_snapshot as any).district}
                  {(o.address_snapshot as any).country
                    ? `, ${(o.address_snapshot as any).country}`
                    : ""}
                </p>
                <p className="text-fg-muted font-mono tnum text-[11.5px]">
                  📞 {(o.address_snapshot as any).phone}
                </p>
              </div>
            ) : (
              <p className="text-[12.5px] text-fg-muted">
                No delivery address on file.
              </p>
            )}
          </section>

          {/* Meta */}
          <section className="card p-5 space-y-1.5 text-[12px]">
            <h2 className="text-[14px] font-semibold mb-2">Meta</h2>
            <Meta label="Order ID" value={fmtOrderNum(o.id)} mono />
            <Meta label="Auth user ID" value={o.user_id} mono />
            <Meta label="Created" value={fmtDate(o.created_at)} />
            <Meta label="Updated" value={fmtDate(o.updated_at)} />
            <Meta label="Payment" value={PAYMENT_LABEL[o.payment_method] ?? o.payment_method} />
            <Meta
              label="Model"
              value={
                o.payment_model === "full_prepay"
                  ? "Full prepayment"
                  : "70/30 deposit+balance (legacy)"
              }
            />
            <Meta
              label="Tracking"
              value={o.tracking_number ?? "—"}
              mono
            />
          </section>
        </div>
      </div>
    </AdminPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span className="text-fg-muted">{label}</span>
      <span className="font-mono tnum">{value}</span>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-fg-subtle text-[10.5px] uppercase tracking-wider font-medium">
        {label}
      </span>
      <span
        className={`${mono ? "font-mono tnum" : ""} text-fg-muted max-w-[200px] truncate`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
