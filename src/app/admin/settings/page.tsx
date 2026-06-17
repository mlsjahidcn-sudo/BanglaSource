// /admin/settings
//
// Phase 48 (2026-06-18): admin-editable runtime settings. Currently
// exposes just the CNY → BDT FX rate. Adding a new setting means:
//   1. INSERT a row into public.settings (or update the seed migration)
//   2. Add validation in src/lib/settings.ts → setSetting()
//   3. Add a form field in _client.tsx
//
// Auth: requireAdmin — anon → /login, buyer → /buyer.

import { requireAdmin } from "@/lib/portal-auth";
import { getAllSettings } from "@/lib/settings";
import { AdminPage, AdminPageHeader } from "@/components/admin-page";
import { SettingsClient } from "./_client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Settings",
};

export default async function AdminSettingsPage() {
  await requireAdmin("/admin/settings");
  const settings = await getAllSettings();

  return (
    <AdminPage>
      <AdminPageHeader
        title="Settings"
        eyebrow="Runtime configuration"
        subtitle="Live values that affect pricing across the whole site. Changes apply within 60s (or immediately on the next page load)."
      />
      <SettingsClient initialSettings={settings} />
    </AdminPage>
  );
}