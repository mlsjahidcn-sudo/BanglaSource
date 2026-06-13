import Link from "next/link";
import { requireUser } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadDashboard(userId: string, userName: string) {
  const supabase = getServiceRoleClient();
  const [quotes, totalQuotes, totalQty, totalBdt, totalOrders, recentOrders] =
    await Promise.all([
      supabase
        .from("quotes")
        .select(
          "id,quote_id,product_ids,total_qty,total_bdt,shipping_mode,status,created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("quotes")
        .select("total_qty")
        .eq("user_id", userId),
      supabase
        .from("quotes")
        .select("total_bdt")
        .eq("user_id", userId),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("orders")
        .select("id, status, total_bdt, paid_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
  const sumQty = (totalQty.data ?? []).reduce(
    (s, r) => s + (r.total_qty ?? 0),
    0,
  );
  const sumBdt = (totalBdt.data ?? []).reduce(
    (s, r) => s + (r.total_bdt ?? 0),
    0,
  );
  return {
    quotes: (quotes.data ?? []) as Array<{
      id: number;
      quote_id: string;
      product_ids: string[];
      total_qty: number;
      total_bdt: number;
      shipping_mode: string;
      status: string;
      created_at: string;
    }>,
    totalQuotes: totalQuotes.count ?? 0,
    sumQty,
    sumBdt,
    userName,
    totalOrders: totalOrders.count ?? 0,
      recentOrders: (recentOrders.data ?? []) as Array<{
      id: number;
      status: string;
      total_bdt: number;
      created_at: string;
    }>,
  };
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  sourced: "bg-violet-100 text-violet-800 border-violet-200",
  quoted: "bg-cyan-100 text-cyan-800 border-cyan-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
  shipped: "bg-cyan-100 text-cyan-800 border-cyan-200",
  delivered: "bg-emerald-200 text-emerald-900 border-emerald-300",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default async function BuyerDashboard() {
  const user = await requireUser("/buyer");
  const d = await loadDashboard(user.id, user.fullName ?? user.email);
  const firstName = d.userName.split(/\s+/)[0] || d.userName;
  return (
    <div className="p-6 md:p-8 max-w-7xl">
      <div className="mb-8">
        <p className="text-[12px] font-medium tracking-wider uppercase text-fg-subtle">
          Buyer portal
        </p>
        <h1 className="mt-2 text-[32px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.02em]">
          Hello, {firstName}
        </h1>
        <p className="mt-3 text-[14px] text-fg-muted">
          {d.totalQuotes > 0
            ? `You have ${d.totalQuotes} quote${
                d.totalQuotes === 1 ? "" : "s"
              } on file. Total ${d.sumQty.toLocaleString()} units across all of them.`
            : "Start by browsing the catalog and adding products to your order list."}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
        <Card label="My quotes" value={d.totalQuotes} sub="total on file" />
        <Card
          label="Total units"
          value={d.sumQty.toLocaleString()}
          sub="across all quotes"
        />
        <Card
          label="Total value"
          value={`৳${(d.sumBdt / 1000).toFixed(1)}k`}
          sub="BDT, all quotes"
        />
        <Card
          label="Account"
          value={user.country ?? "—"}
          sub={user.email}
        />
      </div>

      {/* Quick actions */}
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <QuickLink
          href="/categories"
          label="Browse catalog"
          desc="1,200+ verified products, all-in BDT price."
        />
        <QuickLink
          href="/cart"
          label="Build an order"
          desc="Add to cart, get landed cost, request quote."
        />
        <QuickLink
          href="/buyer/orders"
          label="My orders"
          desc="Track active orders, see payment instructions."
        />
        <QuickLink
          href="/buyer/quotes"
          label="View my quotes"
          desc="All quote requests, with status updates."
        />
        <QuickLink
          href="/buyer/rfqs"
          label="Request custom RFQ"
          desc="Need 5,000 units of something not in catalog?"
        />
        <QuickLink
          href="/buyer/addresses"
          label="Manage addresses"
          desc="Save Dhaka, Guangzhou, Chittagong addresses."
        />
        <QuickLink
          href="/buyer/profile"
          label="Update profile"
          desc="Phone, company, country, account settings."
        />
      </div>

      {/* Recent quotes */}
      <section className="mt-10">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-[18px] font-semibold tracking-tight">Recent quotes</h2>
          {d.quotes.length > 0 && (
            <Link
              href="/buyer/quotes"
              className="text-[12px] text-fg-muted hover:text-fg"
            >
              View all →
            </Link>
          )}
        </div>
        {d.quotes.length === 0 ? (
          <div className="card p-6 text-[13px] text-fg-muted">
            You haven't requested any quotes yet.{" "}
            <Link
              href="/categories"
              className="text-fg underline hover:no-underline"
            >
              Browse the catalog
            </Link>{" "}
            to get started.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Quote ID</th>
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-right font-medium px-4 py-3">Qty</th>
                  <th className="text-right font-medium px-4 py-3">Mode</th>
                  <th className="text-right font-medium px-4 py-3">Total</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.quotes.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-border last:border-b-0 hover:bg-bg-soft"
                  >
                    <td className="px-4 py-2.5 font-mono tnum text-[12px]">
                      {q.quote_id}
                    </td>
                    <td className="px-4 py-2.5 font-mono tnum text-[12px] text-fg-muted">
                      {fmtDate(q.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum">
                      {q.total_qty}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] uppercase tracking-wider text-fg-muted">
                      {q.shipping_mode}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum">
                      ৳{q.total_bdt.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border rounded ${
                          STATUS_COLORS[q.status] ??
                          "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent orders */}
      {d.recentOrders.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-[18px] font-semibold tracking-tight">Recent orders</h2>
            <Link
              href="/buyer/orders"
              className="text-[12px] text-fg-muted hover:text-fg"
            >
              View all →
            </Link>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
                <tr>
                <th className="text-left font-medium px-4 py-3">Order</th>
                <th className="text-left font-medium px-4 py-3">Date</th>
                <th className="text-right font-medium px-4 py-3">Total</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.recentOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-border last:border-b-0 hover:bg-bg-soft"
                  >
                    <td className="px-4 py-2.5 font-mono tnum text-[12.5px]">
                      <Link href={`/orders/${o.id}`} className="hover:underline text-fg">
                        BS-{String(o.id).padStart(6, "0")}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono tnum text-[12px] text-fg-muted">
                      {fmtDate(o.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum font-semibold">
                      ৳{Math.round(o.total_bdt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border rounded ${
                          STATUS_COLORS[o.status] ??
                          "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {o.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub: string;
}) {
  return (
    <div className="bg-bg p-4 md:p-5">
      <p className="text-[10px] font-medium tracking-wider uppercase text-fg-subtle">
        {label}
      </p>
      <p className="mt-1.5 text-[24px] md:text-[28px] font-semibold leading-none font-mono tnum">
        {value}
      </p>
      <p className="mt-2 text-[11px] text-fg-muted truncate">{sub}</p>
    </div>
  );
}

function QuickLink({
  href,
  label,
  desc,
}: {
  href: string;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="card p-5 hover:border-border-strong transition-colors group"
    >
      <h3 className="text-[14px] font-semibold tracking-tight group-hover:underline">
        {label}
      </h3>
      <p className="mt-1 text-[12px] text-fg-muted leading-relaxed">{desc}</p>
    </Link>
  );
}
