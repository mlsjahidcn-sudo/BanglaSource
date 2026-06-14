import { HomeClient } from "./_home-client";
import { getServiceRoleClient } from "@/lib/supabase/server";

// refresh every 5 minutes
export const revalidate = 60;

async function loadSyncStats() {
  try {
    const supabase = getServiceRoleClient();
    const { data: last, error: lastErr } = await supabase
      .from("sync_runs")
      .select("started_at,finished_at,error")
      .eq("source", "apify-1688-scraper")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastErr) {
      console.error("[loadSyncStats] sync_runs query failed:", lastErr.message);
    }
    const { count: active, error: activeErr } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    if (activeErr) {
      console.error("[loadSyncStats] products count failed:", activeErr.message);
    }
    return {
      activeCount: active ?? 0,
      lastSyncIso: last?.finished_at ?? last?.started_at ?? null,
      failedLast: !!last?.error,
    };
  } catch (e) {
    console.error("[loadSyncStats] thrown:", (e as Error).message);
    return { activeCount: 0, lastSyncIso: null, failedLast: false };
  }
}

export default async function HomePage() {
  const syncStats = await loadSyncStats();
  return <HomeClient syncStats={syncStats} />;
}
