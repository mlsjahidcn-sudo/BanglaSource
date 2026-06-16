import { requireUser } from "@/lib/portal-auth";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { ProfileEditor } from "./_client";

export default async function BuyerProfilePage() {
  const user = await requireUser("/buyer");
  const supabase = getServiceRoleClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, company, phone, country, created_at, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  return (
    <ProfileEditor
      initial={{
        email: profile?.email ?? user.email ?? "",
        full_name: profile?.full_name ?? null,
        company: profile?.company ?? null,
        phone: profile?.phone ?? null,
        country: profile?.country ?? null,
        is_admin: profile?.is_admin ?? false,
        created_at: profile?.created_at ?? null,
      }}
    />
  );
}
