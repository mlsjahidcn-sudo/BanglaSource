import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { AdminProductEditor, type EditorProduct } from "./_editor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HistoryRow = {
  id: number;
  qty_min: number;
  qty_max: number | null;
  old_price_cny_fen: number;
  new_price_cny_fen: number;
  change_pct: number | null;
  recorded_at: string;
  sync_run_id: string;
};

type AlertRow = {
  id: number;
  qty_min: number;
  qty_max: number | null;
  change_pct: number;
  direction: "rise" | "drop";
  detected_at: string;
  acknowledged_at: string | null;
};

async function loadProductHistory(sourceId: string) {
  const supabase = getServiceRoleClient();

  const { data: product } = await supabase
    .from("products")
    .select(
      "id,source_id,title_zh,title_en,title_bn,description_en,description_bn,category,active,markup_pct,weight_kg,volume_cbm,factory_moq,badges,supplier_name,supplier_city,supplier_province,source_url,images,price_tiers(qty_min,qty_max,price_cny_fen)",
    )
    .eq("source_id", sourceId)
    .maybeSingle();
  if (!product) return null;

  const { data: history } = await supabase
    .from("price_history")
    .select(
      "id,qty_min,qty_max,old_price_cny_fen,new_price_cny_fen,change_pct,recorded_at,sync_run_id",
    )
    .eq("source_id", sourceId)
    .order("recorded_at", { ascending: true })
    .limit(2000);

  const { data: alerts } = await supabase
    .from("price_alert_log")
    .select("id,qty_min,qty_max,change_pct,direction,detected_at,acknowledged_at")
    .eq("product_id", product.id)
    .order("detected_at", { ascending: false })
    .limit(50);

  return {
    product,
    history: (history ?? []) as HistoryRow[],
    alerts: (alerts ?? []) as AlertRow[],
  };
}

function fmtFen(fen: number) {
  return `¥${(fen / 100).toFixed(2)}`;
}

function fmtChange(pct: number | null) {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadProductHistory(id);
  if (!data) notFound();
  const { product, history, alerts } = data;

  const byTier = new Map<number, HistoryRow[]>();
  for (const h of history) {
    const arr = byTier.get(h.qty_min) ?? [];
    arr.push(h);
    byTier.set(h.qty_min, arr);
  }
  const tiers = Array.from(byTier.entries()).sort((a, b) => a[0] - b[0]);

  // Build editor-friendly product shape
  const tiersRaw = (product.price_tiers ?? []) as Array<{
    qty_min: number;
    qty_max: number | null;
    price_cny_fen: number;
  }>;
  const pricesFen = tiersRaw.map((t) => t.price_cny_fen);
  const editorProduct: EditorProduct = {
    id: product.id as number,
    source_id: product.source_id as string,
    title_zh: (product.title_zh as string) ?? "",
    title_en: (product.title_en as string) ?? "",
    title_bn: (product.title_bn as string) ?? "",
    description_en: (product.description_en as string) ?? "",
    description_bn: (product.description_bn as string) ?? "",
    category: (product.category as string) ?? "gadgets",
    active: (product.active as boolean) ?? true,
    markup_pct: Number(product.markup_pct ?? 10),
    weight_kg: Number(product.weight_kg ?? 0),
    volume_cbm: Number(product.volume_cbm ?? 0),
    images: ((product.images as string[]) ?? []).filter(Boolean),
    supplier_name: (product.supplier_name as string) ?? "",
    supplier_city: (product.supplier_city as string) ?? "",
    source_url: (product.source_url as string) ?? "",
    factory_moq: Number(product.factory_moq ?? 1),
    price_min_cny: pricesFen.length > 0 ? Math.min(...pricesFen) : 0,
    price_max_cny: pricesFen.length > 0 ? Math.max(...pricesFen) : 0,
    badges: (product.badges as string[]) ?? [],
  };

  const aiEnabled = Boolean(process.env.DEEPSEEK_API_KEY);

  return (
    <div className="p-6 md:p-8 max-w-7xl">
      <div className="mb-3 text-[12px] text-fg-subtle font-mono tnum">
        <Link href="/admin/sync" className="hover:text-fg">
          admin
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <Link href="/admin/sync" className="hover:text-fg">
          sync
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <span className="text-fg-muted">product / {product.source_id}</span>
      </div>

      <div className="flex items-end gap-3">
        <div
          className={`w-1.5 h-1.5 rounded-full mb-3 ${
            product.active ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />
        <p className="text-[12px] font-medium tracking-wider uppercase text-emerald-700">
          Product · {product.active ? "active" : "inactive"}
        </p>
      </div>
      <h1 className="mt-3 text-[28px] md:text-[36px] leading-[1.05] font-semibold tracking-[-0.02em]">
        {product.title_en}
      </h1>
      <p className="mt-2 text-[13px] text-fg-muted font-mono tnum">
        {product.title_zh}
      </p>
      <p className="mt-2 text-[14px] text-fg-muted">
        <span className="font-medium text-fg">{product.supplier_name}</span>
        {product.supplier_city ? ` · ${product.supplier_city}` : ""}
        {product.source_url ? (
          <>
            {" · "}
            <a
              href={product.source_url as string}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-fg"
            >
              1688 ↗
            </a>
          </>
        ) : null}
      </p>

      {/* ── Editor (titled section, client component) ─────────────── */}
      <section className="mt-8">
        <h2 className="text-[18px] font-semibold tracking-tight mb-4">
          Edit listing
        </h2>
        <AdminProductEditor
          product={editorProduct}
          aiEnabled={aiEnabled}
        />
      </section>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
        <SummaryCard
          label="History rows"
          value={history.length}
          sub="price_history entries"
        />
        <SummaryCard label="Tiers tracked" value={tiers.length} sub="unique qty_min" />
        <SummaryCard
          label="Alerts"
          value={alerts.length}
          sub={`${alerts.filter((a) => !a.acknowledged_at).length} unacked`}
        />
        <SummaryCard
          label="Current"
          value={
            product.price_tiers && product.price_tiers.length > 0
              ? fmtFen(
                  (product.price_tiers as Array<{ price_cny_fen: number }>)[
                    product.price_tiers.length - 1
                  ].price_cny_fen,
                )
              : "—"
          }
          sub="lowest active tier"
        />
      </div>

      <section className="mt-10">
        <h2 className="text-[18px] font-semibold tracking-tight mb-4">
          Price history by tier
        </h2>
        {tiers.length === 0 ? (
          <div className="card p-6 text-[13px] text-fg-muted">
            No history yet. Run a sync to start tracking.
          </div>
        ) : (
          <div className="space-y-4">
            {tiers.map(([qtyMin, rows]) => {
              const last = rows[rows.length - 1];
              const first = rows[0];
              const cumChange =
                first.old_price_cny_fen > 0
                  ? ((last.new_price_cny_fen - first.old_price_cny_fen) /
                      first.old_price_cny_fen) *
                    100
                  : 0;
              return (
                <div key={qtyMin} className="card p-5">
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-fg-subtle">
                        Tier
                      </p>
                      <p className="mt-1 text-[28px] font-semibold leading-none font-mono tnum">
                        {qtyMin}
                        {last.qty_max ? `–${last.qty_max}` : "+"}
                      </p>
                      <p className="text-[12px] text-fg-muted mt-1">
                        units · tracked since {fmtDate(first.recorded_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-fg-subtle">
                        Cumulative
                      </p>
                      <p
                        className={`mt-1 text-[20px] font-semibold leading-none font-mono tnum ${
                          cumChange > 0
                            ? "text-rose-600"
                            : cumChange < 0
                              ? "text-emerald-700"
                              : "text-fg-muted"
                        }`}
                      >
                        {fmtChange(cumChange)}
                      </p>
                      <p className="text-[12px] text-fg-muted mt-1 font-mono tnum">
                        {fmtFen(first.old_price_cny_fen)} →{" "}
                        {fmtFen(last.new_price_cny_fen)}
                      </p>
                    </div>
                  </div>

                  <Sparkline values={rows.map((r) => r.new_price_cny_fen)} />

                  {rows.length > 1 && (
                    <details className="mt-4">
                      <summary className="text-[12px] text-fg-muted cursor-pointer hover:text-fg">
                        {rows.length} records · show all
                      </summary>
                      <table className="w-full text-[12px] mt-3">
                        <thead className="text-[10px] uppercase tracking-wider text-fg-subtle">
                          <tr>
                            <th className="text-left font-medium py-1.5">Date</th>
                            <th className="text-right font-medium py-1.5">Old</th>
                            <th className="text-right font-medium py-1.5">New</th>
                            <th className="text-right font-medium py-1.5">Δ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows
                            .slice()
                            .reverse()
                            .map((r) => (
                              <tr
                                key={r.id}
                                className="border-t border-border"
                              >
                                <td className="py-1.5 font-mono tnum text-fg-muted">
                                  {fmtDate(r.recorded_at)}
                                </td>
                                <td className="py-1.5 text-right font-mono tnum">
                                  {fmtFen(r.old_price_cny_fen)}
                                </td>
                                <td className="py-1.5 text-right font-mono tnum">
                                  {fmtFen(r.new_price_cny_fen)}
                                </td>
                                <td
                                  className={`py-1.5 text-right font-mono tnum ${
                                    r.change_pct == null
                                      ? "text-fg-muted"
                                      : r.change_pct > 0
                                        ? "text-rose-600"
                                        : r.change_pct < 0
                                          ? "text-emerald-700"
                                          : "text-fg-muted"
                                  }`}
                                >
                                  {fmtChange(r.change_pct)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {alerts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[18px] font-semibold tracking-tight mb-4">
            Price alerts
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-fg-subtle border-b border-border">
                <tr>
                  <th className="text-left font-medium px-4 py-3">When</th>
                  <th className="text-left font-medium px-4 py-3">Tier</th>
                  <th className="text-left font-medium px-4 py-3">Direction</th>
                  <th className="text-right font-medium px-4 py-3">Δ</th>
                  <th className="text-right font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-4 py-2.5 font-mono tnum text-[12px]">
                      {fmtDate(a.detected_at)}
                    </td>
                    <td className="px-4 py-2.5 font-mono tnum text-[12px]">
                      {a.qty_min}
                      {a.qty_max ? `–${a.qty_max}` : "+"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 ${
                          a.direction === "rise"
                            ? "text-rose-600"
                            : "text-emerald-700"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            a.direction === "rise"
                              ? "bg-rose-500"
                              : "bg-emerald-500"
                          }`}
                        />
                        {a.direction}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono tnum ${
                        a.direction === "rise"
                          ? "text-rose-600"
                          : "text-emerald-700"
                      }`}
                    >
                      {fmtChange(a.change_pct)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[11px] text-fg-muted">
                      {a.acknowledged_at
                        ? `acked ${fmtDate(a.acknowledged_at)}`
                        : "open"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
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

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 600;
  const h = 60;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xStep = w / (values.length - 1);
  const points = values
    .map(
      (v, i) =>
        `${(i * xStep).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`,
    )
    .join(" ");

  const first = values[0];
  const last = values[values.length - 1];
  const rising = last > first;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="w-full h-12"
      >
        <defs>
          <linearGradient id="spark-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={rising ? "rgb(244, 63, 94)" : "rgb(5, 150, 105)"}
              stopOpacity="0.2"
            />
            <stop
              offset="100%"
              stopColor={rising ? "rgb(244, 63, 94)" : "rgb(5, 150, 105)"}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <polyline
          points={`0,${h} ${points} ${w},${h}`}
          fill="url(#spark-gradient)"
        />
        <polyline
          points={points}
          fill="none"
          stroke={rising ? "rgb(244, 63, 94)" : "rgb(5, 150, 105)"}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={(values.length - 1) * xStep}
          cy={h - ((last - min) / range) * h}
          r="2.5"
          fill={rising ? "rgb(244, 63, 94)" : "rgb(5, 150, 105)"}
        />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[10px] text-fg-subtle font-mono tnum">
        <span>min {fmtFen(min)}</span>
        <span>max {fmtFen(max)}</span>
      </div>
    </div>
  );
}
