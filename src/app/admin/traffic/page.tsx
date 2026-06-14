import { getServiceRoleClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PathRow = { path: string; views: number; unique_sessions: number };
type DailyRow = { day: string; views: number; unique_sessions: number };

async function loadTraffic() {
  const supabase = getServiceRoleClient();

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows7d } = await supabase
    .from("page_views")
    .select("path, session_id, recorded_at")
    .gte("recorded_at", since7d)
    .order("recorded_at", { ascending: false })
    .limit(10_000);

  const byPath = new Map<string, { views: number; sessions: Set<string> }>();
  const byDay = new Map<string, { views: number; sessions: Set<string> }>();
  let total24h = 0;
  const sessions24h = new Set<string>();
  for (const r of rows7d ?? []) {
    const ageMs = Date.now() - new Date(r.recorded_at).getTime();
    if (ageMs < 24 * 60 * 60 * 1000) {
      total24h += 1;
      if (r.session_id) sessions24h.add(r.session_id);
    }
    const day = r.recorded_at.slice(0, 10);
    const pd = byPath.get(r.path) ?? { views: 0, sessions: new Set<string>() };
    pd.views += 1;
    if (r.session_id) pd.sessions.add(r.session_id);
    byPath.set(r.path, pd);
    const dd = byDay.get(day) ?? { views: 0, sessions: new Set<string>() };
    dd.views += 1;
    if (r.session_id) dd.sessions.add(r.session_id);
    byDay.set(day, dd);
  }
  const topPaths: PathRow[] = Array.from(byPath.entries())
    .map(([path, v]) => ({
      path,
      views: v.views,
      unique_sessions: v.sessions.size,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 15);
  const daily: DailyRow[] = Array.from(byDay.entries())
    .map(([day, v]) => ({
      day,
      views: v.views,
      unique_sessions: v.sessions.size,
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));

  return { total24h, sessions24h: sessions24h.size, topPaths, daily };
}

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export default async function OpsTrafficPage() {
  const t = await loadTraffic();
  const maxDaily = Math.max(1, ...t.daily.map((d) => d.views));
  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Analytics"
        title="Traffic"
        dotColor="cyan"
        subtitle="Self-hosted pageview analytics. No cookies, no third-party scripts."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
        <Card label="Page views (24h)" value={fmt(t.total24h)} sub="logged via /api/track/pageview" />
        <Card label="Unique sessions (24h)" value={fmt(t.sessions24h)} sub="sessionStorage ID" />
        <Card label="Top pages" value={fmt(t.topPaths.length)} sub="distinct paths in 7d" />
        <Card label="Days tracked" value={fmt(t.daily.length)} sub="since first pageview" />
      </div>

      <section className="mt-10">
        <h2 className="text-[18px] font-semibold tracking-tight mb-4">
          Daily page views (7d)
        </h2>
        <div className="card p-6">
          {t.daily.length === 0 ? (
            <p className="text-[13px] text-fg-muted">No page views yet.</p>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {t.daily.map((d) => {
                // Pixel-based height: total chart height 128px, value label
                // takes ~20px, bar gets up to 100px. We use pixel height
                // (not %) so small bars are still visible.
                const BAR_AREA_PX = 100;
                const h = Math.max(2, (d.views / maxDaily) * BAR_AREA_PX);
                return (
                  <div
                    key={d.day}
                    className="flex-1 flex flex-col items-center justify-end gap-1"
                    title={`${d.day}: ${d.views} views, ${d.unique_sessions} sessions`}
                  >
                    <span className="text-[9px] text-fg-muted font-mono tnum">
                      {d.views}
                    </span>
                    <div
                      className="w-full bg-cyan-500/80 hover:bg-cyan-500 rounded-sm"
                      style={{ height: `${h}px` }}
                    />
                    <span className="text-[10px] text-fg-subtle font-mono tnum">
                      {d.day.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[18px] font-semibold tracking-tight mb-4">
          Top paths (7d)
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3">Path</th>
                <th className="text-right font-medium px-4 py-3">Views</th>
                <th className="text-right font-medium px-4 py-3">Unique</th>
              </tr>
            </thead>
            <tbody>
              {t.topPaths.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-fg-muted py-8">
                    No page views yet.
                  </td>
                </tr>
              ) : (
                t.topPaths.map((p) => (
                  <tr
                    key={p.path}
                    className="border-b border-border last:border-b-0 hover:bg-bg-soft"
                  >
                    <td className="px-4 py-2 font-mono tnum text-[12px]">
                      {p.path}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tnum">
                      {fmt(p.views)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tnum text-fg-muted">
                      {fmt(p.unique_sessions)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPage>
  );
}

function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-bg p-4 md:p-5">
      <p className="text-[10px] font-medium tracking-wider uppercase text-fg-subtle">
        {label}
      </p>
      <p className="mt-1.5 text-[24px] md:text-[28px] font-semibold leading-none font-mono tnum">
        {value}
      </p>
      <p className="mt-2 text-[11px] text-fg-muted">{sub}</p>
    </div>
  );
}
