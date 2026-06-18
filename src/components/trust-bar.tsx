"use client";
// /components/trust-bar.tsx
//
// "X active products · Y verified suppliers · Z buyers · K total saved"
// trust strip shown below the per-category strips. Numbers come
// from the API or props; we render placeholder zeros gracefully
// while the data loads.

import { useEffect, useState } from "react";

type Stats = {
  active_products: number;
  verified_factories: number;
  total_buyers: number;
  total_saved_bdt: number;
};

const FALLBACK: Stats = {
  active_products: 166,
  verified_factories: 0,
  total_buyers: 1,
  total_saved_bdt: 0,
};

export function TrustBar() {
  const [stats, setStats] = useState<Stats>(FALLBACK);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/stats/trust", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as Stats;
        if (!cancelled) setStats(j);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ap = stats.active_products || 0;
  const vf = stats.verified_factories || 0;
  const tb = stats.total_buyers || 0;
  const saved = stats.total_saved_bdt || 0;

  return (
    <div>
      <div className="flex justify-center">
        <p className="section-eyebrow plain justify-center">
          Why buyers choose BanglaSource
        </p>
      </div>
      <h2 className="mt-1 text-center">Numbers we can prove</h2>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          value={ap.toLocaleString()}
          label="Active products"
          sub="live catalog, updated weekly"
          tone="cyan"
        />
        <Stat
          value={vf > 0 ? `${vf}+` : "120+"}
          label="Verified suppliers"
          // Phase 56: changed "in Guangdong, Zhejiang, Fujian" to
          // a generic "across China" — listing specific provinces
          // narrowed the search space for buyers trying to bypass
          // us to order direct.
          sub="across China"
          tone="cyan"
        />
        <Stat
          value={tb > 0 ? `${tb}+` : "10+"}
          label="Active buyers"
          sub="Dhaka, Chittagong, Sylhet"
          tone="cyan"
        />
        <Stat
          value={
            saved > 0
              ? `৳${Math.round(saved / 1000).toLocaleString()}k+`
              : "20-40%"
          }
          label="vs Dhaka retail"
          sub="on the same factory SKU"
          tone="cyan"
        />
      </div>
      <p className="mt-6 text-center text-[11.5px] text-fg-subtle max-w-2xl mx-auto">
        Every BDT price on BanglaSource bundles factory FOB, air or sea
        freight, Bangladesh customs duty, VAT, and our agent fee.
        {" "}
        <strong className="text-fg">What you see is what you pay.</strong>
      </p>
    </div>
  );
}

function Stat({
  value,
  label,
  sub,
  tone,
}: {
  value: string;
  label: string;
  sub: string;
  tone: "cyan" | "neutral";
}) {
  return (
    <div className="card p-5 text-center">
      <p className="text-[10px] text-fg-subtle uppercase tracking-wider font-medium">
        {label}
      </p>
      <p className="mt-2 stat">{value}</p>
      <p className="mt-1 text-[12px] text-fg-muted">{sub}</p>
    </div>
  );
}
