// /group-buys/[id] — public Group Buy detail page.
//
// Phase 39. The page is server-rendered with the static parts
// (product, tiers, progress, status pill, deadline). The
// interactive island is `_client.tsx` — it owns the qty picker,
// the live "you'll pay X" preview, and the Join / Cancel button.
//
// Sign-in state is read server-side via getCurrentUser() (which
// returns null instead of redirecting, unlike requireUser). The
// signed-in buyer's membership is fetched server-side too — this
// way the first paint already shows the correct CTA ("You're in"
// vs "Join now") with no client-side flash.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/portal-auth";
import { CATEGORIES } from "@/lib/catalog-categories";
import {
  fmtBdt,
  groupBuyPriceAtQty,
  groupBuyNextTier,
  type GroupBuyPriceTier,
} from "@/lib/pricing";
import { dict } from "@/lib/i18n-dict";
import {
  jsonLdScript,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
import { GroupBuyDetailClient } from "./_client";

export const dynamic = "force-dynamic";

async function loadDetail(groupBuyId: string) {
  const sb = getServiceRoleClient();

  const { data: gb, error } = await sb
    .from("group_buys")
    .select(
      "id, product_id, target_qty, min_qty_per_buyer, price_tiers, deadline_at, status, final_unit_bdt, formed_at, cancelled_at, products!inner(source_id, title_en, title_bn, images, category)",
    )
    .eq("id", groupBuyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!gb) return null;

  // Live SUM + member count
  const { data: memberRows } = await sb
    .from("group_buy_members")
    .select("qty, user_id")
    .eq("group_buy_id", groupBuyId);
  const currentQty = (memberRows ?? []).reduce((s, m) => s + (m.qty ?? 0), 0);
  const buyersSet = new Set<string>();
  for (const m of memberRows ?? []) {
    const u = (m as { user_id?: string }).user_id;
    if (u) buyersSet.add(u);
  }
  const buyersCount = buyersSet.size;

  return {
    id: gb.id,
    product_id: gb.product_id,
    target_qty: gb.target_qty,
    min_qty_per_buyer: gb.min_qty_per_buyer,
    price_tiers: (gb.price_tiers as unknown as GroupBuyPriceTier[]) ?? [],
    deadline_at: gb.deadline_at,
    status: gb.status as "open" | "forming" | "formed" | "expired" | "cancelled",
    final_unit_bdt: gb.final_unit_bdt,
    formed_at: gb.formed_at,
    cancelled_at: gb.cancelled_at,
    current_qty: currentQty,
    buyers_count: buyersCount,
    product: (() => {
      const p = (
        gb as unknown as {
          products: {
            source_id: string;
            title_en: string;
            title_bn: string | null;
            images: string[] | null;
            category: string;
          };
        }
      ).products;
      return {
        source_id: p.source_id,
        title_en: p.title_en,
        title_bn: p.title_bn,
        image: p.images?.[0] ?? null,
        category: p.category,
      };
    })(),
  };
}

async function loadMyMembership(groupBuyId: string, userId: string) {
  const sb = getServiceRoleClient();
  const { data } = await sb
    .from("group_buy_members")
    .select("id, qty, unit_bdt_at_commit, payment_state, order_id, created_at")
    .eq("group_buy_id", groupBuyId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

const STATUS_LABEL: Record<
  "open" | "forming" | "formed" | "expired" | "cancelled",
  string
> = {
  open: "Open",
  forming: "Charging",
  formed: "Formed",
  expired: "Expired",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<
  "open" | "forming" | "formed" | "expired" | "cancelled",
  { pill: string; dot: string }
> = {
  open: { pill: "is-cyan", dot: "bg-cyan-500" },
  forming: { pill: "is-info", dot: "bg-violet-500" },
  formed: { pill: "is-success", dot: "bg-emerald-500" },
  expired: { pill: "is-warning", dot: "bg-amber-500" },
  cancelled: { pill: "is-neutral", dot: "bg-slate-400" },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { title: "Group buy" };
  }
  const detail = await loadDetail(id);
  if (!detail) return { title: "Group buy not found" };
  return {
    title: `${detail.product.title_en} — Group buy`,
    description: `Pay-on-success bulk deal: ${detail.current_qty.toLocaleString()} of ${detail.target_qty.toLocaleString()} pcs committed at ${fmtBdt(groupBuyPriceAtQty(detail.price_tiers, detail.current_qty))}/pc.`,
    alternates: { canonical: `${SITE_URL}/group-buys/${id}` },
    openGraph: {
      type: "website",
      title: `${detail.product.title_en} — Group buy · ${SITE_NAME}`,
      description: `Bulk pricing when the group's target is met.`,
      url: `${SITE_URL}/group-buys/${id}`,
    },
  };
}

export default async function GroupBuyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const detail = await loadDetail(id);
  if (!detail) notFound();

  const user = await getCurrentUser();
  const membership = user ? await loadMyMembership(id, user.id) : null;

  const tiers = detail.price_tiers;
  const currentPrice = groupBuyPriceAtQty(tiers, detail.current_qty);
  const nextTier = groupBuyNextTier(tiers, detail.current_qty);
  const progressPct =
    detail.target_qty > 0
      ? Math.min(100, Math.round((detail.current_qty / detail.target_qty) * 100))
      : 0;
  const tone = STATUS_TONE[detail.status];
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: detail.product.title_en,
    sku: detail.product.source_id,
    image: detail.product.image ?? undefined,
    description: `Group buy: ${detail.current_qty.toLocaleString()} / ${detail.target_qty.toLocaleString()} pcs committed. Current price ${fmtBdt(currentPrice)}/pc.`,
    offers: {
      "@type": "Offer",
      price: (currentPrice / 100).toFixed(2),
      priceCurrency: "BDT",
      availability: detail.status === "open" ? "https://schema.org/InStock" : "https://schema.org/Discontinued",
      url: `${SITE_URL}/group-buys/${id}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd) }}
      />
      <Container className="pt-10 md:pt-14 pb-24">
        <div className="mb-2">
          <Link
            href="/group-buys"
            className="text-[12px] text-fg-muted hover:text-fg"
          >
            ← Group buys
          </Link>
        </div>

        {/* Header: image + product info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
          {/* LEFT: product image */}
          <div className="aspect-square rounded-lg border border-border bg-bg overflow-hidden">
            {detail.product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detail.product.image}
                alt={detail.product.title_en}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-fg-subtle">
                no image
              </div>
            )}
          </div>

          {/* RIGHT: status + progress + price + tiers + CTA */}
          <div className="space-y-5">
            {/* Eyebrow + status pill */}
            <div>
              <p className="section-eyebrow">
                {dict["group_buy.public.detail.eyebrow"].en} ·{" "}
                {CATEGORIES.find((c) => c.value === detail.product.category)?.label ??
                  detail.product.category}
              </p>
              <h1 className="mt-2 heading-2 !text-[24px] md:!text-[28px]">
                {detail.product.title_en}
              </h1>
              <p className="text-[12px] text-fg-subtle font-mono mt-1">
                {detail.product.source_id}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className={`status-pill ${tone.pill}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                  {STATUS_LABEL[detail.status]}
                </span>
                {detail.status === "open" && (
                  <span className="text-[12px] text-fg-subtle">
                    Deadline{" "}
                    {new Date(detail.deadline_at).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* Big progress bar */}
            <div>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-medium">
                  {detail.current_qty.toLocaleString()} /{" "}
                  {detail.target_qty.toLocaleString()} pcs
                </span>
                <span className="font-mono tnum text-cyan-700 font-semibold">
                  {progressPct}%
                </span>
              </div>
              <div
                className={`heading-2 w-full bg-slate-100 rounded overflow-hidden mt-1.5 ${
                  detail.status === "forming" ? "gb-forming-bar" : ""
                }`}
              >
                <div
                  className={`h-full transition-all ${
                    progressPct >= 100
                      ? "bg-emerald-500"
                      : detail.status === "forming"
                        ? "bg-violet-500"
                        : "bg-cyan-500"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {detail.status === "forming" && (
                <p className="text-[11px] text-violet-700 mt-1">
                  {dict["group_buy.public.detail.forming"].en}
                </p>
              )}
              <p className="text-[12px] text-fg-subtle mt-1.5">
                {detail.buyers_count}{" "}
                {dict["group_buy.public.card.buyers"].en}
              </p>
            </div>

            {/* Current price card */}
            <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-4">
              <p className="text-[11px] uppercase tracking-wider text-cyan-700 font-medium">
                {dict["group_buy.public.detail.current_price"].en}
              </p>
              <p className="mt-1 text-[28px] font-semibold font-mono tnum text-cyan-900">
                {fmtBdt(currentPrice)}/pc
              </p>
              {nextTier && detail.status === "open" && (
                <p className="text-[12px] text-amber-700 mt-2">
                  {dict["group_buy.public.detail.next_tier_hint"].en
                    .replace("{qty}", `${nextTier.qty_threshold - detail.current_qty}`)
                    .replace("{price}", fmtBdt(nextTier.unit_bdt))}
                </p>
              )}
            </div>

            {/* Interactive island: qty picker + CTA */}
            <GroupBuyDetailClient
              groupBuyId={detail.id}
              groupStatus={detail.status}
              minQty={detail.min_qty_per_buyer}
              targetQty={detail.target_qty}
              priceTiers={detail.price_tiers}
              currentQty={detail.current_qty}
              currentUserId={user?.id ?? null}
              currentUserEmail={user?.email ?? null}
              initialMembership={
                membership
                  ? {
                      id: membership.id,
                      qty: membership.qty,
                      unit_bdt_at_commit: membership.unit_bdt_at_commit,
                      payment_state: membership.payment_state,
                      order_id: membership.order_id,
                      created_at: membership.created_at,
                    }
                  : null
              }
              finalUnitBdt={detail.final_unit_bdt}
            />

            {/* View product link */}
            <div className="pt-3 border-t border-border">
              <Link
                href={`/products/${detail.product_id}`}
                className="text-[12.5px] text-cyan-700 hover:text-cyan-800 font-medium"
              >
                {dict["group_buy.public.detail.view_product"].en} →
              </Link>
            </div>
          </div>
        </div>

        {/* Below: tiers ladder + how-it-works */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">
          {/* Tier ladder */}
          <div className="rounded-lg border border-border bg-bg p-5">
            <p className="section-eyebrow mb-3">
              {dict["group_buy.public.detail.tiers_title"].en}
            </p>
            <div className="space-y-1.5">
              {tiers.map((t, i) => {
                const isCurrent =
                  detail.current_qty >= t.qty_threshold &&
                  (i === tiers.length - 1 ||
                    detail.current_qty < (tiers[i + 1]?.qty_threshold ?? Infinity));
                const isNext =
                  !isCurrent &&
                  i > 0 &&
                  detail.current_qty >= (tiers[i - 1]?.qty_threshold ?? 0);
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2.5 rounded text-[13px] ${
                      isCurrent
                        ? "bg-cyan-50 text-cyan-900 font-medium border border-cyan-200"
                        : isNext
                          ? "bg-amber-50/50 text-amber-900 border border-amber-200"
                          : "bg-bg-soft border border-border"
                    }`}
                  >
                    <span className="font-mono tnum text-[12.5px]">
                      ≥ {t.qty_threshold.toLocaleString()} pcs
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono tnum">{fmtBdt(t.unit_bdt)}/pc</span>
                      {isCurrent && (
                        <span className="text-[10px] uppercase tracking-wider text-cyan-700 font-semibold">
                          {dict["group_buy.public.detail.tier_unlocked"].en}
                        </span>
                      )}
                      {isNext && (
                        <span className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">
                          {dict["group_buy.public.detail.tier_next"].en}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11.5px] text-fg-subtle mt-3 pt-3 border-t border-border">
              {dict["group_buy.public.detail.min_per_buyer"].en
                .replace("{qty}", String(detail.min_qty_per_buyer))}
            </p>
          </div>

          {/* How-it-works explainer */}
          <div className="rounded-lg border border-border bg-bg p-5">
            <p className="section-eyebrow mb-3">
              {dict["group_buy.public.detail.how_it_works"].en}
            </p>
            <p className="text-[13px] text-fg leading-relaxed">
              {dict["group_buy.public.detail.how_it_works_body"].en}
            </p>
          </div>
        </div>
      </Container>
    </>
  );
}