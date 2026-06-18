// /group-buys — public listing of all open group buys.
//
// Phase 39. Server component. Reads the latest snapshot from
// Supabase at request time, then renders a filterable grid.
// Buyers don't need to be signed in to view this — the join
// action on the detail page gates sign-in.

import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { CATEGORIES } from "@/lib/catalog-categories";
import { dict } from "@/lib/i18n-dict";
import {
  jsonLdScript,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
import { getServiceRoleClient } from "@/lib/supabase/server";
import {
  groupBuyPriceAtQty,
  groupBuyNextTier,
  type GroupBuyPriceTier,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Group buys",
  description: `Pay-on-success bulk deals. Commit a quantity; if the group's target is met by the deadline, every member is charged at the final tiered price. ${SITE_DESCRIPTION}`,
  alternates: { canonical: `${SITE_URL}/group-buys` },
  openGraph: {
    type: "website",
    title: `Group buys · ${SITE_NAME}`,
    description: `Pay-on-success bulk deals. Commit a quantity, save when the group forms.`,
    url: `${SITE_URL}/group-buys`,
  },
};

type GroupBuyCard = {
  id: string;
  product_id: number;
  target_qty: number;
  min_qty_per_buyer: number;
  deadline_at: string;
  current_qty: number;
  buyers_count: number;
  progress_pct: number;
  current_price: number;
  next_tier: { qty_threshold: number; unit_bdt: number } | null;
  product: {
    source_id: string;
    title_en: string;
    title_bn: string | null;
    image: string | null;
    category: string;
  };
};

function fmtBdt(n: number): string {
  return `৳${n.toLocaleString("en-BD")}`;
}

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "passed";
  const days = Math.floor(ms / 86400_000);
  const hours = Math.floor((ms % 86400_000) / 3600_000);
  const mins = Math.floor((ms % 3600_000) / 60_000);
  if (days >= 2) return `${days}d ${hours}h`;
  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${mins}m`;
  return `${Math.max(mins, 0)}m`;
}

async function loadGroupBuys(
  category: string | null,
  sort: "deadline" | "progress",
): Promise<GroupBuyCard[]> {
  const sb = getServiceRoleClient();

  let q = sb
    .from("group_buys")
    .select(
      "id, product_id, target_qty, min_qty_per_buyer, price_tiers, deadline_at, products!inner(source_id, title_en, title_bn, images, category)",
    )
    .eq("status", "open")
    .gt("deadline_at", new Date().toISOString())
    .order("deadline_at", { ascending: true })
    .limit(100);
  if (category) {
    q = q.eq("products.category", category);
  }
  const { data: rows, error } = await q;
  if (error || !rows || rows.length === 0) return [];

  // Bulk-load SUM(qty) per group.
  const ids = rows.map((r) => r.id);
  const { data: memberRows } = await sb
    .from("group_buy_members")
    .select("group_buy_id, qty, user_id")
    .in("group_buy_id", ids);

  const qtyByGroup = new Map<string, { qty: number; buyers: number }>();
  const userSetByGroup = new Map<string, Set<string>>();
  for (const m of memberRows ?? []) {
    const cur = qtyByGroup.get(m.group_buy_id) ?? { qty: 0, buyers: 0 };
    cur.qty += m.qty ?? 0;
    const u = (m as { user_id?: string }).user_id;
    if (u) {
      const s = userSetByGroup.get(m.group_buy_id) ?? new Set<string>();
      s.add(u);
      cur.buyers = s.size;
      userSetByGroup.set(m.group_buy_id, s);
    }
    qtyByGroup.set(m.group_buy_id, cur);
  }

  type Row = (typeof rows)[number] & {
    products: {
      source_id: string;
      title_en: string;
      title_bn: string | null;
      images: string[] | null;
      category: string;
    };
  };

  const cards: GroupBuyCard[] = (rows as Row[]).map((r) => {
    const tiers = (r.price_tiers as unknown as GroupBuyPriceTier[]) ?? [];
    const acc = qtyByGroup.get(r.id) ?? { qty: 0, buyers: 0 };
    const currentPrice = groupBuyPriceAtQty(tiers, acc.qty);
    const nextTier = groupBuyNextTier(tiers, acc.qty);
    const progressPct =
      r.target_qty > 0
        ? Math.min(100, Math.round((acc.qty / r.target_qty) * 100))
        : 0;
    return {
      id: r.id,
      product_id: r.product_id,
      target_qty: r.target_qty,
      min_qty_per_buyer: r.min_qty_per_buyer,
      deadline_at: r.deadline_at,
      current_qty: acc.qty,
      buyers_count: acc.buyers,
      progress_pct: progressPct,
      current_price: currentPrice,
      next_tier: nextTier,
      product: {
        source_id: r.products.source_id,
        title_en: r.products.title_en,
        title_bn: r.products.title_bn,
        image: r.products.images?.[0] ?? null,
        category: r.products.category,
      },
    };
  });

  if (sort === "progress") {
    cards.sort((a, b) => b.progress_pct - a.progress_pct);
  }
  return cards;
}

export default async function GroupBuysListingPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const category =
    sp.category && CATEGORIES.some((c) => c.value === sp.category)
      ? sp.category
      : null;
  const sort = sp.sort === "progress" ? "progress" : "deadline";
  const items = await loadGroupBuys(category, sort);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Group buys · ${SITE_NAME}`,
    description:
      "Active group buys with pay-on-success bulk pricing.",
    url: `${SITE_URL}/group-buys`,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <Container className="pt-10 md:pt-14 pb-24">
        <header className="max-w-3xl">
          <p className="section-eyebrow">{dict["group_buy.public.title"].en}</p>
          <h1 className="mt-2">
            {dict["group_buy.public.title"].en}
          </h1>
          <p className="mt-3 text-[14px] text-fg-muted max-w-2xl">
            {dict["group_buy.public.subtitle"].en}
          </p>
        </header>

        {/* Filter row */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <FilterChip
            href={`/group-buys${sort !== "deadline" ? `?sort=${sort}` : ""}`}
            label={dict["group_buy.public.filter.all"].en}
            active={category === null}
          />
          {CATEGORIES.map((c) => (
            <FilterChip
              key={c.value}
              href={`/group-buys?category=${c.value}${
                sort !== "deadline" ? `&sort=${sort}` : ""
              }`}
              label={c.label}
              active={category === c.value}
            />
          ))}
          <span className="mx-1 text-fg-subtle text-[12px]">·</span>
          <FilterChip
            href={`/group-buys${
              category ? `?category=${category}` : ""
            }?sort=deadline`.replace("??", "?")}
            label={dict["group_buy.public.filter.sort.deadline"].en}
            active={sort === "deadline"}
          />
          <FilterChip
            href={`/group-buys${
              category ? `?category=${category}` : ""
            }?sort=progress`.replace("??", "?")}
            label={dict["group_buy.public.filter.sort.progress"].en}
            active={sort === "progress"}
          />
        </div>

        {items.length === 0 ? (
          <div className="mt-12 rounded-lg border border-border bg-bg p-12 text-center">
            <p className="text-[14px] text-fg-muted">
              {dict["group_buy.public.empty"].en}
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((it) => (
              <li key={it.id}>
                <GroupBuyCardItem item={it} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-cyan-600 text-white border-cyan-600"
          : "bg-bg text-fg-muted border-border hover:border-cyan-300 hover:text-cyan-700"
      }`}
    >
      {label}
    </Link>
  );
}

function GroupBuyCardItem({ item }: { item: GroupBuyCard }) {
  const pct = item.progress_pct;
  const isFull = pct >= 100;
  return (
    <Link
      href={`/group-buys/${item.id}`}
      className="card block p-0 hover:border-cyan-300 transition-colors overflow-hidden h-full"
    >
      {/* Product image */}
      <div className="aspect-[4/3] bg-slate-50 border-b border-border overflow-hidden relative">
        {item.product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.product.image}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-fg-subtle text-[12px]">
            no image
          </div>
        )}
        {isFull && (
          <span className="absolute top-2 right-2 status-pill is-success">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Target reached
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium">
          {item.product.category}
        </p>
        <h2 className="mt-1 heading-4 !text-[15px] font-medium leading-snug line-clamp-2">
          {item.product.title_en}
        </h2>
        <p className="text-[10.5px] text-fg-subtle font-mono mt-0.5">
          {item.product.source_id}
        </p>

        {/* Progress */}
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-[11.5px] text-fg-muted">
            <span>
              {item.current_qty.toLocaleString()} /{" "}
              {item.target_qty.toLocaleString()} pcs
            </span>
            <span className="font-mono tnum font-medium text-cyan-700">
              {pct}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded overflow-hidden mt-1">
            <div
              className={`h-full transition-all ${
                isFull ? "bg-emerald-500" : "bg-cyan-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10.5px] text-fg-subtle mt-1">
            {item.buyers_count}{" "}
            {dict["group_buy.public.card.buyers"].en} · {timeUntil(item.deadline_at)}{" "}
            {dict["group_buy.public.card.ends_in"].en}
          </p>
        </div>

        {/* Price */}
        <div className="mt-3 pt-3 border-t border-border flex items-baseline justify-between">
          <span className="text-[11px] text-fg-subtle uppercase tracking-wider">
            Now
          </span>
          <span className="font-mono tnum font-semibold text-cyan-700">
            {fmtBdt(item.current_price)}/pc
          </span>
        </div>
        {item.next_tier && (
          <p className="text-[11px] text-amber-700 mt-1.5">
            {dict["group_buy.public.card.unlocks_at"].en
              .replace("{qty}", `+${item.next_tier.qty_threshold - item.current_qty}`)
              .replace("{price}", fmtBdt(item.next_tier.unit_bdt))}
          </p>
        )}
      </div>
    </Link>
  );
}