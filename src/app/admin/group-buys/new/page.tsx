// /admin/group-buys/new
//
// Phase 37: admin Group Buy create. Server-side fetches the
// active product list (limited to 500, ordered by most-recently-
// updated) and hands it to the client form. The form does the
// search/filter client-side; the server keeps it under 500 rows
// to make the dropdown snappy.
//
// On submit the client POSTs to /api/admin/group-buys which
// runs the auth check, re-validates the payload, and inserts
// via the service-role client. The trigger `group_buys_touch`
// stamps updated_at; nothing else fires at create time.

import { requireAdmin } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { NewGroupBuyClient } from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewGroupBuyPage() {
  await requireAdmin("/admin/group-buys/new");
  const sb = getServiceRoleClient();
  const { data, error } = await sb
    .from("products")
    .select("id, source_id, title_en, title_bn, category, images, factory_moq")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) {
    return (
      <div className="p-6 text-red-700">
        Failed to load products: {error.message}
      </div>
    );
  }
  return <NewGroupBuyClient products={data ?? []} />;
}
