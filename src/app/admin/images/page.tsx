// /admin/images
//
// Phase 15c + 15d: image-generation agent UI that works for any
// product. Admin picks a product from a search-as-you-type list,
// sets a prompt + n + reference URL (single-prompt mode) OR has
// DeepSeek draft 6 distinct prompts (multi-prompt mode), and the
// page calls POST /api/admin/images/[id]/generate-{images,prompts}.
//
// The page is a thin client; all data fetch happens on the client
// after admin picks a product. We just hand the client a list of
// lightweight product summaries (id + source_id + title_en + first
// image) so the picker can render synchronously.

import { requireAdmin } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { ImageAgentClient } from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProductSummary = {
  id: number;
  source_id: string;
  title_en: string | null;
  category: string;
  imageCount: number;
  firstImage: string | null;
};

export default async function AdminImagesPage() {
  await requireAdmin("/admin/images");

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, source_id, title_en, category, images")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  const products: ProductSummary[] = (data ?? []).map((p: any) => ({
    id: p.id,
    source_id: p.source_id,
    title_en: p.title_en ?? "",
    category: p.category,
    imageCount: Array.isArray(p.images) ? p.images.length : 0,
    firstImage: Array.isArray(p.images) && p.images.length > 0
      ? p.images[0]
      : null,
  }));

  return <ImageAgentClient products={products} />;
}
