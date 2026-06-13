"use client";
// /search/_client.tsx
//
// Search page. Tries the new AI NL search first (POST /api/ai/search).
// If it returns ok, shows parsed filters as chips. Falls back to the
// legacy GET /api/search if AI isn't configured or returns 5xx.
//
// The search box is a controlled <input>. The user can paste NL
// queries ("cheap wireless earphones for running under ৳500") or
// simple keywords ("jbl earbuds") — same flow.

import { useEffect, useState, Suspense, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Container } from "@/components/ui/container";
import { useLang } from "@/lib/i18n";
import { fmtBdt, FX_CNY_BDT } from "@/lib/pricing";

type Hit = {
  id: string;
  title_en: string;
  title_bn: string;
  image: string;
  price_cny_fen: number;
  category: string;
  factory_moq?: number;
  rating_overall?: number;
  order_count_30d?: number;
  stock_total?: number;
};

type Parsed = {
  keywords: string[];
  category: string | null;
  price_min_bdt: number | null;
  price_max_bdt: number | null;
  supplier_brand: string | null;
  sort: "price_asc" | "price_desc" | "popularity" | "newest" | null;
  in_stock_only: boolean;
  low_moq: boolean;
};

const SORT_LABEL: Record<NonNullable<Parsed["sort"]>, string> = {
  price_asc: "Cheapest first",
  price_desc: "Most expensive first",
  popularity: "Most popular",
  newest: "Newest",
};

function SearchPageInner() {
  const { t, lang } = useLang();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [results, setResults] = useState<Hit[]>([]);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [loading, setLoading] = useState(false);
  const [usedAi, setUsedAi] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync the input with the URL on back/forward navigation
  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  // Run search whenever the URL query changes (debounced)
  useEffect(() => {
    if (!urlQ || urlQ.length < 2) {
      setResults([]);
      setParsed(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(urlQ), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [urlQ]);

  async function runSearch(query: string) {
    setLoading(true);
    setErr(null);
    setUsedAi(false);
    setParsed(null);
    setResults([]);

    // Try AI search first
    try {
      const r = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query }),
      });
      const j = await r.json();
      if (j.ok) {
        setUsedAi(true);
        setParsed(j.parsed);
        setResults(j.results);
        setLoading(false);
        return;
      }
      // 503 = deepseek not configured; fall through to legacy
      if (j.error && j.error !== "deepseek_not_configured") {
        setErr(j.error);
      }
    } catch {
      // network — fall through
    }

    // Fallback: legacy keyword search
    try {
      const r = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&limit=24`,
        { cache: "no-store" },
      );
      const j = await r.json();
      if (j.ok) setResults(j.results);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = q.trim();
    if (!next) return;
    router.replace(`${pathname}?q=${encodeURIComponent(next)}`);
  }

  const hasFilters =
    parsed &&
    (parsed.keywords.length > 0 ||
      parsed.category ||
      parsed.price_min_bdt != null ||
      parsed.price_max_bdt != null ||
      parsed.supplier_brand ||
      parsed.sort);

  return (
    <Container className="py-10">
      <form onSubmit={handleSubmit} className="mb-6">
        <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
          {lang === "bn" ? "অনুসন্ধান" : "Search"}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              lang === "bn"
                ? "যেমন: ৫০০ টাকার নিচে সানগ্লাস"
                : "Try: cheap wireless earphones for running under ৳500"
            }
            className="flex-1 h-12 px-4 bg-bg border border-border rounded-md text-[15px] focus:border-border-strong outline-none"
            autoFocus
          />
          <button
            type="submit"
            className="h-12 px-5 bg-cyan-600 text-white rounded-md text-[14px] font-medium hover:bg-cyan-700"
          >
            Search
          </button>
        </div>
        {q && (
          <p className="mt-2 text-[12px] text-fg-subtle">
            <span className="font-mono tnum">{results.length}</span>{" "}
            {results.length === 1 ? "result" : "results"}
            {usedAi && parsed && (
              <span className="ml-2 text-emerald-700">
                · smart search
              </span>
            )}
          </p>
        )}
      </form>

      {/* Parsed-filter chips */}
      {hasFilters && parsed && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-fg-subtle font-medium">Filters:</span>
          {parsed.category && (
            <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-800 font-medium">
              📦 {parsed.category}
            </span>
          )}
          {parsed.supplier_brand && (
            <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white font-medium">
              {parsed.supplier_brand}
            </span>
          )}
          {parsed.price_min_bdt != null && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium">
              ৳{parsed.price_min_bdt.toLocaleString()}+
            </span>
          )}
          {parsed.price_max_bdt != null && (
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium">
              under ৳{parsed.price_max_bdt.toLocaleString()}
            </span>
          )}
          {parsed.keywords.slice(0, 3).map((kw, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded-full border border-border text-fg-muted"
            >
              {kw}
            </span>
          ))}
          {parsed.sort && (
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-medium">
              ⇅ {SORT_LABEL[parsed.sort]}
            </span>
          )}
          {parsed.in_stock_only && (
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-medium">
              In stock
            </span>
          )}
          {parsed.low_moq && (
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-medium">
              Low MOQ
            </span>
          )}
        </div>
      )}

      {loading && <p className="text-[13px] text-fg-muted">Searching…</p>}

      {err && (
        <p className="text-[12px] text-rose-600 font-mono">error: {err}</p>
      )}

      {!loading && q.length >= 2 && results.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-[15px] font-medium">{t("search.empty")}</p>
          <p className="mt-2 text-[12px] text-fg-muted">
            Try a different category or remove some filters.
          </p>
          <Link
            href="/categories"
            className="mt-4 inline-flex h-10 items-center px-4 text-[13px] font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {t("cart.empty.cta")}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {results.map((h) => (
          <Link
            key={h.id}
            href={`/products/${h.id}`}
            className="group block rounded-lg border border-border bg-bg overflow-hidden hover:border-emerald-600/40 hover:shadow-[0_2px_4px_rgba(15,23,42,0.04),0_12px_28px_-12px_rgba(15,23,42,0.12)] transition-all"
          >
            <div className="relative aspect-square bg-slate-50">
              {h.image && (
                <Image
                  src={h.image}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                />
              )}
            </div>
            <div className="p-3">
              <p className="text-[13px] font-medium line-clamp-2 min-h-[2.6em]">
                {lang === "bn" ? h.title_bn : h.title_en}
              </p>
              <p className="mt-2 price-tag text-[15px] font-semibold">
                {fmtBdt(Math.ceil((h.price_cny_fen / 100) * FX_CNY_BDT))}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </Container>
  );
}

export function SearchClient() {
  return (
    <Suspense fallback={<Container className="py-10">Loading…</Container>}>
      <SearchPageInner />
    </Suspense>
  );
}
