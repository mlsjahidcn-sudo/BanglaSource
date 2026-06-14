import { getServiceRoleClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin-page";
import OpsSyncClient, {
  type SyncStats,
  type ProductRow,
} from "./OpsSyncClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadStats(): Promise<SyncStats> {
  const supabase = getServiceRoleClient();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: history } = await supabase
    .from("price_history")
    .select("recorded_at, change_pct, old_price_cny_fen, new_price_cny_fen")
    .not("change_pct", "is", null)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(5000);

  const byDay = new Map<string, { count: number; sum: number; rises: number; drops: number }>();
  for (const r of history ?? []) {
    const day = r.recorded_at.slice(0, 10);
    const e = byDay.get(day) ?? { count: 0, sum: 0, rises: 0, drops: 0 };
    e.count += 1;
    if (r.change_pct != null) {
      e.sum += r.change_pct;
      if (r.change_pct > 0) e.rises += 1;
      if (r.change_pct < 0) e.drops += 1;
    }
    byDay.set(day, e);
  }
  const daily = Array.from(byDay.entries())
    .map(([day, v]) => ({
      day,
      movements: v.count,
      avg_change_pct: v.count > 0 ? Number((v.sum / v.count).toFixed(2)) : 0,
      rises: v.rises,
      drops: v.drops,
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .slice(0, 30);

  const topMovers = (history ?? [])
    .filter((r) => r.change_pct != null)
    .sort((a, b) => Math.abs(b.change_pct!) - Math.abs(a.change_pct!))
    .slice(0, 8);

  const { data: recentRuns } = await supabase
    .from("sync_runs")
    .select(
      "id,trigger,started_at,finished_at,products_seen,products_changed,products_added,products_removed,tiers_changed,api_cost_usd,error",
    )
    .order("started_at", { ascending: false })
    .limit(15);

  const { count: totalProducts } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });
  const { count: activeProducts } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  return {
    summary: {
      total_products: totalProducts ?? 0,
      active_products: activeProducts ?? 0,
      inactive_products: (totalProducts ?? 0) - (activeProducts ?? 0),
    },
    daily,
    top_movers: topMovers,
    recent_runs: (recentRuns ?? []) as SyncStats["recent_runs"],
  };
}

async function loadProducts(): Promise<ProductRow[]> {
  const supabase = getServiceRoleClient();
  const { data: products } = await supabase
    .from("products")
    .select(
      "id,source_id,title_zh,title_en,category,factory_moq,supplier_city,active",
    )
    .order("id", { ascending: true });
  if (!products) return [];

  const { data: latest } = await supabase
    .from("price_history")
    .select("source_id,change_pct,recorded_at")
    .not("change_pct", "is", null)
    .order("recorded_at", { ascending: false })
    .limit(200);
  const latestBySource = new Map<string, { change_pct: number; recorded_at: string }>();
  for (const l of latest ?? []) {
    if (!latestBySource.has(l.source_id)) {
      latestBySource.set(l.source_id, {
        change_pct: l.change_pct!,
        recorded_at: l.recorded_at,
      });
    }
  }

  return products.map((p) => {
    const l = latestBySource.get(p.source_id);
    return {
      id: p.id,
      source_id: p.source_id,
      title_zh: p.title_zh,
      title_en: p.title_en,
      category: p.category,
      factory_moq: p.factory_moq,
      supplier_city: p.supplier_city,
      active: p.active,
      last_change: l?.recorded_at ?? null,
      latest_change_pct: l?.change_pct ?? null,
    };
  });
}

export default async function OpsSyncPage() {
  const [stats, products] = await Promise.all([loadStats(), loadProducts()]);
  return (
    <AdminPage>
      <OpsSyncClient initialStats={stats} initialProducts={products} />
    </AdminPage>
  );
}
