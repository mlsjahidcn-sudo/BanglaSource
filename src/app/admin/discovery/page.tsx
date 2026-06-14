"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminPage, AdminPageHeader } from "@/components/admin-page";

type DiscoveredProduct = {
  id: number;
  offer_id: string;
  title_zh: string;
  category: string | null;
  factory_moq: number | null;
  price_tiers: Array<{ qty_min: number; qty_max: number | null; price_cny_fen: number }> | null;
  images: string[] | null;
  supplier_name: string | null;
  supplier_province: string | null;
  supplier_city: string | null;
  badges: string[] | null;
  source_url: string | null;
  status: "new" | "approved" | "rejected" | "imported";
  discovered_at: string;
  source_keyword: string | null;
};

const STATUS_BADGE: Record<DiscoveredProduct["status"], string> = {
  new: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  imported: "bg-cyan-100 text-cyan-800 border-cyan-200",
};

export default function DiscoveryClient() {
  const [items, setItems] = useState<DiscoveredProduct[] | null>(null);
  const [filter, setFilter] = useState<"new" | "approved" | "rejected" | "imported">("new");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<string | null>(null);

  async function load() {
    const r = await fetch(`/api/ops/discovery?status=${filter}`, { cache: "no-store" });
    const j = await r.json();
    setItems(j.items ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function decide(id: number, decision: "approved" | "rejected") {
    await fetch("/api/ops/discovery/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    load();
  }

  async function importOne(id: number) {
    const r = await fetch("/api/ops/discovery/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const j = await r.json();
    if (j.ok) {
      setDiscoveryResult(`Imported ${j.product_id} (${j.source_id})`);
      load();
    } else {
      setDiscoveryResult(`Error: ${j.message ?? j.error}`);
    }
  }

  async function triggerDiscovery() {
    setIsDiscovering(true);
    setDiscoveryResult("Running discovery on 12 keywords (this takes ~5 min)...");
    const r = await fetch("/api/ops/discover-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = await r.json();
    setDiscoveryResult(
      j.ok
        ? `Done. ${j.imported ?? 0} auto-imported · ${j.queued_for_review ?? 0} queued for review · ${j.duplicates ?? 0} duplicates · ${j.errors ?? 0} errors · $${j.estimated_cost_usd ?? 0} Apify.`
        : `Error: ${j.error}`,
    );
    setIsDiscovering(false);
    load();
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Catalog growth"
        title="Discoveries"
        dotColor="amber"
        subtitle="Search 1688 by keyword, review what's interesting, approve and import into the live catalog."
        actions={
          <button
            onClick={triggerDiscovery}
            disabled={isDiscovering}
            className="px-4 py-2 text-[13px] rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 font-medium"
          >
            {isDiscovering ? "Running…" : "Discover now"}
          </button>
        }
      />

      {discoveryResult && (
        <div className="mb-6 card p-4 text-[13px] font-mono tnum">
          {discoveryResult}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        {(["new", "approved", "rejected", "imported"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-[12px] rounded-md border transition-colors ${
              filter === s
                ? "border-border-strong bg-bg-soft text-fg"
                : "border-border text-fg-muted hover:text-fg"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="card p-6 text-[13px] text-fg-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card p-6 text-[13px] text-fg-muted">
          No discoveries in this state. Click <strong>Discover now</strong> to
          search 1688 for new SKUs.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <DiscoveryRow
              key={item.id}
              item={item}
              onDecide={decide}
              onImport={importOne}
            />
          ))}
        </div>
      )}

      <div className="mt-6">
        <Link
          href="/admin/sync"
          className="text-[12px] text-fg-muted hover:text-fg"
        >
          ← Back to sync
        </Link>
      </div>
    </AdminPage>
  );
}

function DiscoveryRow({
  item,
  onDecide,
  onImport,
}: {
  item: DiscoveredProduct;
  onDecide: (id: number, decision: "approved" | "rejected") => void;
  onImport: (id: number) => void;
}) {
  const lowestPriceFen = item.price_tiers?.[item.price_tiers.length - 1]?.price_cny_fen;
  const lowestPrice = lowestPriceFen != null ? `¥${(lowestPriceFen / 100).toFixed(2)}` : "—";
  const image = item.images?.[0];
  return (
    <div className="card p-4 flex gap-4 items-start">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="w-20 h-20 object-cover rounded-md border border-border shrink-0"
        />
      ) : (
        <div className="w-20 h-20 bg-bg-soft border border-border rounded-md shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-medium tracking-wider uppercase px-1.5 py-0.5 border rounded ${
              STATUS_BADGE[item.status]
            }`}
          >
            {item.status}
          </span>
          {item.category && (
            <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
              {item.category}
            </span>
          )}
          {item.source_keyword && (
            <span className="text-[10px] text-fg-subtle font-mono tnum">
              via "{item.source_keyword}"
            </span>
          )}
        </div>
        <h3 className="mt-1.5 text-[14px] font-medium leading-snug truncate">
          {item.title_zh}
        </h3>
        <p className="text-[12px] text-fg-muted mt-0.5">
          {item.supplier_name}
          {item.supplier_city ? ` · ${item.supplier_city}` : ""}
          {item.factory_moq != null ? ` · MOQ ${item.factory_moq}` : ""}
        </p>
        <p className="text-[12px] font-mono tnum text-fg-muted mt-0.5">
          Offer {item.offer_id} · {item.price_tiers?.length ?? 0} tier
          {(item.price_tiers?.length ?? 0) === 1 ? "" : "s"} · from {lowestPrice}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.status === "new" && (
          <>
            <button
              onClick={() => onDecide(item.id, "rejected")}
              className="text-[12px] px-3 py-1.5 border border-border rounded-md text-fg-muted hover:text-rose-600 hover:border-rose-200"
            >
              Reject
            </button>
            <button
              onClick={() => onDecide(item.id, "approved")}
              className="text-[12px] px-3 py-1.5 border border-border rounded-md text-fg-muted hover:text-emerald-700 hover:border-emerald-200"
            >
              Approve
            </button>
          </>
        )}
        {item.status === "approved" && (
          <button
            onClick={() => onImport(item.id)}
            className="text-[12px] px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
          >
            Import to catalog
          </button>
        )}
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-fg-muted hover:text-fg underline"
          >
            1688 ↗
          </a>
        )}
      </div>
    </div>
  );
}
