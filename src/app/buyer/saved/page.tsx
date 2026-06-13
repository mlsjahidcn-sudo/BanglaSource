// /app/buyer/saved/page.tsx
//
// Buyer's watchlist. Server-rendered list of all products the
// current user has saved, with quick actions (remove, add to order
// list, view). Reads via the service-role client + a manual RLS-
// equivalent filter on user_id (the watchlist RLS policy also
// restricts to auth.uid() = user_id, so the service-role read is
// safe in practice — the route is server-rendered after requireUser
// has verified the session).

import { requireUser } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { WatchlistGrid } from "./_client";
import Link from "next/link";
import { fmtBdt, FX_CNY_BDT } from "@/lib/pricing";
import Image from "next/image";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type WatchlistRow = {
  id: number;
  product_id: number;
  saved_at: string;
  products: {
    id: number;
    source_id: string;
    title_en: string;
    title_bn: string;
    images: string[];
    category: string;
    factory_moq: number;
    rating_overall: number;
    order_count_30d: number;
    price_tiers: Array<{ price_cny_fen: number }>;
  } | null;
};

async function loadWatchlist(userId: string): Promise<WatchlistRow[]> {
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("watchlist")
      .select(
        "id, product_id, saved_at, products:product_id(id, source_id, title_en, title_bn, images, category, factory_moq, rating_overall, order_count_30d, price_tiers(price_cny_fen))",
      )
      .eq("user_id", userId)
      .order("saved_at", { ascending: false })
      .limit(200);
    if (error) return [];
    return (data ?? []) as unknown as WatchlistRow[];
  } catch {
    return [];
  }
}

export default async function BuyerSavedPage() {
  const user = await requireUser("/buyer/saved");
  const items = await loadWatchlist(user.id);

  // Enrich with BDT prices for the list view
  const enriched = items
    .filter((i) => i.products != null)
    .map((i) => {
      const tiers = i.products!.price_tiers ?? [];
      const minFen = tiers.length
        ? Math.min(...tiers.map((t) => t.price_cny_fen))
        : 0;
      return {
        id: i.id,
        product_id: i.product_id,
        saved_at: i.saved_at,
        source_id: i.products!.source_id,
        title_en: i.products!.title_en,
        title_bn: i.products!.title_bn,
        image: (i.products!.images ?? [])[0] ?? "",
        category: i.products!.category,
        factory_moq: i.products!.factory_moq,
        min_bdt: Math.ceil((minFen / 100) * FX_CNY_BDT),
      };
    });

  return (
    <Container className="py-8 max-w-5xl">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
            Buying
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.01em]">
            Saved items
          </h1>
          <p className="mt-1.5 text-[13px] text-fg-muted max-w-md">
            Products you've bookmarked. We'll surface price drops and
            restock alerts here.
          </p>
        </div>
        {enriched.length > 0 && (
          <p className="text-[12px] font-mono tnum text-fg-subtle">
            {enriched.length} {enriched.length === 1 ? "item" : "items"}
          </p>
        )}
      </div>

      {enriched.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-bg-soft border border-border flex items-center justify-center mx-auto">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h3 className="mt-4 text-[16px] font-semibold">No saved items yet</h3>
          <p className="mt-1.5 text-[13px] text-fg-muted max-w-sm mx-auto">
            Click the heart on any product card or the "Save to
            watchlist" button on a product page to add it here.
          </p>
          <Link
            href="/categories"
            className="mt-5 inline-flex h-10 items-center px-4 text-[13px] font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Browse catalog →
          </Link>
        </div>
      ) : (
        <WatchlistGrid items={enriched} />
      )}
    </Container>
  );
}
