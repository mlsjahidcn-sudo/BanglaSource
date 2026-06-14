"use client";

// /admin/images — image-generation agent for any active product.
//
// Phase 15c. Three sections:
//
//   1. Product picker — search-as-you-type dropdown over active
//      products. Shows id, source_id, title, first image.
//
//   2. Generate form — prompt textarea (default = "clean studio
//      product shot on white bg"), n stepper (1-4), reference
//      image URL (blank = first product image).
//
//   3. Preview gallery — shows generated PNGs in a 4-col grid with
//      size + open link. "Add to product" re-runs the API with
//      appendToProduct: true (pushes the URLs to products.images[]
//      and busts catalog cache). "Discard preview" clears state.

import { useState, useMemo } from "react";
import Link from "next/link";

type ProductSummary = {
  id: number;
  source_id: string;
  title_en: string | null;
  category: string;
  imageCount: number;
  firstImage: string | null;
};

type GeneratedImage = {
  url: string;
  slug: string;
  sizeBytes: number;
};

export function ImageAgentClient({
  products,
}: {
  products: ProductSummary[];
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [genPrompt, setGenPrompt] = useState(
    "A clean studio product shot on a pure white background, soft natural lighting, no watermarks, professional ecommerce photography, 4K, sharp focus",
  );
  const [genN, setGenN] = useState(1);
  const [genRefUrl, setGenRefUrl] = useState("");

  const [genRunning, setGenRunning] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<GeneratedImage[]>([]);
  const [productImageCount, setProductImageCount] = useState<number | null>(
    null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter(
        (p) =>
          p.title_en?.toLowerCase().includes(q) ||
          p.source_id.toLowerCase().includes(q) ||
          String(p.id) === q,
      )
      .slice(0, 30);
  }, [query, products]);

  const selected = products.find((p) => p.id === selectedId) ?? null;
  const currentImageCount =
    productImageCount ?? selected?.imageCount ?? 0;

  async function handleGenerate(appendToProduct: boolean) {
    if (!selected) return;
    setGenError(null);
    if (!appendToProduct) setGenResult([]);
    setGenRunning(true);
    try {
      const refs: string[] = genRefUrl.trim()
        ? [genRefUrl.trim()]
        : selected.firstImage
          ? [selected.firstImage]
          : [];
      const r = await fetch(
        `/api/admin/import/${selected.id}/generate-images`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: genPrompt,
            n: genN,
            referenceImageUrls: refs,
            appendToProduct,
          }),
        },
      );
      const t = await r.text();
      let data: any = {};
      try {
        data = JSON.parse(t);
      } catch {
        throw new Error(`Server returned non-JSON: ${t.slice(0, 200)}`);
      }
      if (!r.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${r.status}`);
      }
      if (appendToProduct) {
        setProductImageCount(data.product?.totalImages ?? null);
        setGenResult([]);
      } else {
        setGenResult(data.images ?? []);
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Network error");
    } finally {
      setGenRunning(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-[20px] font-semibold">Image agent</h1>
        <p className="mt-1 text-[12.5px] text-fg-muted">
          Generate clean, watermark-free, white-background product shots via
          GPT Image 2. Pick any active product, describe the shot you want,
          and add the result to the listing.
        </p>
      </header>

      {/* ── 1. Product picker ── */}
      <section className="card p-6">
        <h2 className="text-[13px] font-semibold flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-[12px] font-semibold flex items-center justify-center">
            1
          </span>
          Pick a product
        </h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={`Search (${products.length} active products)`} full>
            <input
              type="text"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter by id, source_id, or title…"
            />
          </Field>
        </div>
        {selected ? (
          <div className="mt-4 p-3 border border-cyan-300 bg-cyan-50 rounded-md flex items-center gap-3">
            <div className="w-14 h-14 rounded-md border border-fg/15 bg-white overflow-hidden relative flex-none">
              {selected.firstImage ? (
                <img
                  src={selected.firstImage}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-fg-subtle text-[10px]">
                  no image
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate">
                #{selected.id} · {selected.title_en || "(no title)"}
              </p>
              <p className="text-[11.5px] text-fg-muted font-mono">
                {selected.source_id} · {selected.category} · {currentImageCount} image{currentImageCount === 1 ? "" : "s"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setProductImageCount(null);
                setGenResult([]);
              }}
              className="h-8 px-3 rounded-md border border-fg/20 hover:bg-fg/5 text-[12px]"
            >
              Change
            </button>
          </div>
        ) : (
          <ul className="mt-4 max-h-72 overflow-auto border border-fg/15 rounded-md divide-y divide-fg/10">
            {filtered.length === 0 ? (
              <li className="p-3 text-[12.5px] text-fg-muted text-center">
                No products match.
              </li>
            ) : (
              filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(p.id);
                      setProductImageCount(null);
                      setGenResult([]);
                    }}
                    className="w-full text-left p-2.5 hover:bg-bg-soft flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-md border border-fg/15 bg-white overflow-hidden relative flex-none">
                      {p.firstImage ? (
                        <img
                          src={p.firstImage}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-fg-subtle text-[10px]">
                          —
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium truncate">
                        #{p.id} · {p.title_en || "(no title)"}
                      </p>
                      <p className="text-[11px] text-fg-muted font-mono">
                        {p.source_id} · {p.category} · {p.imageCount} img
                      </p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      {/* ── 2. Generate form ── */}
      {selected && (
        <section className="card p-6">
          <h2 className="text-[13px] font-semibold flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-[12px] font-semibold flex items-center justify-center">
              2
            </span>
            Generate
            <span className="ml-2 text-[10.5px] uppercase tracking-wider font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded">
              GPT Image 2
            </span>
          </h2>

          <div className="mt-4 grid gap-4">
            <Field label="Prompt" full>
              <textarea
                className="input"
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                maxLength={1500}
                rows={3}
                placeholder="Describe the shot you want…"
              />
              <p className="mt-1 text-[11px] text-fg-subtle font-mono tnum">
                {genPrompt.length} / 1500 chars
              </p>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Number of images (n)">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGenN(Math.max(1, genN - 1))}
                    disabled={genN <= 1}
                    className="h-9 w-9 rounded-md border border-fg/20 hover:bg-fg/5 disabled:opacity-40"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    className="input text-center"
                    value={genN}
                    min={1}
                    max={4}
                    onChange={(e) =>
                      setGenN(
                        Math.min(
                          4,
                          Math.max(1, parseInt(e.target.value) || 1),
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setGenN(Math.min(4, genN + 1))}
                    disabled={genN >= 4}
                    className="h-9 w-9 rounded-md border border-fg/20 hover:bg-fg/5 disabled:opacity-40"
                  >
                    +
                  </button>
                  <span className="text-[11px] text-fg-subtle">
                    1–4 (parallelized server-side)
                  </span>
                </div>
              </Field>
              <Field label="Reference image URL (optional)">
                <input
                  type="url"
                  className="input"
                  value={genRefUrl}
                  onChange={(e) => setGenRefUrl(e.target.value)}
                  placeholder="https://… (blank = first product image)"
                />
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleGenerate(false)}
                disabled={genRunning || !genPrompt.trim()}
                className="h-10 px-5 rounded-md bg-cyan-600 text-white text-[13px] font-medium hover:bg-cyan-700 disabled:opacity-60"
              >
                {genRunning
                  ? "Generating…"
                  : `Generate ${genN} image${genN > 1 ? "s" : ""}`}
              </button>
              {genError && (
                <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {genError}
                </p>
              )}
            </div>

            {genResult.length > 0 && (
              <div className="mt-2">
                <p className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                  ✓ Generated {genResult.length} image
                  {genResult.length > 1 ? "s" : ""}. Preview below — click
                  &quot;Add to product&quot; to push them to the listing&apos;s{" "}
                  <code className="font-mono">images[]</code> and bust the
                  catalog cache.
                </p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {genResult.map((img, i) => (
                    <div
                      key={i}
                      className="border border-fg/15 rounded-md overflow-hidden bg-white"
                    >
                      <div className="aspect-square relative bg-fg/5">
                        <img
                          src={img.url}
                          alt={`generated-${i + 1}`}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2 flex items-center justify-between gap-1">
                        <span className="text-[10.5px] text-fg-subtle font-mono tnum truncate">
                          {(img.sizeBytes / 1024).toFixed(0)} KB
                        </span>
                        <a
                          href={img.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10.5px] text-cyan-700 underline"
                        >
                          open
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleGenerate(true)}
                    disabled={genRunning}
                    className="h-9 px-4 rounded-md bg-emerald-600 text-white text-[12.5px] font-medium hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {genRunning ? "Adding…" : "Add to product"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenResult([])}
                    disabled={genRunning}
                    className="h-9 px-3 rounded-md border border-fg/20 text-[12.5px] hover:bg-fg/5 disabled:opacity-40"
                  >
                    Discard preview
                  </button>
                  <Link
                    href={`/admin/products/${selected.id}`}
                    className="text-[12.5px] text-cyan-700 underline ml-auto"
                  >
                    Open admin editor →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <style>{`
        .input {
          width: 100%;
          height: 36px;
          padding: 0 10px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 13px;
          background: var(--bg);
          color: var(--fg);
          font-family: var(--font-mono);
        }
        .input:focus {
          outline: none;
          border-color: var(--emerald-600);
        }
        textarea.input {
          height: auto;
          padding: 8px 10px;
          font-family: -apple-system, system-ui;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
