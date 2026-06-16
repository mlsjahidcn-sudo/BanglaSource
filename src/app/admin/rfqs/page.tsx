// /admin/rfqs
//
// Phase 22: admin RFQ list. Server-rendered, sorted open
// first (the actions a human takes), then quoted, then
// closed. Counts at the top give the admin a one-glance
// snapshot of the queue.
//
// Filters (URL query params, server-side):
//   ?status=open|quoted|accepted|rejected|cancelled (default: all)
//   ?since=7d|30d|all (default: 30d)
//
// Every row links to /admin/rfqs/[id] which is the
// review+quote page.

import Link from "next/link";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/portal-auth";
import { AdminPage, AdminPageHeader } from "@/components/admin-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RFQStatus = "open" | "quoted" | "accepted" | "rejected" | "cancelled";

const STATUS_LABEL: Record<RFQStatus, string> = {
  open: "Open",
  quoted: "Quoted",
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<
  RFQStatus,
  { bg: string; text: string; border: string; dot: string }
> = {
  open: { bg: "bg-cyan-50", text: "text-cyan-800", border: "border-cyan-200", dot: "bg-cyan-500" },
  quoted: { bg: "bg-violet-50", text: "text-violet-800", border: "border-violet-200", dot: "bg-violet-500" },
  accepted: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", dot: "bg-emerald-500" },
  rejected: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-500" },
  cancelled: { bg: "bg-bg-soft", text: "text-fg-muted", border: "border-border", dot: "bg-fg-muted" },
};

const SINCE_OPTIONS = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
] as const;
type SinceKey = (typeof SINCE_OPTIONS)[number]["key"];

function sinceIso(key: SinceKey): string | null {
  if (key === "all") return null;
  const days = key === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

type RFQRow = {
  id: number;
  user_id: string;
  title: string;
  spec_text: string;
  target_qty: number;
  target_price_cny_fen: number | null;
  destination_country: string;
  status: RFQStatus;
  quoted_price_cny_fen: number | null;
  quoted_min_qty: number | null;
  quoted_lead_days: number | null;
  created_at: string;
  quoted_at: string | null;
};

export default async function AdminRFQsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; since?: string }>;
}) {
  await requireAdmin("/admin/rfqs");
  const sp = await searchParams;
  const status = (sp.status ?? "all") as RFQStatus | "all";
  const since = (sp.since ?? "30d") as SinceKey;
  const sinceAt = sinceIso(since);

  const sb = getServiceRoleClient();
  let q = sb
    .from("rfqs")
    .select(
      "id, user_id, title, spec_text, target_qty, target_price_cny_fen, destination_country, status, quoted_price_cny_fen, quoted_min_qty, quoted_lead_days, created_at, quoted_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "all") q = q.eq("status", status);
  if (sinceAt) q = q.gte("created_at", sinceAt);
  const { data: rfqs, error } = await q;

  if (error) {
    return (
      <AdminPage>
        <AdminPageHeader
          eyebrow="Inbound"
          title="RFQs"
          dotColor="cyan"
          subtitle="Custom request-for-quote — buyer-submitted specs that need factory pickup."
        />
        <div className="card p-6 text-rose-600 text-[13px]">Error: {error.message}</div>
      </AdminPage>
    );
  }

  // Status counts (over the same time window) for the stat cards.
  const { data: counts } = await sb
    .from("rfqs")
    .select("status", { count: "exact" })
    .gte(
      "created_at",
      sinceAt ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    );
  const statusCounts: Record<RFQStatus, number> = {
    open: 0,
    quoted: 0,
    accepted: 0,
    rejected: 0,
    cancelled: 0,
  };
  for (const r of counts ?? []) {
    const s = (r as any).status as RFQStatus;
    if (s in statusCounts) statusCounts[s] += 1;
  }

  const rows = (rfqs ?? []) as RFQRow[];

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Inbound"
        title="RFQs"
        dotColor="cyan"
        subtitle="Custom request-for-quote — buyer-submitted specs that need factory pickup."
      />

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <FilterGroup
          label="Status"
          current={status}
          options={[
            { key: "all", label: "All" },
            { key: "open", label: "Open" },
            { key: "quoted", label: "Quoted" },
            { key: "accepted", label: "Accepted" },
            { key: "rejected", label: "Rejected" },
            { key: "cancelled", label: "Cancelled" },
          ]}
          paramName="status"
          since={since}
        />
        <span className="text-fg-subtle text-[12px] mx-1">·</span>
        <FilterGroup
          label=""
          current={since}
          options={SINCE_OPTIONS as unknown as { key: string; label: string }[]}
          paramName="since"
          since={status}
        />
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard
          label="Open"
          value={statusCounts.open}
          tone="cyan"
          active={status === "open"}
          href={`/admin/rfqs?status=open&since=${since}`}
        />
        <StatCard
          label="Quoted"
          value={statusCounts.quoted}
          tone="violet"
          active={status === "quoted"}
          href={`/admin/rfqs?status=quoted&since=${since}`}
        />
        <StatCard
          label="Accepted"
          value={statusCounts.accepted}
          tone="emerald"
          active={status === "accepted"}
          href={`/admin/rfqs?status=accepted&since=${since}`}
        />
        <StatCard
          label="Rejected"
          value={statusCounts.rejected}
          tone="amber"
          active={status === "rejected"}
          href={`/admin/rfqs?status=rejected&since=${since}`}
        />
        <StatCard
          label="Cancelled"
          value={statusCounts.cancelled}
          tone="slate"
          active={status === "cancelled"}
          href={`/admin/rfqs?status=cancelled&since=${since}`}
        />
      </div>

      {/* Table */}
      <div className="mt-6 card overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-fg-muted">
            No RFQs match the current filter.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium border-b border-border">
                <th className="py-2.5 pl-5 pr-3">RFQ</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-3">Title</th>
                <th className="py-2.5 pr-3 text-right">Target</th>
                <th className="py-2.5 pr-3 text-right">Quote</th>
                <th className="py-2.5 pr-5 text-right">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-b-0 hover:bg-bg-soft"
                >
                  <td className="py-2.5 pl-5 pr-3 font-mono text-[12px]">
                    <Link
                      href={`/admin/rfqs/${r.id}`}
                      className="text-cyan-700 hover:underline"
                    >
                      RFQ-{String(r.id).padStart(6, "0")}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border rounded ${
                        STATUS_TONE[r.status].bg
                      } ${STATUS_TONE[r.status].text} ${STATUS_TONE[r.status].border}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${STATUS_TONE[r.status].dot}`}
                      />
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 max-w-[280px] truncate">{r.title}</td>
                  <td className="py-2.5 pr-3 text-right font-mono text-[12px]">
                    {r.target_qty.toLocaleString()}
                    {r.target_price_cny_fen
                      ? ` @ ¥${(r.target_price_cny_fen / 100).toFixed(2)}`
                      : ""}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-[12px]">
                    {r.quoted_price_cny_fen
                      ? `¥${(r.quoted_price_cny_fen / 100).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-5 text-right text-[12px] text-fg-muted">
                    {new Date(r.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminPage>
  );
}

function FilterGroup({
  label,
  current,
  options,
  paramName,
  since,
}: {
  label: string;
  current: string;
  options: { key: string; label: string }[];
  paramName: string;
  since: string;
}) {
  return (
    <div className="inline-flex items-center gap-1 text-[12px]">
      {label && (
        <span className="text-fg-subtle uppercase tracking-wider text-[10.5px] font-medium mr-1">
          {label}
        </span>
      )}
      {options.map((o) => {
        const active = current === o.key;
        const href =
          paramName === "status"
            ? `/admin/rfqs?${paramName}=${o.key}&since=${since}`
            : `/admin/rfqs?status=${since}&since=${o.key}`;
        return (
          <Link
            key={o.key}
            href={href}
            className={`h-7 px-2.5 inline-flex items-center rounded-md border text-[11.5px] font-medium transition-colors ${
              active
                ? "bg-cyan-600 text-white border-cyan-600"
                : "border-border text-fg-muted hover:text-fg hover:bg-bg-soft"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  active,
  href,
}: {
  label: string;
  value: number;
  tone: "cyan" | "violet" | "emerald" | "amber" | "slate";
  active: boolean;
  href: string;
}) {
  const dot: Record<typeof tone, string> = {
    cyan: "bg-cyan-500",
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    slate: "bg-fg-muted",
  };
  return (
    <Link
      href={href}
      className={`card p-4 block hover:border-cyan-300 transition-colors ${
        active ? "border-cyan-400 ring-1 ring-cyan-200" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dot[tone]}`} />
        <p className="text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium">
          {label}
        </p>
      </div>
      <p className="mt-2 text-[24px] font-semibold tracking-tight">{value}</p>
    </Link>
  );
}
