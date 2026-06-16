"use client";
//
// /components/topbar-search.tsx
//
// Phase 33 admin topbar search. Replaces the decorative input in
// /admin/layout.tsx with a working one. Real ⌘K shortcut, real
// debounced fetch, real results dropdown across products/users/orders.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconSearch } from "./portal-icons";

type ProductHit = {
  kind: "product";
  id: number;
  source_id: string;
  title: string;
  category: string;
  href: string;
};
type UserHit = {
  kind: "user";
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  href: string;
};
type OrderHit = {
  kind: "order";
  id: number;
  num: string;
  total_bdt: number;
  status: string;
  href: string;
};
type Hit = ProductHit | UserHit | OrderHit;

const KIND_TONE: Record<Hit["kind"], string> = {
  product: "text-cyan-700 bg-cyan-50 border-cyan-200",
  user: "text-cyan-700 bg-cyan-50 border-cyan-200",
  order: "text-violet-700 bg-violet-50 border-violet-200",
};

export function TopbarSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ⌘K / Ctrl+K to focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Debounced fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/admin/search?q=${encodeURIComponent(q.trim())}&limit=5`,
        );
        const j = await r.json();
        if (j.ok) {
          setResults(j.results ?? []);
          setOpen(true);
          setHighlight(0);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      const target = results[highlight];
      if (target) {
        e.preventDefault();
        window.location.href = target.href;
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function onBlur() {
    // Delay close so a click on a result still navigates
    blurRef.current = setTimeout(() => setOpen(false), 150);
  }

  return (
    <div className="relative flex-1 max-w-md">
      <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-bg-soft border border-border focus-within:border-border-strong transition-colors">
        <span className="text-fg-subtle">
          <IconSearch size={14} />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          placeholder="Search products, users, orders…"
          aria-label="Admin search"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="admin-search-results"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-subtle"
        />
        <kbd className="text-[10px] text-fg-subtle font-mono px-1.5 py-0.5 rounded border border-border">
          ⌘K
        </kbd>
      </div>
      {open && (results.length > 0 || loading) && (
        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 card p-1 shadow-lg max-h-[480px] overflow-y-auto">
          {loading && results.length === 0 ? (
            <p className="text-[12px] text-fg-muted px-3 py-2">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-[12px] text-fg-muted px-3 py-2">
              No matches for &ldquo;{q}&rdquo;.
            </p>
          ) : (
            <ul ref={listRef} id="admin-search-results" role="listbox">
              {results.map((r, i) => (
                <li key={`${r.kind}-${r.id}`} role="option" aria-selected={i === highlight}>
                  <Link
                    href={r.href}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-md ${
                      i === highlight ? "bg-bg-soft" : ""
                    }`}
                  >
                    <span
                      className={`text-[9.5px] font-medium tracking-wider uppercase px-1.5 py-0.5 border rounded ${KIND_TONE[r.kind]}`}
                    >
                      {r.kind}
                    </span>
                    <ResultBody hit={r} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border mt-1 pt-1.5 px-2.5 pb-1 text-[10.5px] text-fg-subtle flex items-center justify-between">
            <span>
              <kbd className="font-mono">↑↓</kbd> navigate · <kbd className="font-mono">↵</kbd> open
            </span>
            <Link
              href={`/admin/products?q=${encodeURIComponent(q)}`}
              onClick={() => setOpen(false)}
              className="text-cyan-700 hover:underline"
            >
              See all in catalog →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultBody({ hit }: { hit: Hit }) {
  if (hit.kind === "product") {
    return (
      <>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] truncate">{hit.title}</p>
          <p className="text-[10.5px] text-fg-subtle font-mono truncate">
            {hit.source_id} · {hit.category}
          </p>
        </div>
      </>
    );
  }
  if (hit.kind === "user") {
    return (
      <>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] truncate">
            {hit.full_name || hit.email}
          </p>
          <p className="text-[10.5px] text-fg-subtle font-mono truncate">
            {hit.email}
            {hit.company ? ` · ${hit.company}` : ""}
          </p>
        </div>
      </>
    );
  }
  // order
  return (
    <>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-mono">{hit.num}</p>
        <p className="text-[10.5px] text-fg-subtle truncate">
          ৳{hit.total_bdt.toLocaleString("en-IN")} · {hit.status}
        </p>
      </div>
    </>
  );
}
