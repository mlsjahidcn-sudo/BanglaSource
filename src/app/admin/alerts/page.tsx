import { getServiceRoleClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AlertRow = {
  id: number;
  source_id: string;
  qty_min: number;
  qty_max: number | null;
  old_price_cny_fen: number;
  new_price_cny_fen: number;
  change_pct: number;
  direction: "rise" | "drop";
  detected_at: string;
  acknowledged_at: string | null;
};

async function loadAlerts() {
  const supabase = getServiceRoleClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("price_alert_log")
    .select(
      "id,source_id,qty_min,qty_max,old_price_cny_fen,new_price_cny_fen,change_pct,direction,detected_at,acknowledged_at",
    )
    .gte("detected_at", since)
    .order("detected_at", { ascending: false })
    .limit(100);
  return (data ?? []) as AlertRow[];
}

function fmtFen(fen: number) {
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

export default async function OpsAlertsPage() {
  const rows = await loadAlerts();
  const open = rows.filter((r) => !r.acknowledged_at);
  const acked = rows.filter((r) => r.acknowledged_at);
  const totalRise = rows.filter((r) => r.direction === "rise").length;
  const totalDrop = rows.filter((r) => r.direction === "drop").length;
  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Alerts"
        title="Price alerts"
        dotColor="rose"
        subtitle="Tier moves >15% in the last 7 days. Deduplicated per product + tier. Daily 04:30 UTC cron."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
        <Card label="Open" value={open.length} sub="unacknowledged" />
        <Card label="Acknowledged" value={acked.length} sub="last 7d" />
        <Card label="Rises" value={totalRise} sub=">15% increases" />
        <Card label="Drops" value={totalDrop} sub=">15% decreases" />
      </div>

      <section className="mt-10">
        <h2 className="text-[18px] font-semibold tracking-tight mb-4">
          Recent alerts
        </h2>
        {rows.length === 0 ? (
          <div className="card p-6 text-[13px] text-fg-muted">
            No price alerts in the last 7 days.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
                <tr>
                  <th className="text-left font-medium px-4 py-3">When</th>
                  <th className="text-left font-medium px-4 py-3">Product</th>
                  <th className="text-left font-medium px-4 py-3">Tier</th>
                  <th className="text-left font-medium px-4 py-3">Direction</th>
                  <th className="text-right font-medium px-4 py-3">Δ</th>
                  <th className="text-right font-medium px-4 py-3">Old → New</th>
                  <th className="text-right font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-border last:border-b-0 hover:bg-bg-soft"
                  >
                    <td className="px-4 py-2.5 font-mono tnum text-[12px]">
                      {fmtDate(a.detected_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <a
                        href={`/admin/products/${a.source_id}`}
                        className="hover:underline"
                      >
                        {a.source_id}
                      </a>
                    </td>
                    <td className="px-4 py-2.5 font-mono tnum text-[12px]">
                      {a.qty_min}
                      {a.qty_max ? `–${a.qty_max}` : "+"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 ${
                          a.direction === "rise"
                            ? "text-rose-600"
                            : "text-cyan-700"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            a.direction === "rise"
                              ? "bg-rose-500"
                              : "bg-emerald-500"
                          }`}
                        />
                        {a.direction}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono tnum ${
                        a.direction === "rise"
                          ? "text-rose-600"
                          : "text-cyan-700"
                      }`}
                    >
                      {(a.change_pct > 0 ? "+" : "") + a.change_pct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum text-[12px]">
                      {fmtFen(a.old_price_cny_fen)} → {fmtFen(a.new_price_cny_fen)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[11px] text-fg-muted">
                      {a.acknowledged_at
                        ? `acked ${fmtDate(a.acknowledged_at)}`
                        : "open"}
                    </td>
                  </tr>
                ))}
               </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPage>
  );
}

function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
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
      <p className="mt-2 text-[11px] text-fg-muted">{sub}</p>
    </div>
  );
}
