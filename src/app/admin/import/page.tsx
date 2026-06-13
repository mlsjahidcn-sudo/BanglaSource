import { requireAdmin } from "@/lib/portal-auth";
import { ImportClient } from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminImportPage() {
  await requireAdmin("/admin/import");
  return <ImportClient />;
}
