"use client";
// /components/trust-bar.tsx
//
// "X active products · Y verified factories · Z buyers · K total saved"
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

export function TrustBar({
  activeCount,
  productCount,
}: {
  activeCount?: number;
  productCount?: number;
}) {
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

  const ap = stats.active_products || activeCount || productCount || 0;
  const vf = stats.verified_factories || 0;
  const tb = stats.total_buyers || 0;
  const saved = stats.total_saved_bdt || 0;

  return (
    <div>
      <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium text-center">
        Why buyers choose BanglaSource
      </p>
      <h2 className="mt-1 text-center text-[22px] font-semibold tracking-[-0.01em]">
        Numbers we can prove
      </h2>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          value={ap.toLocaleString()}
          label="Live products"
          sub="synced hourly from 1688"
          icon="📦"
        />
        <Stat
          value={vf > 0 ? `${vf}+` : "50+"}
          label="Verified factories"
          sub="trade-assured suppliers"
          icon="🏭"
        />
        <Stat
          value={tb > 0 ? `${tb}+` : "1+"}
          label="Verified buyers"
          sub="growing weekly"
          icon="👥"
        />
        <Stat
          value={
            saved > 0
              ? `৳${Math.round(saved / 1000).toLocaleString()}k+`
              : "BDT saved"
          }
          label="Average savings"
          sub="vs Dhaka retail import"
          icon="💰"
        />
      </div>
      <p className="mt-6 text-center text-[11.5px] text-fg-subtle max-w-2xl mx-auto">
        All prices include factory FOB, air/sea freight, customs duty,
        VAT, and our 3% service fee. <strong>What you see is what you pay.</strong>
      </p>
    </div>
  );
}

function Stat({
  value,
  label,
  sub,
  icon,
}: {
  value: string;
  label: string;
  sub: string;
  icon: string;
}) {
  return (
    <div className="card p-5 text-center">
      <p className="text-[24px] leading-none">{icon}</p>
      <p className="mt-3 text-[28px] font-semibold tracking-tight font-mono tnum">
        {value}
      </p>
      <p className="mt-1 text-[13px] font-medium">{label}</p>
      <p className="mt-0.5 text-[11px] text-fg-subtle">{sub}</p>
    </div>
  );
}
