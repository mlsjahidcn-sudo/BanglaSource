import { getServiceRoleClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type QuoteRow = {
  id: number;
  user_id: string;
  source_id: string | null;
  qty: number;
  mode: string;
  unit_cny_fen: number;
  total_cny_fen: number;
  total_bdt: number;
  transit_days: string;
  status: string;
  notes: string | null;
  created_at: string;
};

async function loadQuotes() {
  const supabase = getServiceRoleClient();
  const { data } = await supabase
    .from("quotes")
    .select(
      "id,user_id,source_id,qty,mode,unit_cny_fen,total_cny_fen,total_bdt,transit_days,status,notes,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,email,full_name,company,country");
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  return {
    quotes: (data ?? []) as QuoteRow[],
    profileMap,
  };
}

function fmtCny(fen: number) {
  return `¥${(fen / 100).toFixed(2)}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  shipped: "bg-cyan-100 text-cyan-800 border-cyan-200",
  delivered: "bg-emerald-200 text-emerald-900 border-emerald-300",
  sourced: "bg-violet-100 text-violet-800 border-violet-200",
  quoted: "bg-cyan-100 text-cyan-800 border-cyan-200",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200",
};

export default async function OpsQuotesPage() {
  const { quotes, profileMap } = await loadQuotes();
  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Inbound"
        title="Quote requests"
        dotColor="violet"
        subtitle={<>Users who clicked <em>Request quote</em> in the cart. Most recent first.</>}
      />

      <div className="card overflow-hidden">
        {quotes.length === 0 ? (
          <div className="p-6 text-[13px] text-fg-muted">
            No quote requests yet.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3">Created</th>
                <th className="text-left font-medium px-4 py-3">Customer</th>
                <th className="text-left font-medium px-4 py-3">Product</th>
                <th className="text-right font-medium px-4 py-3">Qty</th>
                <th className="text-left font-medium px-4 py-3">Mode</th>
                <th className="text-right font-medium px-4 py-3">Unit</th>
                <th className="text-right font-medium px-4 py-3">Total BDT</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const profile = profileMap.get(q.user_id);
                return (
                  <tr
                    key={q.id}
                    className="border-b border-border last:border-b-0 hover:bg-bg-soft"
                  >
                    <td className="px-4 py-2.5 font-mono tnum text-[12px]">
                      {fmtDate(q.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-[12px]">
                      <div className="text-fg">
                        {profile?.full_name ?? "—"}
                      </div>
                      <div className="text-fg-muted text-[11px] font-mono tnum">
                        {profile?.email ?? q.user_id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono tnum text-[12px]">
                      {q.source_id ? (
                        <a
                          href={`/products/${q.source_id}`}
                          className="hover:underline"
                        >
                          {q.source_id}
                        </a>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum">
                      {q.qty}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] uppercase tracking-wider text-fg-muted">
                      {q.mode}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum text-[12px]">
                      {fmtCny(q.unit_cny_fen)}
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminPage>
  );
}
