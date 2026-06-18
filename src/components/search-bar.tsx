"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { fmtBdt, FX_CNY_BDT } from "@/lib/pricing";

type Hit = {
  id: string;
  title_en: string;
  title_bn: string;
  image: string;
  price_cny_fen: number;
  category: string;
  score: number;
};

type Props = {
  variant?: "header" | "hero";
  className?: string;
  /**
   * Called when the user picks a result OR submits the form. Useful
   * for closing a mobile search sheet after the user navigates
   * (without this, the sheet stays open until the new page mounts).
   */
  onResultClick?: () => void;
};

export function SearchBar({ variant = "header", className = "", onResultClick }: Props) {
  const { t, lang } = useLang();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  // Debounced fetch
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&limit=6`,
          { signal: ctrl.signal },
        );
        const j = await r.json();
        if (j.ok) setHits(j.results);
      } catch {
        // aborted — fine
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Click-outside close
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ⌘K to focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(hits.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && hits[activeIdx]) {
        router.push(`/products/${hits[activeIdx].id}`);
        setOpen(false);
        onResultClick?.();
      } else if (q.trim().length > 0) {
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        setOpen(false);
        onResultClick?.();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const hero = variant === "hero";
  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div
        className={`relative flex items-center ${
          hero
            ? "h-12 md:h-14 bg-white border border-slate-200 rounded-full shadow-sm"
            : "h-10 bg-slate-50 border border-border rounded-md focus-within:bg-bg focus-within:border-border-strong"
        } transition-colors`}
      >
        <span className="absolute left-4 text-fg-subtle">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle
              cx="9"
              cy="9"
              r="6"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="m13.5 13.5 3 3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActiveIdx(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={t("search.placeholder")}
          aria-label={t("search.aria")}
          className={`w-full ${
            hero
              ? "h-12 md:h-14 pl-12 pr-24 text-[15px] rounded-full"
              : "h-10 pl-10 pr-16 text-[13.5px] rounded-md"
          } bg-transparent outline-none placeholder:text-fg-subtle`}
        />
        <kbd
          className={`hidden md:flex items-center absolute right-3 ${
            hero ? "h-7" : "h-6"
          } px-1.5 text-[10px] font-mono text-fg-subtle border border-border rounded bg-bg-soft`}
        >
          ⌘K
        </kbd>
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-bg border border-border rounded-lg shadow-2xl z-50 overflow-hidden">
          {loading && hits.length === 0 && (
            <div className="p-4 text-[13px] text-fg-subtle">
              Searching…
            </div>
          )}
          {!loading && hits.length === 0 && (
            <div className="p-4 text-[13px] text-fg-subtle">
              {t("search.empty")}
            </div>
          )}
          {hits.length > 0 && (
            <ul>
              {hits.map((h, i) => (
                <li key={h.id}>
                  <Link
                    href={`/products/${h.id}`}
                    onClick={() => {
                      setOpen(false);
                      onResultClick?.();
                    }}
                    className={`flex items-center gap-3 p-3 transition-colors ${
                      i === activeIdx ? "bg-slate-50" : "hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="relative w-10 h-10 rounded overflow-hidden bg-slate-50 border border-border shrink-0">
                      <Image
                        src={h.image}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate">
                        {lang === "bn" ? h.title_bn : h.title_en}
                      </p>
                      <p className="text-[10.5px] text-fg-subtle uppercase tracking-wider mt-0.5">
                        {h.category}
                      </p>
                    </div>
                    <span className="text-[12px] price-tag font-medium">
                      {fmtBdt(Math.ceil((h.price_cny_fen / 100) * FX_CNY_BDT))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {q.trim().length > 0 && (
            <Link
              href={`/search?q=${encodeURIComponent(q.trim())}`}
              onClick={() => {
                setOpen(false);
                onResultClick?.();
              }}
              className="block p-3 text-center text-[12.5px] font-medium border-t border-border text-fg hover:bg-slate-50"
            >
              {t("search.view_all")} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
