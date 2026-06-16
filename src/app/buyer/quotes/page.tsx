import Link from "next/link";
import { requireUser } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  sourced: "bg-violet-100 text-violet-800 border-violet-200",
  quoted: "bg-cyan-100 text-cyan-800 border-cyan-200",
  confirmed: "bg-cyan-50 text-cyan-800 border-cyan-200",
  paid: "bg-cyan-50 text-cyan-800 border-cyan-200",
  shipped: "bg-cyan-100 text-cyan-800 border-cyan-200",
  delivered: "bg-emerald-200 text-emerald-900 border-emerald-300",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

async function loadQuotes(userId: string) {
  const supabase = getServiceRoleClient();
  const { data } = await supabase
    .from("quotes")
    .select(
      "id,quote_id,product_ids,total_qty,total_bdt,shipping_mode,status,created_at,expires_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  // `quotes` is a legacy table; `id` is `uuid` in the live schema
  // but the page only uses it as a React key, so we cast through
  // `unknown` to keep the local `id: number` type.
  return (data ?? []) as unknown as Array<{
    id: number;
    quote_id: string;
    product_ids: string[];
    total_qty: number;
    total_bdt: number;
    shipping_mode: string;
    status: string;
    created_at: string;
    expires_at: string;
  }>;
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

export default async function BuyerQuotesPage() {
  const user = await requireUser("/buyer");
  const quotes = await loadQuotes(user.id);
  return (
    <div className="p-6 md:p-8 max-w-7xl">
      <div className="mb-8">
        <p className="text-[12px] font-medium tracking-wider uppercase text-fg-subtle">
          Buying
        </p>
        <h1 className="mt-2 text-[32px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.02em]">
          My quotes
        </h1>
        <p className="mt-3 text-[14px] text-fg-muted">
          Every quote request you've made. Click into one to see the full
          breakdown or download as PDF.
        </p>
      </div>

      {quotes.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-[14px] text-fg-muted mb-4">
            You haven't requested any quotes yet.
          </p>
          <Link
            href="/categories"
            className="inline-block px-4 py-2 text-[13px] rounded-md bg-cyan-600 text-white hover:bg-cyan-700 font-medium"
          >
            Browse catalog
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3">Quote ID</th>
                <th className="text-left font-medium px-4 py-3">Created</th>
                <th className="text-left font-medium px-4 py-3">Products</th>
                <th className="text-right font-medium px-4 py-3">Qty</th>
                <th className="text-left font-medium px-4 py-3">Mode</th>
                <th className="text-right font-medium px-4 py-3">Total BDT</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-left font-medium px-4 py-3">Expires</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr
                  key={q.id}
                  className="border-b border-border last:border-b-0 hover:bg-bg-soft"
                >
                  <td className="px-4 py-3 font-mono tnum text-[12px]">
                    {q.quote_id}
                  </td>
                  <td className="px-4 py-3 font-mono tnum text-[12px] text-fg-muted">
                    {fmtDate(q.created_at)}
                  </td>
                  <td className="px-4 py-3 text-[12px]">
                    <div className="flex flex-wrap gap-1">
                      {q.product_ids.slice(0, 3).map((p) => (
                        <a
                          key={p}
                          href={`/products/${p}`}
                          className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-bg-soft hover:bg-bg"
                        >
                          {p}
                        </a>
                      ))}
                      {q.product_ids.length > 3 && (
                        <span className="text-[11px] text-fg-subtle">
                          +{q.product_ids.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tnum">
                    {q.total_qty}
                  </td>
                  <td className="px-4 py-3 text-[12px] uppercase tracking-wider text-fg-muted">
                    {q.shipping_mode}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tnum font-semibold">
                    ৳{q.total_bdt.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border rounded ${
                        STATUS_COLORS[q.status] ??
                        "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono tnum text-[12px] text-fg-muted">
                    {new Date(q.expires_at).toLocaleDateString("en-GB", {
                      month: "short",
                      day: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
