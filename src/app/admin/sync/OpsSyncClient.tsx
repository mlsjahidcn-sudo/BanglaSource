"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminPageHeader } from "@/components/admin-page";

type SyncStats = {
  summary: {
    total_products: number;
    active_products: number;
    inactive_products: number;
  };
  daily: Array<{
    day: string;
    movements: number;
    avg_change_pct: number;
    rises: number;
    drops: number;
  }>;
  top_movers: Array<{
    recorded_at: string;
    change_pct: number;
    old_price_cny_fen: number;
    new_price_cny_fen: number;
  }>;
  recent_runs: Array<{
    id: string;
    trigger: string;
    started_at: string;
    finished_at: string | null;
    products_seen: number;
    products_changed: number;
    products_added: number;
    products_removed: number;
    tiers_changed: number;
    api_cost_usd: number;
    error: string | null;
  }>;
};

type ProductRow = {
  id: number;
  source_id: string;
  title_zh: string;
  title_en: string | null;
  category: string;
  factory_moq: number;
  supplier_city: string;
  active: boolean;
  last_change: string | null;
  latest_change_pct: number | null;
};

export default function OpsSyncClient({
  initialStats,
  initialProducts,
}: {
  initialStats: SyncStats;
  initialProducts: ProductRow[];
}) {
  const [stats, setStats] = useState<SyncStats>(initialStats);
  const [products, setProducts] = useState<ProductRow[]>(initialProducts);
  const [isSyncing, startSync] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function refresh() {
    const [s, p] = await Promise.all([
      fetch("/api/ops/sync-stats", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/ops/products-with-history", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setStats(s);
    setProducts(p.products ?? []);
  }

  function triggerSync() {
    startSync(async () => {
      setSyncMessage("Running… this takes 1-2 minutes");
      const r = await fetch("/api/ops/sync-now", { method: "POST" });
      const j = await r.json();
      if (j.ok) {
        setSyncMessage(
          `Done. ${j.summary.products_seen} seen, ${j.summary.products_changed} changed, ${j.summary.products_added} added, ${j.summary.products_removed} removed. $${j.summary.estimated_cost_usd} Apify.`,
        );
        refresh();
      } else {
        setSyncMessage(`Error: ${j.message ?? j.error}`);
      }
    });
  }

  async function toggleActive(p: ProductRow) {
    await fetch("/api/ops/products/toggle-active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: p.source_id, active: !p.active }),
    });
    refresh();
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="1688 integration"
        title="Sync"
        dotColor="emerald"
        subtitle={
          <>
            Nightly Apify scraper results.{" "}
            <code className="text-[12px] font-mono px-1.5 py-0.5 bg-bg-soft rounded">
              price_history
            </code>{" "}
            and{" "}
            <code className="text-[12px] font-mono px-1.5 py-0.5 bg-bg-soft rounded">
              sync_runs
            </code>
            .
          </>
        }
        actions={
          <>
            <Link
              href="/admin/discovery"
              className="px-3 py-2 text-[13px] border border-border rounded-md hover:bg-bg-soft"
            >
              Discoveries →
            </Link>
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className="px-4 py-2 text-[13px] rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 font-medium"
            >
              {isSyncing ? "Syncing…" : "Sync now"}
            </button>
          </>
        }
      />

      {syncMessage && (
        <div className="mb-6 card p-4 text-[13px] font-mono tnum">
          {syncMessage}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
        <SummaryCard
          label="Catalog size"
          value={stats.summary.total_products}
          sub={`${stats.summary.active_products} active · ${stats.summary.inactive_products} inactive`}
        />
        <SummaryCard
          label="Price moves (30d)"
          value={stats.daily.reduce((s, d) => s + d.movements, 0)}
          sub="tier rows with non-null change"
        />
        <SummaryCard
          label="Runs (recent)"
          value={stats.recent_runs.length}
          sub="from sync_runs table"
        />
        <SummaryCard
          label="Last cost"
          value={
            stats.recent_runs[0]?.api_cost_usd
              ? `$${stats.recent_runs[0].api_cost_usd.toFixed(4)}`
              : "—"
          }
          sub={stats.recent_runs[0]?.trigger ?? "no runs yet"}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-[18px] font-semibold tracking-tight">
              Daily price movements
            </h2>
            <p className="text-[12px] text-fg-subtle font-mono tnum">
              last {stats.daily.length} days
            </p>
          </div>
          <div className="card p-6">
            {stats.daily.length === 0 ? (
              <p className="text-[13px] text-fg-muted">
                No movements yet. Run sync to populate.
              </p>
            ) : (
              <DailyChart daily={stats.daily} />
            )}
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-[18px] font-semibold tracking-tight">
              Top movers
            </h2>
          </div>
          <div className="card p-4 space-y-2.5">
            {stats.top_movers.length === 0 ? (
              <p className="text-[12px] text-fg-muted">No movements yet.</p>
            ) : (
              stats.top_movers.slice(0, 8).map((m, i) => {
                const rising = m.change_pct > 0;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[12px] font-mono tnum"
                  >
                    <span className="text-fg-muted">
                      {fmtDate(m.recorded_at)}
                    </span>
                    <span className={rising ? "text-rose-600" : "text-emerald-700"}>
                      {rising ? "↑" : "↓"} {Math.abs(m.change_pct).toFixed(1)}%
                    </span>
                    <span>
                      ¥{(m.old_price_cny_fen / 100).toFixed(2)} → ¥
                      {(m.new_price_cny_fen / 100).toFixed(2)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <section className="mt-10">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-[18px] font-semibold tracking-tight">Catalog</h2>
          <p className="text-[12px] text-fg-subtle font-mono tnum">
            {products.length} products
          </p>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3">Product</th>
                <th className="text-left font-medium px-4 py-3">Source ID</th>
                <th className="text-left font-medium px-4 py-3">Category</th>
                <th className="text-left font-medium px-4 py-3">Factory</th>
                <th className="text-right font-medium px-4 py-3">Last move</th>
                <th className="text-right font-medium px-4 py-3">Status</th>
                <th className="text-right font-medium px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.source_id}
                  className="border-b border-border last:border-b-0 hover:bg-bg-soft transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/products/${p.source_id}`}
                      className="hover:underline"
                    >
                      {p.title_en ?? p.title_zh}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono tnum text-[12px] text-fg-muted">
                    {p.source_id}
                  </td>
                  <td className="px-4 py-2.5 text-[12px]">{p.category}</td>
                  <td className="px-4 py-2.5 text-[12px] text-fg-muted">
                    {p.supplier_city}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tnum text-[12px]">
                    {p.last_change ? (
                      <span
                        className={
                          (p.latest_change_pct ?? 0) > 0
                            ? "text-rose-600"
                            : (p.latest_change_pct ?? 0) < 0
                              ? "text-emerald-700"
                              : "text-fg-muted"
                        }
                      >
                        {(p.latest_change_pct ?? 0) > 0 ? "+" : ""}
                        {(p.latest_change_pct ?? 0).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12px]">
                    {p.active ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-rose-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => toggleActive(p)}
                      className="text-[11px] text-fg-muted hover:text-fg underline"
                    >
                      {p.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[18px] font-semibold tracking-tight mb-4">
          Recent sync runs
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3">Started</th>
                <th className="text-left font-medium px-4 py-3">Trigger</th>
                <th className="text-right font-medium px-4 py-3">Seen</th>
                <th className="text-right font-medium px-4 py-3">Changed</th>
                <th className="text-right font-medium px-4 py-3">Added</th>
                <th className="text-right font-medium px-4 py-3">Removed</th>
                <th className="text-right font-medium px-4 py-3">Cost</th>
                <th className="text-right font-medium px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-fg-muted py-8">
                    No sync runs yet.
                  </td>
                </tr>
              ) : (
                stats.recent_runs.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-b-0 hover:bg-bg-soft transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono tnum text-[12px]">
                      {fmtDate(r.started_at)}
                    </td>
                    <td className="px-4 py-2.5 text-[12px]">
                      <span
                        className={
                          r.error
                            ? "text-rose-600"
                            : r.trigger === "manual-script"
                              ? "text-fg-muted"
                              : "text-fg"
                        }
                      >
                        {r.trigger}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum">
                      {r.products_seen}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum">
                      {r.products_changed}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum text-emerald-700">
                      {r.products_added}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum text-rose-600">
                      {r.products_removed}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum text-[12px]">
                      {r.api_cost_usd ? `$${r.api_cost_usd.toFixed(4)}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tnum text-[12px]">
                      {fmtDuration(r.started_at, r.finished_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
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

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(start: string, end: string | null) {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function DailyChart({
  daily,
}: {
  daily: Array<{ day: string; movements: number; rises: number; drops: number }>;
}) {
  const w = 600;
  const h = 80;
  const max = Math.max(1, ...daily.map((d) => d.movements));
  const xStep = w / Math.max(1, daily.length - 1);
  const points = daily
    .map(
      (d, i) =>
        `${(i * xStep).toFixed(1)},${(h - (d.movements / max) * h).toFixed(1)}`,
    )
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-32">
        <defs>
          <linearGradient id="daily-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(5, 150, 105)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(5, 150, 105)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={`0,${h} ${points} ${w},${h}`} fill="url(#daily-gradient)" />
        <polyline
          points={points}
          fill="none"
          stroke="rgb(5, 150, 105)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {daily.map((d, i) => (
          <circle
            key={d.day}
            cx={i * xStep}
            cy={h - (d.movements / max) * h}
            r="2.5"
            fill="rgb(5, 150, 105)"
          />
        ))}
      </svg>
      <div className="mt-3 flex items-center gap-6 text-[11px] text-fg-subtle font-mono tnum">
        <span>total: {daily.reduce((s, d) => s + d.movements, 0)}</span>
        <span>·</span>
        <span>rises: {daily.reduce((s, d) => s + d.rises, 0)}</span>
        <span>·</span>
        <span>drops: {daily.reduce((s, d) => s + d.drops, 0)}</span>
      </div>
    </div>
  );
}
