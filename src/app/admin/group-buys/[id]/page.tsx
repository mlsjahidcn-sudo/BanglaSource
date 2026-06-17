// /admin/group-buys/[id]
//
// Phase 37: admin Group Buy detail view. Shows:
//   - Product + status + final price (if formed) + progress bar
//   - Members table (user, qty, payment_state, charged_at)
//   - Cancel button (only for non-terminal statuses)
//
// State machine visible in the UI:
//   open       → Cancel ·  Close to buyers ·  Auto-expires at deadline
//   forming    → Cancel ·  Charged in flight
//   formed     → Locked in at ৳X/pc (frozen).  Orders created
//   expired    → Locked.  No charge happened.  Buyers notified
//   cancelled  → Locked.  Admin cancelled (reason visible in audit)
//
// Server-rendered. The Cancel button is the only client island
// (it does a fetch to PATCH /api/admin/group-buys/[id]).

import { notFound } from "next/navigation";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/portal-auth";
import { AdminPage, AdminPageHeader } from "@/components/admin-page";
import { CATEGORIES } from "@/lib/catalog-categories";
import {
  fmtBdt,
  groupBuyPriceAtQty,
  type GroupBuyPriceTier,
} from "@/lib/pricing";
import { CancelGroupBuyButton } from "./_cancel-button";
import { RetryMemberButton, RemoveMemberButton } from "./_member-actions";

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

const STATUS_TONE: Record<GBStatus, { pill: string; dot: string }> = {
  open:      { pill: "is-cyan",    dot: "bg-cyan-500" },
  forming:   { pill: "is-info",    dot: "bg-violet-500" },
  formed:    { pill: "is-success", dot: "bg-emerald-500" },
  expired:   { pill: "is-warning", dot: "bg-amber-500" },
  cancelled: { pill: "is-neutral", dot: "bg-slate-400" },
};

const PAYMENT_LABEL: Record<string, string> = {
  pending: "Pending",
  charged: "Charged",
  failed: "Failed",
  refunded: "Refunded",
};

const PAYMENT_TONE: Record<string, string> = {
  pending: "is-warning",
  charged: "is-success",
  failed: "is-danger",
  refunded: "is-neutral",
};

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "passed";
  const days = Math.floor(ms / 86400_000);
  const hours = Math.floor((ms % 86400_000) / 3600_000);
  const mins = Math.floor((ms % 3600_000) / 60_000);
  if (days >= 2) return `${days}d ${hours}h`;
  if (days >= 1) return `${days}d ${hours}h ${mins}m`;
  if (hours >= 1) return `${hours}h ${mins}m`;
  return `${Math.max(mins, 0)}m`;
}

export default async function GroupBuyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin(`/admin/group-buys/${id}`);

  const sb = getServiceRoleClient();
  const { data: gb, error: gbErr } = await sb
    .from("group_buys")
    .select(
      "id, product_id, target_qty, min_qty_per_buyer, price_tiers, deadline_at, status, final_unit_bdt, formed_at, cancelled_at, created_by, created_at, updated_at, products(source_id, title_en, title_bn, images, category)",
    )
    .eq("id", id)
    .maybeSingle();

  if (gbErr) {
    return (
      <AdminPage>
        <p className="text-red-700">Failed to load: {gbErr.message}</p>
      </AdminPage>
    );
  }
  if (!gb) notFound();

  // Members — two-step lookup (user_id has no FK to profiles in
  // the public schema; same gotcha as orders + rfqs admin pages).
  // 1) fetch members; 2) bulk-look-up profiles by user_id.
  const { data: members, error: memErr } = await sb
    .from("group_buy_members")
    .select(
      "id, group_buy_id, user_id, qty, unit_bdt_at_commit, payment_state, order_id, charged_at, created_at",
    )
    .eq("group_buy_id", id)
    .order("created_at", { ascending: true });
  if (memErr) {
    return (
      <AdminPage>
        <p className="text-red-700">Failed to load members: {memErr.message}</p>
      </AdminPage>
    );
  }

  const userIds = Array.from(
    new Set((members ?? []).map((m) => m.user_id)),
  );
  let profileById = new Map<string, { email: string; full_name: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileById.set(p.id, {
        email: p.email ?? "",
        full_name: p.full_name ?? null,
      });
    }
  }
  const membersWithProfiles = (members ?? []).map((m) => ({
    ...m,
    profile: profileById.get(m.user_id) ?? null,
  }));

  const tiers = (gb.price_tiers as unknown as GroupBuyPriceTier[]) ?? [];
  const progress = (members ?? []).reduce(
    (acc, m) => {
      acc.qty += m.qty;
      acc.buyers += 1;
      return acc;
    },
    { qty: 0, buyers: 0 },
  );
  const pct =
    gb.target_qty > 0
      ? Math.min(100, Math.round((progress.qty / gb.target_qty) * 100))
      : 0;
  const currentPrice = groupBuyPriceAtQty(tiers, progress.qty);
  const status = gb.status as GBStatus;
  const tone = STATUS_TONE[status] ?? STATUS_TONE.cancelled;
  const productInfo = (gb as unknown as {
    products?: {
      source_id?: string;
      title_en?: string;
      title_bn?: string;
      images?: string[];
      category?: string;
    } | null;
  }).products;

  const cancellable = status === "open" || status === "forming";
  const memberTotalBdt = (members ?? []).reduce(
    (acc, m) => acc + m.qty * m.unit_bdt_at_commit,
    0,
  );

  return (
    <AdminPage size="wide">
      <div className="mb-1">
        <a
          href="/admin/group-buys"
          className="text-[12px] text-fg-muted hover:text-fg"
        >
          ← Group buys
        </a>
      </div>
      <AdminPageHeader
        eyebrow="Group buy"
        title={productInfo?.title_en ?? `Group #${id.slice(0, 8)}`}
        subtitle={
          <span className="font-mono tnum text-[11.5px]">
            {productInfo?.source_id} · {id}
          </span>
        }
        dotColor="cyan"
        actions={
          cancellable ? (
            <CancelGroupBuyButton id={id} />
          ) : (
            <span className={`status-pill ${tone.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
              {STATUS_LABEL[status]}
            </span>
          )
        }
      />

      {/* Two-column layout: details + progress on the left, members on the right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-5 mt-6">
        {/* LEFT: details + tiers */}
        <div className="space-y-4">
          {/* Status + state-machine card */}
          <div className="rounded-lg border border-border bg-bg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`status-pill ${tone.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                {STATUS_LABEL[status]}
              </span>
              <span className="text-[11.5px] text-fg-subtle">
                {status === "open" && `closes in ${timeUntil(gb.deadline_at)}`}
                {status === "forming" && "Charging members — formation in progress"}
                {status === "formed" && "Frozen — orders created"}
                {status === "expired" && "No target reached — no charge"}
                {status === "cancelled" && "Admin cancelled — no charge"}
              </span>
            </div>
            <div className="space-y-1.5">
              <Row
                k="Progress"
                v={
                  <span>
                    {progress.qty.toLocaleString()} / {gb.target_qty.toLocaleString()}{" "}
                    pcs <span className="text-fg-subtle">({pct}%)</span>
                  </span>
                }
                mono
              />
              <div className="h-1.5 w-full bg-slate-100 rounded overflow-hidden -mt-0.5 mb-1">
                <div
                  className={`h-full ${pct >= 100 ? "bg-emerald-500" : "bg-cyan-500"} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <Row
                k="Buyers committed"
                v={
                  <span>
                    {progress.buyers}
                    {status === "open" && progress.buyers < 2 ? (
                      <span className="text-amber-700 ml-1.5 text-[11px]">
                        (need ≥ 1 more to potentially form)
                      </span>
                    ) : null}
                  </span>
                }
                mono
              />
              <Row k="Min per buyer" v={`${gb.min_qty_per_buyer} pcs`} mono />
              <Row k="Target qty" v={`${gb.target_qty} pcs`} mono />
              <Row
                k="Deadline"
                v={
                  <span>
                    {new Date(gb.deadline_at).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {status === "open" && (
                      <span className="text-fg-subtle ml-1.5">
                        ({timeUntil(gb.deadline_at)})
                      </span>
                    )}
                  </span>
                }
              />
              {status === "formed" && gb.final_unit_bdt != null && (
                <Row
                  k="Final price"
                  v={
                    <span className="text-emerald-700 font-semibold font-mono tnum">
                      {fmtBdt(gb.final_unit_bdt)}/pc
                    </span>
                  }
                />
              )}
              {status === "formed" && gb.formed_at && (
                <Row
                  k="Formed at"
                  v={new Date(gb.formed_at).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
              )}
              {status === "cancelled" && gb.cancelled_at && (
                <Row
                  k="Cancelled at"
                  v={new Date(gb.cancelled_at).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                />
              )}
              <Row
                k="Created"
                v={new Date(gb.created_at).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              />
            </div>
          </div>

          {/* Price tiers */}
          <div className="rounded-lg border border-border bg-bg p-4">
            <p className="section-eyebrow mb-3">Price tiers</p>
            <div className="space-y-1">
              {tiers.map((t, i) => {
                const isCurrent =
                  progress.qty >= t.qty_threshold &&
                  (i === tiers.length - 1 ||
                    progress.qty < (tiers[i + 1]?.qty_threshold ?? Infinity));
                const isNext =
                  !isCurrent &&
                  i > 0 &&
                  progress.qty >= (tiers[i - 1]?.qty_threshold ?? 0);
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2 rounded text-[13px] ${
                      isCurrent
                        ? "bg-cyan-50 text-cyan-900 font-medium"
                        : isNext
                          ? "bg-amber-50/50 text-amber-900"
                          : "text-fg"
                    }`}
                  >
                    <span className="font-mono tnum text-[12.5px]">
                      ≥ {t.qty_threshold.toLocaleString()} pcs
                    </span>
                    <span className="font-mono tnum">
                      {fmtBdt(t.unit_bdt)}/pc
                    </span>
                  </div>
                );
              })}
            </div>
            {status === "open" && progress.qty > 0 && (
              <p className="text-[11.5px] text-fg-subtle mt-3 pt-3 border-t border-border">
                Current unlocked price:{" "}
                <span className="font-mono tnum font-medium text-cyan-700">
                  {fmtBdt(currentPrice)}/pc
                </span>
              </p>
            )}
          </div>

          {/* Product card (small) */}
          {productInfo && (
            <div className="rounded-lg border border-border bg-bg p-4">
              <p className="section-eyebrow mb-3">Product</p>
              <div className="flex items-start gap-3">
                {productInfo.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productInfo.images[0]}
                    alt=""
                    className="w-16 h-16 rounded border border-border object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded border border-border bg-slate-50 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">
                    {productInfo.title_en}
                  </p>
                  <p className="text-[11px] text-fg-subtle font-mono tnum mt-0.5">
                    {productInfo.source_id}
                  </p>
                  <p className="text-[11.5px] text-fg-muted mt-1">
                    Category:{" "}
                    {CATEGORIES.find((c) => c.value === productInfo.category)
                      ?.label ?? productInfo.category}
                  </p>
                  <a
                    href={`/admin/products/${gb.product_id}`}
                    className="text-[11.5px] text-cyan-700 hover:text-cyan-800 mt-1.5 inline-block"
                  >
                    Edit product →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: members */}
        <div className="rounded-lg border border-border bg-bg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="section-eyebrow">Members ({membersWithProfiles?.length ?? 0})</p>
            <p className="text-[11.5px] text-fg-subtle font-mono tnum">
              Committed: {progress.qty.toLocaleString()} pcs · {fmtBdt(memberTotalBdt)}
            </p>
          </div>
          {membersWithProfiles && membersWithProfiles.length > 0 ? (
            <table className="table-pro">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th className="col-num">Qty</th>
                  <th className="col-num">Unit @ commit</th>
                  <th className="col-num">Line total</th>
                  <th>Payment</th>
                  <th>Committed</th>
                </tr>
              </thead>
              <tbody>
                {membersWithProfiles.map((m) => {
                  const profile = m.profile;
                  const lineTotal = m.qty * m.unit_bdt_at_commit;
                  return (
                    <tr key={m.id}>
                      <td>
                        <div className="text-[12.5px] font-medium truncate max-w-[200px]">
                          {profile?.full_name || profile?.email || m.user_id.slice(0, 8)}
                        </div>
                        <div className="text-[10.5px] text-fg-subtle truncate max-w-[200px] font-mono">
                          {profile?.email ?? m.user_id}
                        </div>
                      </td>
                      <td className="col-num font-mono tnum">
                        {m.qty.toLocaleString()}
                      </td>
                      <td className="col-num font-mono tnum text-fg-muted">
                        {fmtBdt(m.unit_bdt_at_commit)}/pc
                      </td>
                      <td className="col-num font-mono tnum font-medium">
                        {fmtBdt(lineTotal)}
                      </td>
                      <td>
                        <span
                          className={`status-pill ${PAYMENT_TONE[m.payment_state] ?? "is-neutral"}`}
                        >
                          {PAYMENT_LABEL[m.payment_state] ?? m.payment_state}
                        </span>
                        {m.order_id && (
                          <a
                            href={`/admin/orders/${m.order_id}`}
                            className="text-[10.5px] text-cyan-700 hover:text-cyan-800 ml-1.5"
                          >
                            #{m.order_id}
                          </a>
                        )}
                        {/* Phase 41: per-member admin actions */}
                        {status === "formed" && m.payment_state === "failed" && (
                          <span className="ml-2">
                            <RetryMemberButton
                              groupBuyId={id}
                              memberId={m.id}
                            />
                          </span>
                        )}
                        <span className="ml-2">
                          <RemoveMemberButton
                            groupBuyId={id}
                            memberId={m.id}
                          />
                        </span>
                      </td>
                      <td>
                        <div className="text-[12px]">
                          {new Date(m.created_at).toLocaleString("en-GB", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </div>
                        {m.charged_at && (
                          <div className="text-[10.5px] text-emerald-700">
                            charged{" "}
                            {new Date(m.charged_at).toLocaleString("en-GB", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center text-[13px] text-fg-muted">
              {status === "open"
                ? "No buyers have committed yet. Share the public link to start filling the group."
                : "No members were committed."}
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  );
}

function Row({
  k,
  v,
  mono,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="data-row">
      <span>{k}</span>
      <span className={mono ? "font-mono tnum" : ""}>{v}</span>
    </div>
  );
}
