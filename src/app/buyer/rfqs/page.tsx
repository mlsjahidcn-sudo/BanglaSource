// /buyer/rfqs
//
// Phase 22: server-rendered list of the buyer's RFQs (newest
// first) + a `?action=new` mode that surfaces the new-RFQ
// form. The form lives in `_client.tsx` because it has lots
// of small interactive bits.

import { requireUser } from "@/lib/portal-auth";
import { getServerClient } from "@/lib/supabase/server";
import { RFQsClient, type RFQ } from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BuyerRFQsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const user = await requireUser("/buyer/rfqs");
  const sp = await searchParams;
  const mode = sp.action === "new" ? "new" : null;

  const sb = await getServerClient();
  const { data: raw } = await sb
    .from("rfqs")
    .select(
      "id, title, spec_text, target_qty, target_price_cny_fen, image_urls, destination_country, notes, status, quoted_price_cny_fen, quoted_min_qty, quoted_lead_days, quoted_notes, quoted_at, closed_at, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const rfqs = (raw ?? []) as RFQ[];

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-8">
        <p className="text-[12px] font-medium tracking-wider uppercase text-fg-subtle">
          Buying
        </p>
        <h1 className="mt-2 text-[32px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.02em]">
          My RFQs
        </h1>
        <p className="mt-3 text-[14px] text-fg-muted max-w-2xl">
          Custom Request-for-Quote. Use this when you need
          something not in the catalog — a private-label run,
          a specific spec, a quantity our standard SKUs can't
          fill. We forward to 3-5 verified factories and
          return sealed bids in 48 hours.
        </p>
      </div>

      <RFQsClient
        rfqs={rfqs}
        mode={mode}
        defaultName={user.fullName ?? ""}
        defaultEmail={user.email}
      />
    </div>
  );
}
