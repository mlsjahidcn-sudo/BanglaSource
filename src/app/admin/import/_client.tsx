"use client";
// /admin/import — Phase 15a
//
// Three-step flow:
//   1. URL input + "Scrape" button → calls /api/admin/import/scrape
//   2. Preview form: admin reviews/edits the scraped data
//      (title, factory FOB, weight, category, customs duty,
//      which images to keep). Auto-translate is on by default.
//   3. "Save product" → calls /api/admin/import/save, which
//      downloads each image to the Supabase product-images
//      bucket and creates the product + price_tiers rows.

import { useState } from "react";

type Source = "pinduoduo" | "taobao";

type ScrapedProduct = {
  source: Source;
  sourceUrl: string;
  sourceId: string;
  titleZh: string;
  descriptionZh: string;
  priceCny: number;
  originalPriceCny: number | null;
  images: string[];
  weightKg: number;
  supplierName: string;
  supplierCity: string;
  supplierProvince: string;
  sales: number;
};

const CATEGORIES = [
  { value: "gadgets", label: "Gadgets" },
  { value: "eyewear", label: "Eyewear" },
  { value: "shoes", label: "Shoes" },
  { value: "bags", label: "Bags" },
  { value: "watches", label: "Watches" },
  { value: "beauty", label: "Beauty" },
  { value: "jewelry", label: "Jewelry" },
] as const;

export function ImportClient() {
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scraped, setScraped] = useState<ScrapedProduct | null>(null);
  const [detectedSource, setDetectedSource] = useState<Source | null>(null);

  // Form state — pre-filled from scrape, admin can edit
  const [titleEn, setTitleEn] = useState("");
  const [titleBn, setTitleBn] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionBn, setDescriptionBn] = useState("");
  const [descriptionZh, setDescriptionZh] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]["value"]>("gadgets");
  const [weightKg, setWeightKg] = useState(0.5);
  const [volumeCbm, setVolumeCbm] = useState(0.0001);
  const [factoryCnyPerPc, setFactoryCnyPerPc] = useState(0);
  const [factoryMoq, setFactoryMoq] = useState(1);
  const [markupPct, setMarkupPct] = useState(10);
  const [customsDutyPerKg, setCustomsDutyPerKg] = useState(750);
  const [supplierName, setSupplierName] = useState("");
  const [supplierCity, setSupplierCity] = useState("Guangzhou");
  const [supplierProvince, setSupplierProvince] = useState("Guangdong");
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [autoTranslate, setAutoTranslate] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedProduct, setSavedProduct] = useState<{
    id: number;
    source_id: string;
    imageCount: number;
  } | null>(null);

  // ── Phase 15b: image-generation agent state ──
  const [genPrompt, setGenPrompt] = useState(
    "A clean studio product shot on a pure white background, soft natural lighting, no watermarks, professional ecommerce photography, 4K, sharp focus",
  );
  const [genN, setGenN] = useState(1);
  const [genRefUrl, setGenRefUrl] = useState("");
  const [genRunning, setGenRunning] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<
    { url: string; slug: string; sizeBytes: number; prompt?: string | null }[]
  >([]);

  // Phase 15d: 6-prompt auto-gen from title
  const [genPrompts, setGenPrompts] = useState<
    { index: number; intent: string; prompt: string }[]
  >([]);
  const [genPromptsLoading, setGenPromptsLoading] = useState(false);
  const [genPromptsError, setGenPromptsError] = useState<string | null>(null);

  async function handleAutoPrompts(
    style: "auto" | "studio" | "lifestyle" | "infographic",
  ) {
    if (!savedProduct) return;
    setGenPromptsError(null);
    setGenPromptsLoading(true);
    try {
      const r = await fetch(
        `/api/admin/import/${savedProduct.id}/generate-prompts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ n: 6, style }),
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
        throw new Error(data.message || data.error || `HTTP ${r.status}`);
      }
      setGenPrompts(data.prompts ?? []);
      setGenResult([]);
    } catch (e) {
      setGenPromptsError(
        e instanceof Error ? e.message : "Network error",
      );
    } finally {
      setGenPromptsLoading(false);
    }
  }

  function updateGenPrompt(index: number, newPrompt: string) {
    setGenPrompts((prev) =>
      prev.map((p) => (p.index === index ? { ...p, prompt: newPrompt } : p)),
    );
  }
  function removeGenPrompt(index: number) {
    setGenPrompts((prev) => prev.filter((p) => p.index !== index));
  }

  async function handleScrape() {
    setScrapeError(null);
    setScraped(null);
    setSavedProduct(null);
    setDetectedSource(null);
    if (!url.trim()) {
      setScrapeError("Paste a Pinduoduo or Taobao product URL first.");
      return;
    }
    setScraping(true);
    try {
      const r = await fetch("/api/admin/import/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setScrapeError(j.message ?? j.error ?? `HTTP ${r.status}`);
        return;
      }
      const p: ScrapedProduct = j.product;
      setScraped(p);
      setDetectedSource(p.source);

      // Pre-fill the form
      setTitleZh(p.titleZh);
      setTitleEn(p.titleZh); // placeholder; auto-translate will overwrite
      setTitleBn(p.titleZh);
      setDescriptionZh(p.descriptionZh);
      setDescriptionEn(p.descriptionZh);
      setDescriptionBn(p.descriptionZh);
      setWeightKg(p.weightKg);
      setSupplierName(p.supplierName);
      setSupplierCity(p.supplierCity);
      setSupplierProvince(p.supplierProvince);
      // Pinduoduo / Taobao retail price is NOT factory FOB.
      // Start the FOB at ~40% of the retail price as a rough
      // placeholder — admin MUST set the real FOB.
      setFactoryCnyPerPc(p.priceCny > 0 ? Math.round(p.priceCny * 0.4 * 100) / 100 : 0);
      setSelectedImages(new Set(p.images.map((_, i) => i)));
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : "Network error");
    } finally {
      setScraping(false);
    }
  }

  async function handleSave() {
    if (!scraped) return;
    setSaveError(null);
    setSaving(true);
    try {
      const keptImages = scraped.images.filter((_, i) =>
        selectedImages.has(i),
      );
      if (keptImages.length === 0) {
        setSaveError("Select at least one image to keep.");
        setSaving(false);
        return;
      }
      const r = await fetch("/api/admin/import/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: scraped.source,
          sourceUrl: scraped.sourceUrl,
          sourceId: scraped.sourceId,
          titleZh: titleZh,
          titleEn: titleEn,
          titleBn: titleBn,
          descriptionZh: descriptionZh,
          descriptionEn: descriptionEn,
          descriptionBn: descriptionBn,
          category,
          weightKg,
          volumeCbm,
          factoryCnyPerPc,
          factoryMoq,
          markupPct,
          customsDutyPerKg,
          supplierName,
          supplierCity,
          supplierProvince,
          images: keptImages,
          autoTranslate,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setSaveError(j.message ?? j.error ?? `HTTP ${r.status}`);
        return;
      }
      setSavedProduct(j.product);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-[12px] font-medium tracking-wider uppercase text-fg-subtle">
          Catalog
        </p>
        <h1 className="mt-2 text-[32px] md:text-[40px] leading-[1.05] font-semibold tracking-[-0.02em]">
          Import from Pinduoduo / Taobao
        </h1>
        <p className="mt-3 text-[14px] text-fg-muted max-w-2xl">
          Paste a product URL from pinduoduo.com, yangkeduo.com,
          temu.com, taobao.com, or tmall.com. We&apos;ll scrape the
          title, description, and images, you fill in the factory FOB
          and category, and we create the product row + upload the
          images to your storage bucket.
        </p>
      </div>

      {/* ── Step 1: URL input ── */}
      <section className="card p-6">
        <h2 className="text-[15px] font-semibold flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-[12px] font-semibold flex items-center justify-center">
            1
          </span>
          Paste product URL
        </h2>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://mobile.yangkeduo.com/goods.html?goods_id=123456789"
            className="flex-1 h-10 px-3 rounded-md border border-border bg-bg text-[13px] font-mono focus:outline-none focus:border-cyan-600"
          />
          <button
            onClick={handleScrape}
            disabled={scraping || !url.trim()}
            className="h-10 px-5 rounded-md bg-cyan-600 text-white text-[13px] font-medium hover:bg-cyan-700 disabled:opacity-60"
          >
            {scraping ? "Scraping…" : "Scrape"}
          </button>
        </div>
        {scrapeError && (
          <div className="mt-3 text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-md p-3 space-y-2">
            <p>{scrapeError}</p>
            <p className="text-[11.5px] text-red-700/80">
              <strong>Tip:</strong> Pinduoduo&apos;s mobile page is
              JS-rendered and often blocks automated scrapers. You
              can still create the product by clicking{" "}
              <em>Fill manually</em> below — the URL + extracted
              goods_id will be saved, and you paste the title,
              description, and image URLs by hand.
            </p>
            <button
              type="button"
              onClick={() => {
                // Manually populate from the URL alone
                const idMatch = url.match(/(?:id|goods_id|item_id|sku_id)[=/]([0-9]{6,})/);
                const source = url.toLowerCase().includes("taobao") || url.toLowerCase().includes("tmall")
                  ? "taobao"
                  : "pinduoduo";
                const manual: ScrapedProduct = {
                  source: source as Source,
                  sourceUrl: url,
                  sourceId: idMatch?.[1] ?? `manual-${Date.now()}`,
                  titleZh: "",
                  descriptionZh: "",
                  priceCny: 0,
                  originalPriceCny: null,
                  images: [],
                  weightKg: 0.5,
                  supplierName: source === "pinduoduo" ? "Pinduoduo supplier" : "Taobao supplier",
                  supplierCity: "Guangzhou",
                  supplierProvince: "Guangdong",
                  sales: 0,
                };
                setScraped(manual);
                setTitleZh("");
                setTitleEn("");
                setTitleBn("");
                setDescriptionZh("");
                setDescriptionEn("");
                setDescriptionBn("");
                setWeightKg(0.5);
                setSupplierName(manual.supplierName);
                setFactoryCnyPerPc(0);
                setSelectedImages(new Set());
                setDetectedSource(manual.source);
                setScrapeError(null);
              }}
              className="h-8 px-3 rounded-md bg-bg border border-border text-[12px] font-medium hover:bg-bg-soft"
            >
              Fill manually →
            </button>
          </div>
        )}
        {detectedSource && !scraped && (
          <p className="mt-3 text-[12px] text-fg-muted">
            Detected: <span className="font-medium">{detectedSource}</span>
          </p>
        )}
      </section>

      {/* ── Step 2: Preview form ── */}
      {scraped && (
        <section className="card p-6 space-y-5">
          <h2 className="text-[15px] font-semibold flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-[12px] font-semibold flex items-center justify-center">
              2
            </span>
            Review &amp; edit
          </h2>

          {/* Source banner */}
          <div className="p-3 rounded-md bg-bg-soft border border-border text-[12px]">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono tnum text-fg-muted">source_id:</span>
              <span className="font-mono">{scraped.sourceId}</span>
              <span className="text-fg-subtle">·</span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10.5px] font-medium uppercase tracking-wider">
                {scraped.source}
              </span>
              <span className="text-fg-subtle">·</span>
              <span className="text-fg-muted">retail price:</span>
              <span className="font-mono tnum">¥{scraped.priceCny.toFixed(2)}</span>
              {scraped.originalPriceCny && (
                <>
                  <span className="text-fg-subtle line-through">¥{scraped.originalPriceCny.toFixed(2)}</span>
                </>
              )}
              {scraped.sales > 0 && (
                <>
                  <span className="text-fg-subtle">·</span>
                  <span className="text-fg-muted">sold:</span>
                  <span className="font-mono tnum">{scraped.sales.toLocaleString()}</span>
                </>
              )}
            </div>
          </div>

          {/* Titles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Title (zh) — source" full>
              <textarea
                value={titleZh}
                onChange={(e) => setTitleZh(e.target.value)}
                rows={2}
                className="input"
              />
            </Field>
            <Field label="Title (en)" full>
              <input
                type="text"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="input"
                placeholder="English title (auto-translated if enabled)"
              />
            </Field>
            <Field label="Title (bn)" full>
              <input
                type="text"
                value={titleBn}
                onChange={(e) => setTitleBn(e.target.value)}
                className="input"
                placeholder="বাংলা শিরোনাম"
              />
            </Field>
          </div>

          {/* Descriptions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Description (zh)" full>
              <textarea
                value={descriptionZh}
                onChange={(e) => setDescriptionZh(e.target.value)}
                rows={3}
                className="input"
              />
            </Field>
            <Field label="Description (en)" full>
              <textarea
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                rows={3}
                className="input"
              />
            </Field>
            <Field label="Description (bn)" full>
              <textarea
                value={descriptionBn}
                onChange={(e) => setDescriptionBn(e.target.value)}
                rows={3}
                className="input"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-[12.5px] text-fg-muted">
            <input
              type="checkbox"
              checked={autoTranslate}
              onChange={(e) => setAutoTranslate(e.target.checked)}
            />
            <span>
              Auto-translate to English &amp; Bangla via DeepSeek on save
              (when title_en / title_bn are empty)
            </span>
          </label>

          {/* Category + factory FOB + weight + MOQ + markup + customs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="input"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Factory FOB (¥/pc)">
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={factoryCnyPerPc || ""}
                onChange={(e) =>
                  setFactoryCnyPerPc(parseFloat(e.target.value) || 0)
                }
                className="input"
                placeholder="0.00"
              />
            </Field>
            <Field label="Factory MOQ">
              <input
                type="number"
                min={1}
                value={factoryMoq}
                onChange={(e) =>
                  setFactoryMoq(parseInt(e.target.value) || 1)
                }
                className="input"
              />
            </Field>
            <Field label="Markup % (default 10)">
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={markupPct}
                onChange={(e) =>
                  setMarkupPct(parseFloat(e.target.value) || 0)
                }
                className="input"
              />
            </Field>
            <Field label="Weight (kg/pc)">
              <input
                type="number"
                min={0.001}
                step={0.01}
                value={weightKg}
                onChange={(e) =>
                  setWeightKg(parseFloat(e.target.value) || 0)
                }
                className="input"
              />
            </Field>
            <Field label="Volume (m³/pc)">
              <input
                type="number"
                min={0.0001}
                step={0.0001}
                value={volumeCbm}
                onChange={(e) =>
                  setVolumeCbm(parseFloat(e.target.value) || 0)
                }
                className="input"
              />
            </Field>
            <Field label="Customs duty (৳/kg)">
              <input
                type="number"
                min={0}
                step={50}
                value={customsDutyPerKg}
                onChange={(e) =>
                  setCustomsDutyPerKg(parseInt(e.target.value) || 0)
                }
                className="input"
              />
            </Field>
          </div>

          {/* Supplier */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Supplier name">
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="City">
              <input
                type="text"
                value={supplierCity}
                onChange={(e) => setSupplierCity(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Province">
              <input
                type="text"
                value={supplierProvince}
                onChange={(e) => setSupplierProvince(e.target.value)}
                className="input"
              />
            </Field>
          </div>

          {/* Image picker */}
          <Field label={`Images (${scraped.images.length} scraped — pick the ones to keep)`}>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {scraped.images.map((url, i) => {
                const selected = selectedImages.has(i);
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => {
                      setSelectedImages((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      });
                    }}
                    className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${
                      selected
                        ? "border-cyan-600 ring-2 ring-cyan-200"
                        : "border-border opacity-40 hover:opacity-70"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`image ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-bg/90 border border-border text-[10px] flex items-center justify-center font-mono tnum">
                      {i + 1}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11.5px] text-fg-subtle">
              Click to toggle. The picked images will be downloaded and
              uploaded to the <code className="font-mono">product-images</code>{" "}
              bucket (max 8MB each). Phase 15b (image agent) will use these
              as reference to generate cleaned, watermark-free product shots.
            </p>
          </Field>
        </section>
      )}

      {/* ── Step 3: Save ── */}
      {scraped && (
        <section className="card p-6">
          <h2 className="text-[15px] font-semibold flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-[12px] font-semibold flex items-center justify-center">
              3
            </span>
            Save product
          </h2>
          <p className="mt-2 text-[12px] text-fg-muted">
            We&apos;ll create the product row, download the selected
            images, upload them to storage, and insert the price tiers.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={
                saving || !titleEn.trim() || !factoryCnyPerPc || selectedImages.size === 0
              }
              className="h-10 px-5 rounded-md bg-emerald-600 text-white text-[13px] font-medium hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save product"}
            </button>
            {saveError && (
              <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {saveError}
              </p>
            )}
            {savedProduct && (
              <p className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                ✓ Created product #{savedProduct.id} (source_id={savedProduct.source_id}) with {savedProduct.imageCount} image(s).{" "}
                <a
                  href={`/admin/products/${savedProduct.id}`}
                  className="underline"
                >
                  Edit listing →
                </a>{" "}
                <a
                  href={`/products/${savedProduct.source_id}`}
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on site →
                </a>
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── Step 4 (Phase 15b): Generate website images ── */}
      {savedProduct && (
        <section className="card p-6">
          <h2 className="text-[15px] font-semibold flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-cyan-600 text-white text-[12px] font-semibold flex items-center justify-center">
              4
            </span>
            Generate website images
            <span className="ml-2 text-[10.5px] uppercase tracking-wider font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded">
              GPT Image 2
            </span>
          </h2>
          <p className="mt-2 text-[12px] text-fg-muted">
            Run the product through the AI image agent to get clean,
            watermark-free shots you can add to the listing. Reference images
            anchor the style; leave blank for text-only generation.
          </p>

          {/* Phase 15d: 6-prompt auto-gen banner */}
          <div className="mt-4 p-3 border border-cyan-200 bg-cyan-50/40 rounded-md">
            <p className="text-[12px] text-fg">
              <strong className="text-cyan-800">Quick: 6-prompt carousel.</strong>{" "}
              Have DeepSeek draft 6 distinct shots from the product title
              (front hero, detail close-up, lifestyle, spec card, scale
              comparison, alternate angle). Edit any prompt before generating.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleAutoPrompts("auto")}
                disabled={genPromptsLoading}
                className="h-8 px-3 rounded-md bg-cyan-600 text-white text-[12px] font-medium hover:bg-cyan-700 disabled:opacity-60"
              >
                {genPromptsLoading ? "Drafting…" : "Auto-generate 6 prompts"}
              </button>
              <button
                type="button"
                onClick={() => handleAutoPrompts("studio")}
                disabled={genPromptsLoading}
                className="h-8 px-2.5 rounded-md border border-cyan-300 text-cyan-800 text-[11.5px] hover:bg-cyan-50 disabled:opacity-60"
              >
                All studio
              </button>
              <button
                type="button"
                onClick={() => handleAutoPrompts("lifestyle")}
                disabled={genPromptsLoading}
                className="h-8 px-2.5 rounded-md border border-cyan-300 text-cyan-800 text-[11.5px] hover:bg-cyan-50 disabled:opacity-60"
              >
                All lifestyle
              </button>
              <button
                type="button"
                onClick={() => handleAutoPrompts("infographic")}
                disabled={genPromptsLoading}
                className="h-8 px-2.5 rounded-md border border-cyan-300 text-cyan-800 text-[11.5px] hover:bg-cyan-50 disabled:opacity-60"
              >
                All spec cards
              </button>
              {genPrompts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setGenPrompts([]);
                    setGenResult([]);
                  }}
                  disabled={genPromptsLoading}
                  className="h-8 px-2.5 rounded-md border border-fg/20 text-[11.5px] hover:bg-fg/5 disabled:opacity-40 ml-auto"
                >
                  Clear prompts
                </button>
              )}
            </div>
            {genPromptsError && (
              <p className="mt-2 text-[11.5px] text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                {genPromptsError}
              </p>
            )}
          </div>

          {/* Phase 15d: editable prompt cards */}
          {genPrompts.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-[12px] text-fg-muted font-medium">
                {genPrompts.length} prompt
                {genPrompts.length === 1 ? "" : "s"} ready — edit inline, then
                click &quot;Generate {genPrompts.length} image
                {genPrompts.length === 1 ? "" : "s"}&quot; below.
              </p>
              {genPrompts.map((p) => (
                <div
                  key={p.index}
                  className="border border-fg/15 rounded-md p-3 bg-white"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider font-medium text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded">
                      {p.index + 1}. {p.intent}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeGenPrompt(p.index)}
                      className="text-[11px] text-fg-subtle hover:text-red-600"
                      title="Remove this prompt"
                    >
                      remove
                    </button>
                  </div>
                  <textarea
                    className="input"
                    value={p.prompt}
                    onChange={(e) => updateGenPrompt(p.index, e.target.value)}
                    rows={2}
                  />
                  <p className="mt-1 text-[10.5px] text-fg-subtle font-mono tnum text-right">
                    {p.prompt.length} chars
                  </p>
                </div>
              ))}
            </div>
          )}

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

            <div className="grid grid-cols-2 gap-4">
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
                        Math.min(4, Math.max(1, parseInt(e.target.value) || 1)),
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
                    1–4 (each call billed separately; parallelized server-side)
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

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={async () => {
                  if (!savedProduct) return;
                  setGenError(null);
                  setGenResult([]);
                  setGenRunning(true);
                  try {
                    const refs: string[] = genRefUrl.trim()
                      ? [genRefUrl.trim()]
                      : (scraped?.images ?? []).slice(0, 1);
                    // Phase 15d: prefer the 6-prompt list if present
                    const body: Record<string, unknown> = {
                      referenceImageUrls: refs,
                      appendToProduct: false, // preview first; admin clicks "Add to product"
                    };
                    if (genPrompts.length > 0) {
                      body.prompts = genPrompts.map((p) => p.prompt);
                    } else {
                      body.prompt = genPrompt;
                      body.n = genN;
                    }
                    const r = await fetch(
                      `/api/admin/import/${savedProduct.id}/generate-images`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
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
                    setGenResult(data.images ?? []);
                  } catch (e) {
                    setGenError(e instanceof Error ? e.message : "Network error");
                  } finally {
                    setGenRunning(false);
                  }
                }}
                disabled={
                  genRunning ||
                  (genPrompts.length === 0 && !genPrompt.trim())
                }
                className="h-10 px-5 rounded-md bg-cyan-600 text-white text-[13px] font-medium hover:bg-cyan-700 disabled:opacity-60"
              >
                {genRunning
                  ? "Generating…"
                  : genPrompts.length > 0
                    ? `Generate ${genPrompts.length} image${genPrompts.length === 1 ? "" : "s"} from prompts`
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
                  ✓ Generated {genResult.length} image{genResult.length > 1 ? "s" : ""}.
                  Preview below — click &quot;Add to product&quot; to push them to
                  the listing&apos;s <code className="font-mono">images[]</code>{" "}
                  and bust the catalog cache.
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
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!savedProduct) return;
                      setGenRunning(true);
                      setGenError(null);
                      try {
                        const refs: string[] = genRefUrl.trim()
                          ? [genRefUrl.trim()]
                          : (scraped?.images ?? []).slice(0, 1);
                        const r = await fetch(
                          `/api/admin/import/${savedProduct.id}/generate-images`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              prompt: genPrompt,
                              n: genN,
                              referenceImageUrls: refs,
                              appendToProduct: true,
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
                        setSavedProduct((prev) =>
                          prev && data.product
                            ? { ...prev, imageCount: data.product.totalImages ?? prev.imageCount + (data.imagesAdded ?? 1) }
                            : prev,
                        );
                        // Clear preview after successful add
                        setGenResult([]);
                      } catch (e) {
                        setGenError(e instanceof Error ? e.message : "Network error");
                      } finally {
                        setGenRunning(false);
                      }
                    }}
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
                  <a
                    href={`/admin/products/${savedProduct.id}`}
                    className="text-[12.5px] text-cyan-700 underline ml-auto"
                  >
                    Open admin editor →
                  </a>
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
          font-family: var(--font-sans);
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
    <label className={full ? "block" : "block"}>
      <span className="text-[11px] text-fg-subtle uppercase tracking-wider font-medium">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
