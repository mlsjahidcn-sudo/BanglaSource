"use client";

// /admin/products/new — manual product-create form.
//
// Phase 15c. Admin fills:
//   - sourceId (free-text slug, must be unique)
//   - titleEn / titleZh / titleBn / descriptionEn / descriptionBn / descriptionZh
//   - category, factory FOB, MOQ, markup %, weight, volume, customs ৳/kg
//   - supplier name/city/province
//   - 1-12 image URLs (paste one per line OR comma-separated)
//   - auto-translate checkbox (if zh filled + en/bn empty, call DeepSeek V4-Flash)
// On Save -> POST /api/admin/products -> creates product + 4 price_tiers
// + uploads images to `product-images/imported/<slug>/...`, busts catalog cache.
//
// No image picker / no file upload — the source is URLs only. For local
// file uploads, the existing /admin/products/[id] editor handles per-product
// uploads via the signed-URL flow.

import { useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog-categories";

export function ManualProductClient() {
  const [sourceId, setSourceId] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [titleBn, setTitleBn] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionZh, setDescriptionZh] = useState("");
  const [descriptionBn, setDescriptionBn] = useState("");
  const [category, setCategory] = useState<string>("gadgets");
  const [factoryCnyPerPc, setFactoryCnyPerPc] = useState("0");
  const [factoryMoq, setFactoryMoq] = useState("1");
  const [markupPct, setMarkupPct] = useState("10");
  const [weightKg, setWeightKg] = useState("0.5");
  const [volumeCbm, setVolumeCbm] = useState("0.0001");
  const [customsDutyPerKg, setCustomsDutyPerKg] = useState("750");
  const [supplierName, setSupplierName] = useState("");
  const [supplierCity, setSupplierCity] = useState("Guangzhou");
  const [supplierProvince, setSupplierProvince] = useState("Guangdong");
  const [imagesText, setImagesText] = useState("");
  const [autoTranslate, setAutoTranslate] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    id: number;
    source_id: string;
    imageCount: number;
  } | null>(null);

  const images = imagesText
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  // titleEn is required UNLESS auto-translate is on AND titleZh is
  // filled (the server will fill titleEn from the zh input via
  // DeepSeek V4-Flash).
  const titleEnOk =
    titleEn.trim().length > 0 ||
    (autoTranslate && titleZh.trim().length > 0);
  const canSave =
    !saving &&
    sourceId.trim().length >= 2 &&
    titleEnOk &&
    parseFloat(factoryCnyPerPc) > 0 &&
    images.length >= 1;

  async function handleSave() {
    setSaveError(null);
    setCreated(null);
    if (!canSave) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: sourceId.trim(),
          titleEn: titleEn.trim(),
          titleZh: titleZh.trim() || undefined,
          titleBn: titleBn.trim() || undefined,
          descriptionEn: descriptionEn.trim() || undefined,
          descriptionZh: descriptionZh.trim() || undefined,
          descriptionBn: descriptionBn.trim() || undefined,
          category,
          factoryCnyPerPc: parseFloat(factoryCnyPerPc),
          factoryMoq: Math.max(1, parseInt(factoryMoq) || 1),
          markupPct: parseFloat(markupPct) || 10,
          weightKg: parseFloat(weightKg) || 0.5,
          volumeCbm: parseFloat(volumeCbm) || 0.0001,
          customsDutyPerKg: parseInt(customsDutyPerKg) || 750,
          supplierName: supplierName.trim() || "Unknown supplier",
          supplierCity: supplierCity.trim() || "Guangzhou",
          supplierProvince: supplierProvince.trim() || "Guangdong",
          images,
          autoTranslate,
        }),
      });
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
      setCreated(data.product);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-6 max-w-3xl">
        <header>
          <h1 className="text-[20px] font-semibold">Product created</h1>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            Now live in the catalog. You can fine-tune the markup, factory
            FOB, image order, and price tiers in the editor.
          </p>
        </header>
        <section className="card p-6">
          <p className="text-[13px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
            ✓ Created product #{created.id} (source_id=
            <span className="font-mono">{created.source_id}</span>) with{" "}
            {created.imageCount} image
            {created.imageCount > 1 ? "s" : ""}.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[12.5px]">
            <Link
              href={`/admin/products/${created.source_id}`}
              className="h-9 px-4 rounded-md bg-cyan-600 text-white hover:bg-cyan-700 flex items-center"
            >
              Open editor →
            </Link>
            <Link
              href={`/products/${created.source_id}`}
              className="h-9 px-4 rounded-md border border-fg/20 hover:bg-fg/5 flex items-center"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on public site ↗
            </Link>
            <Link
              href="/admin/images"
              className="h-9 px-4 rounded-md border border-fg/20 hover:bg-fg/5 flex items-center"
            >
              Generate more images →
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setSourceId("");
                setTitleEn("");
                setTitleZh("");
                setTitleBn("");
                setDescriptionEn("");
                setDescriptionZh("");
                setDescriptionBn("");
                setImagesText("");
                setFactoryCnyPerPc("0");
                setMarkupPct("10");
                setSupplierName("");
              }}
              className="h-9 px-4 rounded-md border border-fg/20 hover:bg-fg/5 text-fg-muted ml-auto"
            >
              + Add another
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-[20px] font-semibold">Add product manually</h1>
        <p className="mt-1 text-[12.5px] text-fg-muted">
          Paste title, description, factory FOB, supplier, and a list of
          image URLs. No URL scrape — use{" "}
          <Link href="/admin/import" className="text-cyan-700 underline">
            Import
          </Link>{" "}
          for Pinduoduo / Taobao. Use{" "}
          <Link href="/admin/images" className="text-cyan-700 underline">
            Image agent
          </Link>{" "}
          to AI-generate website shots after the product is saved.
        </p>
      </header>

      <section className="card p-6 space-y-4">
        <Field
          label="Source ID (slug — unique, 2-80 chars: a-z, 0-9, . _ -)"
          full
        >
          <input
            type="text"
            className="input font-mono"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            placeholder="leather-wallet-001"
            maxLength={80}
          />
        </Field>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-[13px] font-semibold text-fg">Titles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="English (auto-fill from zh if blank)">
            <input
              type="text"
              className="input"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="Vintage leather wallet"
            />
          </Field>
          <Field label="中文 (optional)">
            <input
              type="text"
              className="input"
              value={titleZh}
              onChange={(e) => setTitleZh(e.target.value)}
              placeholder="复古真皮钱包"
            />
          </Field>
          <Field label="বাংলা (optional)">
            <input
              type="text"
              className="input"
              value={titleBn}
              onChange={(e) => setTitleBn(e.target.value)}
              placeholder="ভিন্টেজ চামড়ার মানিব্যাগ"
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-fg-muted">
          <input
            type="checkbox"
            checked={autoTranslate}
            onChange={(e) => setAutoTranslate(e.target.checked)}
          />
          Auto-translate to English &amp; Bangla via DeepSeek (when zh is set
          and en/bn are empty)
        </label>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-[13px] font-semibold text-fg">Descriptions</h2>
        <Field label="English (optional)" full>
          <textarea
            className="input"
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
            rows={3}
            placeholder="A small 1-3 sentence factual description…"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="中文 (optional)">
            <textarea
              className="input"
              value={descriptionZh}
              onChange={(e) => setDescriptionZh(e.target.value)}
              rows={3}
            />
          </Field>
          <Field label="বাংলা (optional)">
            <textarea
              className="input"
              value={descriptionBn}
              onChange={(e) => setDescriptionBn(e.target.value)}
              rows={3}
            />
          </Field>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-[13px] font-semibold text-fg">Pricing &amp; category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Category">
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Factory FOB (¥/pc) *">
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={factoryCnyPerPc}
              onChange={(e) => setFactoryCnyPerPc(e.target.value)}
            />
          </Field>
          <Field label="MOQ (pieces)">
            <input
              type="number"
              step="1"
              min="1"
              className="input"
              value={factoryMoq}
              onChange={(e) => setFactoryMoq(e.target.value)}
            />
          </Field>
          <Field label="Markup % (default 10)">
            <input
              type="number"
              step="0.5"
              min="0"
              max="50"
              className="input"
              value={markupPct}
              onChange={(e) => setMarkupPct(e.target.value)}
            />
          </Field>
          <Field label="Weight (kg/pc)">
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </Field>
          <Field label="Volume (m³/pc)">
            <input
              type="number"
              step="0.0001"
              min="0"
              className="input"
              value={volumeCbm}
              onChange={(e) => setVolumeCbm(e.target.value)}
            />
          </Field>
          <Field label="Customs (৳/kg)">
            <input
              type="number"
              step="10"
              min="0"
              className="input"
              value={customsDutyPerKg}
              onChange={(e) => setCustomsDutyPerKg(e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-[13px] font-semibold text-fg">Supplier</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Name">
            <input
              type="text"
              className="input"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. Guangzhou Trading Co."
            />
          </Field>
          <Field label="City">
            <input
              type="text"
              className="input"
              value={supplierCity}
              onChange={(e) => setSupplierCity(e.target.value)}
            />
          </Field>
          <Field label="Province">
            <input
              type="text"
              className="input"
              value={supplierProvince}
              onChange={(e) => setSupplierProvince(e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-[13px] font-semibold text-fg">Images *</h2>
        <p className="text-[12px] text-fg-muted">
          Paste 1-12 image URLs (jpg/png/webp/avif, max 8MB each). One URL per
          line, or comma-separated. They'll be downloaded and uploaded to the
          <code className="mx-1 font-mono">product-images</code>
          bucket.
        </p>
        <textarea
          className="input font-mono"
          rows={6}
          value={imagesText}
          onChange={(e) => setImagesText(e.target.value)}
          placeholder="https://example.com/photo-1.jpg
https://example.com/photo-2.png
https://example.com/photo-3.webp"
        />
        <p className="text-[11.5px] text-fg-subtle font-mono tnum">
          {images.length} URL{images.length === 1 ? "" : "s"} detected
          {images.length > 12 && (
            <span className="text-red-600 ml-2">
              Too many — max 12 (got {images.length})
            </span>
          )}
        </p>
        {images.length > 0 && images.length <= 12 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {images.slice(0, 12).map((url, i) => (
              <div
                key={i}
                className="aspect-square rounded-md border border-fg/15 bg-fg/5 overflow-hidden relative"
              >
                <img
                  src={url}
                  alt={`preview-${i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = "0.2";
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="h-10 px-5 rounded-md bg-emerald-600 text-white text-[13px] font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create product"}
          </button>
          {saveError && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {saveError}
            </p>
          )}
        </div>
      </section>

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
          font-family: var(--font-mono);
        }
        .input[type="number"] {
          font-variant-numeric: tabular-nums;
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
