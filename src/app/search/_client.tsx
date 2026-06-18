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
              <span className="ml-2 text-cyan-700">
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
          {/*
            Phase 56: removed the supplier_brand chip. The brand
            was the factory name — surfacing it on the public site
            would let any visitor bypass us to order direct.
          */}
          {parsed.price_min_bdt != null && (
            <span className="px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-800 font-medium">
              ৳{parsed.price_min_bdt.toLocaleString()}+
            </span>
          )}
          {parsed.price_max_bdt != null && (
            <span className="px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-800 font-medium">
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

      {/* Phase 23: when there's no query, show a helper
          with category quick-picks instead of an empty box.
          When the query has no matches, show "did you mean"
          suggestions + browse-all fallback. */}
      {!loading && q.length < 2 && (
        <NoQueryHelper />
      )}

      {!loading && q.length >= 2 && results.length === 0 && (
        <NoResultsHelper query={q} parsed={parsed} />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {results.map((h) => (
          <Link
            key={h.id}
            href={`/products/${h.id}`}
            className="group block rounded-lg border border-border bg-bg overflow-hidden hover:border-cyan-600/40 hover:shadow-[0_2px_4px_rgba(15,23,42,0.04),0_12px_28px_-12px_rgba(15,23,42,0.12)] transition-all"
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

// ── Phase 23 helpers ──────────────────────────────────────

const SUGGESTED_QUERIES = [
  "wireless earphones",
  "phone case",
  "sunglasses",
  "leather bag",
  "smart watch",
  "cotton t-shirt",
];

/**
 * Shown when the user opens /search without a query
 * (or types <2 chars). Goal: give them a way to start
 * searching without first having to know the right
 * keyword. We surface:
 *   - The 7 categories as one-click "browse X" chips
 *   - 6 suggested queries (the most popular search
 *     intents per the home's product mix)
 */
function NoQueryHelper() {
  const { t, lang } = useLang();
  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">
          {lang === "bn" ? "ক্যাটাগরি" : "Browse by category"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              { slug: "gadgets", label: lang === "bn" ? "গ্যাজেট" : "Gadgets" },
              { slug: "eyewear", label: lang === "bn" ? "চশমা" : "Eyewear" },
              { slug: "shoes", label: lang === "bn" ? "জুতা" : "Shoes" },
              { slug: "bags", label: lang === "bn" ? "ব্যাগ" : "Bags" },
              { slug: "watches", label: lang === "bn" ? "ঘড়ি" : "Watches" },
              { slug: "beauty", label: lang === "bn" ? "বিউটি" : "Beauty" },
            ] as const
          ).map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="h-9 px-4 inline-flex items-center text-[13px] rounded-md border border-border bg-bg hover:border-cyan-300 hover:text-cyan-700"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">
          {lang === "bn" ? "চেষ্টা করুন" : "Or try searching for"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_QUERIES.map((s) => (
            <Link
              key={s}
              href={`/search?q=${encodeURIComponent(s)}`}
              className="h-8 px-3 inline-flex items-center text-[12px] rounded-full bg-bg-soft text-fg-muted hover:text-fg hover:bg-cyan-50"
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      <p className="text-[12.5px] text-fg-muted">
        Or paste a natural-language query like{" "}
        <Link
          href="/search?q=cheap+wireless+earphones+for+running+under+%E0%A7%B3+500"
          className="text-cyan-700 hover:underline"
        >
          cheap wireless earphones under ৳500
        </Link>
        {" "}— we use smart search to find what fits.
      </p>
    </div>
  );
}

/**
 * Shown when the user has typed a query that returned
 * zero results. Goal: don't leave them at a dead end.
 * We surface:
 *   - The AI-parsed filters (if any) so the user can
 *     see what we heard and adjust
 *   - "Did you mean" — a few of the catalog's most-
 *     common keywords, so the user can pick something
 *     to start with
 *   - Browse-all fallback as the always-there
 *     exit ramp
 */
function NoResultsHelper({
  query,
  parsed,
}: {
  query: string;
  parsed: Parsed | null;
}) {
  const { t, lang } = useLang();
  return (
    <div className="card p-8">
      <p className="text-[15px] font-medium text-fg">
        {lang === "bn"
          ? `"${query}" এর জন্য কোনো ফলাফল নেই`
          : `No results for "${query}"`}
      </p>
      <p className="mt-1.5 text-[12.5px] text-fg-muted">
        {lang === "bn"
          ? "আলাদা কীওয়ার্ড চেষ্টা করুন অথবা নিচের পরামর্শ থেকে বেছে নিন।"
          : "Try a different keyword, or pick one of these common searches."}
      </p>

      {parsed && parsed.keywords.length > 0 && (
        <p className="mt-4 text-[12px] text-fg-subtle">
          {lang === "bn" ? "আমরা যা শুনেছি" : "We heard"}:{" "}
          <span className="font-mono">
            {parsed.keywords.slice(0, 4).join(", ")}
          </span>
        </p>
      )}

      <div className="mt-5">
        <p className="text-[10.5px] uppercase tracking-wider text-fg-subtle font-medium">
          {lang === "bn" ? "চেষ্টা করুন" : "Did you mean"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTED_QUERIES.slice(0, 4).map((s) => (
            <Link
              key={s}
              href={`/search?q=${encodeURIComponent(s)}`}
              className="h-8 px-3 inline-flex items-center text-[12px] rounded-full bg-bg-soft text-fg-muted hover:text-fg hover:bg-cyan-50"
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          href="/categories"
          className="h-10 px-4 inline-flex items-center text-[13px] font-medium rounded-md bg-cyan-600 text-white hover:bg-cyan-700"
        >
          {lang === "bn" ? "ক্যাটাগরি ব্রাউজ করুন" : "Browse all categories"}
        </Link>
        <Link
          href="/"
          className="h-10 px-4 inline-flex items-center text-[13px] font-medium rounded-md border border-border text-fg hover:bg-bg-soft"
        >
          {lang === "bn" ? "হোমে ফিরুন" : "Back to home"}
        </Link>
      </div>
    </div>
  );
}
