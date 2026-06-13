"use client";
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
};

function SearchPageInner() {
  const { t, lang } = useLang();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}&limit=20`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setResults(j.results);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [q]);

  return (
    <Container className="py-10">
      <div className="mb-6">
        <p className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
          {lang === "bn" ? "অনুসন্ধান" : "Search"}
        </p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.01em]">
          {q ? (
            <>
              {results.length} {results.length === 1 ? "result" : "results"}
              <span className="text-fg-muted ml-2 font-normal">
                for "{q}"
              </span>
            </>
          ) : (
            t("search.placeholder")
          )}
        </h1>
      </div>

      {loading && (
        <p className="text-[13px] text-fg-muted">Searching…</p>
      )}

      {!loading && q.length >= 2 && results.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-[15px] font-medium">
            {t("search.empty")}
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
              <Image
                src={h.image}
                alt=""
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
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
