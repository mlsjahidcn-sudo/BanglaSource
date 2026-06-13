import Link from "next/link";
import { requireUser } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { fmtBdt } from "@/lib/pricing";
import { dict } from "@/lib/i18n-dict";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrderRow = {
  id: number;
  status: "pending_payment" | "paid" | "in_transit" | "delivered" | "cancelled";
  shipping_mode: "air" | "sea";
  product_subtotal_bdt: number;
  shipping_bdt: number;
  duty_bdt: number;
  vat_bdt: number;
  ait_bdt: number;
  total_bdt: number;
  deposit_bdt: number;
  balance_bdt: number;
  created_at: string;
};

const STATUS_TONE: Record<OrderRow["status"], string> = {
  pending_payment: "bg-amber-50 text-amber-800 border-amber-200",
  paid: "bg-cyan-50 text-cyan-800 border-cyan-200",
  in_transit: "bg-violet-50 text-violet-800 border-violet-200",
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default async function BuyerOrdersPage() {
  const user = await requireUser("/buyer/orders");
  const sb = getServiceRoleClient();
  const { data: orders, error } = await sb
    .from("orders")
    .select(
      "id, status, shipping_mode, product_subtotal_bdt, shipping_bdt, duty_bdt, vat_bdt, ait_bdt, total_bdt, deposit_bdt, balance_bdt, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="p-6 md:p-8 max-w-5xl">
        <p className="text-red-600 text-[14px]">Error: {error.message}</p>
      </div>
    );
  }

  const list = (orders ?? []) as OrderRow[];

  return (
    <div className="p-6 md:p-8 max-w-7xl">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[12px] font-medium tracking-wider uppercase text-fg-subtle">
            Buyer portal
          </p>
          <h1 className="mt-2 text-[32px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.02em]">
            My orders
          </h1>
          <p className="mt-3 text-[14px] text-fg-muted max-w-2xl">
            Every order you place. Tap one to see the payment instructions,
            itemised total, and tracking.
          </p>
        </div>
        <Link
          href="/cart"
          className="hidden sm:inline-block text-[12.5px] text-emerald-600 hover:text-emerald-700 font-medium"
        >
          Build a new order →
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="card p-8 text-center">
          <h3 className="text-[16px] font-semibold">No orders yet</h3>
          <p className="mt-1.5 text-[13px] text-fg-muted">
            Start by adding products to your order list, then come back here
            to check out.
          </p>
          <Link
            href="/categories"
            className="mt-5 inline-block px-4 py-2 text-[13px] rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
          >
            Browse the catalog
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3">Order</th>
                <th className="text-left font-medium px-4 py-3">Date</th>
                <th className="text-left font-medium px-4 py-3">Mode</th>
                <th className="text-right font-medium px-4 py-3">Total</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const num = `BS-${String(o.id).padStart(6, "0")}`;
                return (
                  <tr
                    key={o.id}
                    className="border-b border-border last:border-b-0 hover:bg-bg-soft"
                  >
                    <td className="px-4 py-2.5 font-mono tnum text-[12.5px]">
                      <Link
                        href={`/orders/${o.id}`}
                        className="hover:underline text-fg"
                      >
                        {num}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono tnum text-[12px] text-fg-muted">
                      {fmtDate(o.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-[11.5px] uppercase tracking-wider text-fg-muted">
                      {o.shipping_mode}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum font-semibold">
                      {fmtBdt(o.total_bdt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border rounded ${STATUS_TONE[o.status]}`}
                      >
                        {dict[`order.status.${o.status}` as keyof typeof dict]?.en ?? o.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
