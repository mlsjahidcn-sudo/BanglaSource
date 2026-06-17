// /buyer/group-buys — buyer's "my groups" page.
//
// Phase 39. Server-rendered. Lists every group buy the signed-in
// buyer has a membership in, regardless of the group's status,
// so the buyer can track every commitment end-to-end:
//
//   open + payment_state=pending    → "Cancel my commitment"
//   forming                         → "Charging in progress"
//   formed + payment_state=charged  → "Pay your order" link
//   formed + payment_state=pending  → "Order ready — pay now"
//   expired                         → "Didn't form — no charge"
//   cancelled                       → "Admin cancelled — no charge"
//
// The Cancel button is a client island (the rest is SSR).

import Link from "next/link";
import { requireUser } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import {
  groupBuyPriceAtQty,
  type GroupBuyPriceTier,
} from "@/lib/pricing";
import { dict } from "@/lib/i18n-dict";
import { CancelMembershipButton } from "./_cancel-button";
import { CATEGORIES } from "@/lib/catalog-categories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type GBStatus = "open" | "forming" | "formed" | "expired" | "cancelled";
type PayState = "pending" | "charged" | "failed" | "refunded";

const GB_STATUS_LABEL: Record<GBStatus, string> = {
  open: "Open",
  forming: "Charging",
  formed: "Formed",
  expired: "Expired",
  cancelled: "Cancelled",
};

const GB_STATUS_TONE: Record<GBStatus, string> = {
  open: "is-cyan",
  forming: "is-info",
  formed: "is-success",
  expired: "is-warning",
  cancelled: "is-neutral",
};

const PAY_STATE_LABEL: Record<PayState, string> = {
  pending: "Pending",
  charged: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

const PAY_STATE_TONE: Record<PayState, string> = {
  pending: "is-warning",
  charged: "is-success",
  failed: "is-danger",
  refunded: "is-neutral",
};

function fmtBdt(n: number): string {
  return `৳${n.toLocaleString("en-BD")}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "passed";
  const days = Math.floor(ms / 86400_000);
  const hours = Math.floor((ms % 86400_000) / 3600_000);
  if (days >= 1) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export default async function MyGroupBuysPage() {
  const user = await requireUser("/buyer/group-buys");
  const sb = getServiceRoleClient();

  // 1) My memberships
  const { data: memberships, error: memErr } = await sb
    .from("group_buy_members")
    .select(
      "id, group_buy_id, qty, unit_bdt_at_commit, payment_state, order_id, created_at, charged_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (memErr) {
    return (
      <Container size="default" className="pt-10 pb-24">
        <p className="text-red-700">Failed to load: {memErr.message}</p>
      </Container>
    );
  }
  if (!memberships || memberships.length === 0) {
    return (
      <Container size="default" className="pt-10 pb-24">
        <header className="max-w-3xl">
          <p className="section-eyebrow">
            {dict["group_buy.my.title"].en}
          </p>
          <h1 className="mt-2 text-[32px] md:text-[38px] leading-[1.05] font-semibold tracking-[-0.02em]">
            {dict["group_buy.my.title"].en}
          </h1>
          <p className="mt-3 text-[14px] text-fg-muted max-w-2xl">
            {dict["group_buy.my.subtitle"].en}
          </p>
        </header>
        <div className="mt-12 rounded-lg border border-border bg-bg p-12 text-center">
          <p className="text-[14px] text-fg-muted">
            {dict["group_buy.my.empty"].en}
          </p>
          <Link
            href="/group-buys"
            className="btn btn-primary btn-md mt-5 inline-flex"
          >
            {dict["group_buy.my.empty_cta"].en}
          </Link>
        </div>
      </Container>
    );
  }

  // 2) Bulk-load parent groups + products
  const groupIds = Array.from(new Set(memberships.map((m) => m.group_buy_id)));
  const { data: groups, error: gbErr } = await sb
    .from("group_buys")
    .select(
      "id, product_id, target_qty, min_qty_per_buyer, price_tiers, deadline_at, status, final_unit_bdt, formed_at, cancelled_at, products!inner(source_id, title_en, title_bn, images, category)",
    )
    .in("id", groupIds);
  if (gbErr) {
    return (
      <Container size="default" className="pt-10 pb-24">
        <p className="text-red-700">Failed to load groups: {gbErr.message}</p>
      </Container>
    );
  }
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));

  // 3) Bulk-load SUM(qty) per group for live progress
  const { data: memberRows } = await sb
    .from("group_buy_members")
    .select("group_buy_id, qty")
    .in("group_buy_id", groupIds);
  const qtyByGroup = new Map<string, number>();
  for (const m of memberRows ?? []) {
    qtyByGroup.set(
      m.group_buy_id,
      (qtyByGroup.get(m.group_buy_id) ?? 0) + (m.qty ?? 0),
    );
  }

  type Group = NonNullable<typeof groups>[number] & {
    products: {
      source_id: string;
      title_en: string;
      title_bn: string | null;
      images: string[] | null;
      category: string;
    };
  };

  const rows = memberships
    .map((m) => {
      const g = groupById.get(m.group_buy_id) as Group | undefined;
      if (!g) return null;
      const tiers = (g.price_tiers as unknown as GroupBuyPriceTier[]) ?? [];
      const currentQty = qtyByGroup.get(g.id) ?? 0;
      const currentPrice = groupBuyPriceAtQty(tiers, currentQty);
      const willPayUnitBdt =
        g.status === "formed" && g.final_unit_bdt != null
          ? g.final_unit_bdt
          : currentPrice;
      return { m, g, currentQty, currentPrice, willPayUnitBdt };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  return (
    <Container size="default" className="pt-10 pb-24">
      <header className="max-w-3xl">
        <p className="section-eyebrow">{dict["group_buy.my.title"].en}</p>
        <h1 className="mt-2 text-[32px] md:text-[38px] leading-[1.05] font-semibold tracking-[-0.02em]">
          {dict["group_buy.my.title"].en}
        </h1>
        <p className="mt-3 text-[14px] text-fg-muted max-w-2xl">
          {dict["group_buy.my.subtitle"].en}
        </p>
      </header>

      <div className="mt-8 space-y-4">
        {rows.map(({ m, g, currentQty, currentPrice, willPayUnitBdt }) => {
          const status = g.status as GBStatus;
          const tone = GB_STATUS_TONE[status] ?? "is-neutral";
          const pay = (m.payment_state ?? "pending") as PayState;
          const payTone = PAY_STATE_TONE[pay] ?? "is-neutral";
          const progressPct =
            g.target_qty > 0
              ? Math.min(100, Math.round((currentQty / g.target_qty) * 100))
              : 0;
          const catLabel =
            CATEGORIES.find((c) => c.value === g.products.category)?.label ??
            g.products.category;
          const image = g.products.images?.[0] ?? null;
          const priceDropped =
            status === "open" && currentPrice < m.unit_bdt_at_commit;

          return (
            <article
              key={m.id}
              className="rounded-lg border border-border bg-bg p-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-5">
                {/* Image */}
                <div className="aspect-square rounded border border-border bg-slate-50 overflow-hidden">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-fg-subtle text-[11px]">
                      no image
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`status-pill ${tone}`}>
                      {GB_STATUS_LABEL[status]}
                    </span>
                    <span className={`status-pill ${payTone}`}>
                      {PAY_STATE_LABEL[pay]}
                    </span>
                  </div>
                  <p className="text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium">
                    {catLabel}
                  </p>
                  <Link
                    href={`/group-buys/${g.id}`}
                    className="block mt-0.5 text-[15px] font-medium leading-snug hover:text-cyan-700"
                  >
                    {g.products.title_en}
                  </Link>
                  <p className="text-[10.5px] text-fg-subtle font-mono mt-0.5">
                    {g.products.source_id}
                  </p>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-[12px]">
                    <div>
                      <div className="text-fg-subtle">
                        {dict["group_buy.my.your_qty"].en
                          .replace("{qty}", "")}
                      </div>
                      <div className="font-mono tnum font-medium">
                        {m.qty.toLocaleString()} pcs
                      </div>
                    </div>
                    <div>
                      <div className="text-fg-subtle">
                        {dict["group_buy.my.your_price_locked"].en
                          .replace("{price}", "")}
                      </div>
                      <div className="font-mono tnum font-medium text-cyan-700">
                        {fmtBdt(m.unit_bdt_at_commit)}/pc
                      </div>
                    </div>
                    <div>
                      <div className="text-fg-subtle">
                        {dict["group_buy.my.will_pay"].en
                          .replace("{price}", "")}
                      </div>
                      <div className="font-mono tnum font-medium">
                        {fmtBdt(willPayUnitBdt)}/pc
                      </div>
                    </div>
                    <div>
                      <div className="text-fg-subtle">
                        Joined
                      </div>
                      <div className="font-mono tnum">{fmtDate(m.created_at)}</div>
                    </div>
                  </div>

                  {/* Progress bar — only meaningful while forming/open */}
                  {(status === "open" || status === "forming") && (
                    <div className="mt-3">
                      <div className="flex items-baseline justify-between text-[11.5px] text-fg-muted">
                        <span>
                          {dict["group_buy.my.progress_label"].en}:{" "}
                          {currentQty.toLocaleString()} /{" "}
                          {g.target_qty.toLocaleString()}
                        </span>
                        <span className="font-mono tnum text-cyan-700">
                          {progressPct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded overflow-hidden mt-1">
                        <div
                          className={`h-full ${
                            progressPct >= 100 ? "bg-emerald-500" : "bg-cyan-500"
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      {status === "open" && (
                        <p className="text-[11px] text-fg-subtle mt-1">
                          Ends in {timeUntil(g.deadline_at)}
                        </p>
                      )}
                    </div>
                  )}

                  {priceDropped && (
                    <p className="text-[11.5px] text-emerald-700 mt-2">
                      {dict["group_buy.my.price_dropped"].en
                        .replace("{price}", fmtBdt(m.unit_bdt_at_commit))}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 md:items-end">
                  <Link
                    href={`/group-buys/${g.id}`}
                    className="btn btn-outline btn-sm md:w-32 justify-center"
                  >
                    {dict["group_buy.my.action.view"].en}
                  </Link>
                  {status === "open" && pay === "pending" && (
                    <CancelMembershipButton
                      groupBuyId={g.id}
                      label={dict["group_buy.my.action.cancel"].en}
                    />
                  )}
                  {status === "formed" && pay === "pending" && m.order_id && (
                    <Link
                      href={`/orders/${m.order_id}`}
                      className="btn btn-primary btn-sm md:w-32 justify-center"
                    >
                      {dict["group_buy.my.action.pay_now"].en
                        .replace("{orderId}", String(m.order_id))}
                    </Link>
                  )}
                  {status === "formed" && pay === "failed" && (
                    <Link
                      href="/buyer/orders"
                      className="btn btn-outline btn-sm md:w-32 justify-center"
                    >
                      {dict["group_buy.my.action.failed_retry"].en}
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Container>
  );
}