// /admin/group-buys
//
// Phase 37: admin Group Buy list. Server-rendered, sorted by
// deadline (the soonest expiring first), with status filter +
// progress column showing the buyer's "current/target" qty.
//
// Filters (URL query params, server-side):
//   ?status=open|forming|formed|expired|cancelled (default: all)
//   ?since=7d|30d|all (default: all)
//
// Each row links to /admin/group-buys/[id] for the detail + member
// management view.

import Link from "next/link";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/portal-auth";
import { AdminPage, AdminPageHeader } from "@/components/admin-page";
import { fmtBdt, groupBuyPriceAtQty, type GroupBuyPriceTier } from "@/lib/pricing";
import { groupBuyNavCounts } from "@/lib/admin-nav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type GBStatus = "open" | "forming" | "formed" | "expired" | "cancelled";

const STATUS_LABEL: Record<GBStatus, string> = {
  open: "Open",
  forming: "Charging",
  formed: "Formed",
  expired: "Expired",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<
  GBStatus,
  { pill: string; dot: string }
> = {
  open:      { pill: "is-cyan",    dot: "bg-cyan-500" },
  forming:   { pill: "is-info",    dot: "bg-violet-500" },
  formed:    { pill: "is-success", dot: "bg-emerald-500" },
  expired:   { pill: "is-warning", dot: "bg-amber-500" },
  cancelled: { pill: "is-neutral", dot: "bg-slate-400" },
};

const STATUS_OPTIONS: { key: GBStatus | "all"; label: string }[] = [
  { key: "all", label: "All statuses" },
  { key: "open", label: "Open" },
  { key: "forming", label: "Charging" },
  { key: "formed", label: "Formed" },
  { key: "expired", label: "Expired" },
  { key: "cancelled", label: "Cancelled" },
];

const SINCE_OPTIONS = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
] as const;
type SinceKey = (typeof SINCE_OPTIONS)[number]["key"];

function sinceStart(since: SinceKey): string | null {
  if (since === "all") return null;
  const days = since === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 86400_000).toISOString();
}

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "passed";
  const days = Math.floor(ms / 86400_000);
  const hours = Math.floor((ms % 86400_000) / 3600_000);
  if (days >= 2) return `${days}d`;
  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h`;
  const mins = Math.floor(ms / 60_000);
  return `${Math.max(mins, 0)}m`;
}

export default async function AdminGroupBuysPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; since?: string }>;
}) {
  const sp = await searchParams;
  const status = (sp.status ?? "all") as GBStatus | "all";
  const since = (sp.since ?? "all") as SinceKey;
  await requireAdmin("/admin/group-buys");

  const sb = getServiceRoleClient();
  const sinceIso = sinceStart(since);

  let q = sb
    .from("group_buys")
    .select(
      "id, product_id, target_qty, min_qty_per_buyer, price_tiers, deadline_at, status, final_unit_bdt, created_at, updated_at, products(source_id, title_en, images)",
    )
    .order("deadline_at", { ascending: true })
    .limit(200);
  if (status !== "all") q = q.eq("status", status);
  if (sinceIso) q = q.gte("created_at", sinceIso);

  const { data: groups, error } = await q;
  if (error) {
    return (
      <AdminPage>
        <p className="text-red-700">Failed to load: {error.message}</p>
      </AdminPage>
    );
  }

  // For each group, fetch the SUM of member qty (current progress)
  const ids = (groups ?? []).map((g) => g.id);
  let progressByGroup = new Map<string, { qty: number; buyers: number }>();
  if (ids.length > 0) {
    const { data: memberRows } = await sb
      .from("group_buy_members")
      .select("group_buy_id, qty, payment_state")
      .in("group_buy_id", ids);
    for (const m of memberRows ?? []) {
      const cur = progressByGroup.get(m.group_buy_id) ?? { qty: 0, buyers: 0 };
      cur.qty += m.qty;
      cur.buyers += 1;
      progressByGroup.set(m.group_buy_id, cur);
    }
  }

  // Counts for the sidebar badge
  const navCounts = await groupBuyNavCounts(sb);

  return (
    <AdminPage size="wide">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Group buys"
        dotColor="cyan"
        subtitle="Pay-on-success bulk deals. Buyers commit a qty; when the group's target is met by the deadline, every member is charged at the final tiered price."
        actions={
          <Link
            href="/admin/group-buys/new"
            className="h-9 px-4 text-[13px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700 inline-flex items-center"
          >
            + Create group buy
          </Link>
        }
      />

      {/* Filter row */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-fg-subtle font-medium mb-1.5">
            Status
          </label>
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <Link
                key={opt.key}
                href={`/admin/group-buys?status=${opt.key}&since=${since}`}
                className={`h-9 px-3 text-[12.5px] rounded-md border inline-flex items-center transition-colors ${
                  status === opt.key
                    ? "bg-cyan-600 text-white border-cyan-600"
                    : "bg-bg text-fg-muted border-border hover:border-border-strong"
                }`}
              >
                {opt.label}
                {opt.key !== "all" && (
                  <span className="ml-1.5 text-[10.5px] font-mono tnum opacity-75">
                    ({navCounts[opt.key as keyof typeof navCounts] ?? 0})
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-fg-subtle font-medium mb-1.5">
            Since
          </label>
          <div className="flex gap-1">
            {SINCE_OPTIONS.map((opt) => (
              <Link
                key={opt.key}
                href={`/admin/group-buys?status=${status}&since=${opt.key}`}
                className={`h-9 px-3 text-[12.5px] rounded-md border inline-flex items-center transition-colors ${
                  since === opt.key
                    ? "bg-cyan-600 text-white border-cyan-600"
                    : "bg-bg text-fg-muted border-border hover:border-border-strong"
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden bg-bg">
        {groups && groups.length > 0 ? (
          <table className="table-pro">
            <thead>
              <tr>
                <th>Product</th>
                <th className="col-num">Progress</th>
                <th className="col-num">Min / Target</th>
                <th className="col-num">Current price</th>
                <th>Deadline</th>
                <th>Status</th>
                <th className="col-actions">Open</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const tiers = (g.price_tiers as unknown as GroupBuyPriceTier[]) ?? [];
                const progress = progressByGroup.get(g.id) ?? { qty: 0, buyers: 0 };
                const pct = g.target_qty > 0
                  ? Math.min(100, Math.round((progress.qty / g.target_qty) * 100))
                  : 0;
                const currentPrice = groupBuyPriceAtQty(tiers, progress.qty);
                const tone = STATUS_TONE[g.status as GBStatus] ?? STATUS_TONE.cancelled;
                const productInfo = (g as unknown as { products?: { source_id?: string; title_en?: string; images?: string[] } | null }).products;
                return (
                  <tr key={g.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {productInfo?.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={productInfo.images[0]}
                            alt=""
                            className="w-9 h-9 rounded border border-border object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded border border-border bg-slate-50 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium truncate max-w-[280px]">
                            {productInfo?.title_en ?? `Product #${g.product_id}`}
                          </p>
                          <p className="text-[11px] text-fg-subtle font-mono tnum">
                            {productInfo?.source_id ?? `gb-${g.id.slice(0, 8)}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="col-num">
                      <div className="font-mono tnum">
                        {progress.qty.toLocaleString()} / {g.target_qty.toLocaleString()}
                      </div>
                      <div className="mt-1 h-1 w-24 bg-slate-100 rounded overflow-hidden">
                        <div
                          className={`h-full ${pct >= 100 ? "bg-emerald-500" : "bg-cyan-500"} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10.5px] text-fg-subtle mt-0.5">
                        {progress.buyers} buyer{progress.buyers === 1 ? "" : "s"} · {pct}%
                      </div>
                    </td>
                    <td className="col-num text-[12.5px] text-fg-muted">
                      min {g.min_qty_per_buyer} / target {g.target_qty}
                    </td>
                    <td className="col-num">
                      <span className="font-mono tnum font-medium">
                        {fmtBdt(currentPrice)}
                      </span>
                      <span className="text-[11px] text-fg-subtle"> /pc</span>
                      {g.status === "formed" && g.final_unit_bdt != null && (
                        <div className="text-[10.5px] text-emerald-700 mt-0.5">
                          formed @ {fmtBdt(g.final_unit_bdt)}/pc
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="text-[12.5px]">
                        {new Date(g.deadline_at).toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                      <div className="text-[10.5px] text-fg-subtle">
                        {g.status === "open" ? `closes in ${timeUntil(g.deadline_at)}` : ""}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${tone.pill}`}>
                        {STATUS_LABEL[g.status as GBStatus] ?? g.status}
                      </span>
                    </td>
                    <td className="col-actions">
                      <Link
                        href={`/admin/group-buys/${g.id}`}
                        className="text-cyan-700 hover:text-cyan-800 text-[12.5px] font-medium"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-[14px] text-fg-muted">No group buys yet.</p>
            <Link
              href="/admin/group-buys/new"
              className="inline-block mt-3 h-9 px-4 text-[13px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700"
            >
              Create the first one →
            </Link>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
