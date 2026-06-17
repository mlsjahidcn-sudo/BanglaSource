"use client";

// /admin/import/_client.tsx
//
// Phase 43 — Taobao/Tmall URL paste + auto-prefill form.
//
// Top section: URL input + "Fetch details" button. The fetch is a
// POST to /api/admin/import/scrape which calls Apify and returns a
// product draft. On success, the form below is pre-filled; on failure,
// the error message shows inline with a "switch to manual" link to
// /admin/products/new.
//
// Bottom section: same form structure as /admin/products/new —
// submit goes to /api/admin/products (no APIFY involvement at save
// time).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/catalog-categories";

type Draft = {
  sourceId: string;
  sourceUrl: string;
  sourcePlatform: "taobao" | "tmall" | "world_taobao";
  apifyRunId: string;
  scrapedAt: string;
  titleZh: string | null;
  titleEn: string | null;
  descriptionZh: string | null;
  descriptionEn: string | null;
  categoryGuess: string | null;
  factoryCnyPerPc: number | null;
  factoryMoq: number | null;
  supplierName: string | null;
  images: string[];
};

const PLATFORM_LABEL: Record<Draft["sourcePlatform"], string> = {
  taobao: "Taobao",
  tmall: "Tmall",
  world_taobao: "World Taobao",
};

export function ImportClient() {
  const router = useRouter();

  // ── URL paste state
  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  // ── Form state (pre-filled from `draft` when scraped)
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

  // ── Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    setScraping(true);
    setScrapeError(null);
    setDraft(null);
    try {
      const res = await fetch("/api/admin/import/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) {
        setScrapeError(
          json.message || json.error || `HTTP ${res.status}`,
        );
        return;
      }
      const d: Draft = json.draft;
      setDraft(d);
      // Pre-fill the form
      setSourceId(d.sourceId);
      setTitleEn(d.titleEn ?? "");
      setTitleZh(d.titleZh ?? "");
      setDescriptionZh(d.descriptionZh ?? "");
      setDescriptionEn(d.descriptionEn ?? "");
      setCategory(d.categoryGuess ?? "gadgets");
      setFactoryCnyPerPc(
        d.factoryCnyPerPc != null ? String(d.factoryCnyPerPc) : "0",
      );
      setFactoryMoq(d.factoryMoq != null ? String(d.factoryMoq) : "1");
      setSupplierName(d.supplierName ?? "");
      setImagesText(d.images.join("\n"));
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Network error");
    } finally {
      setScraping(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const images = imagesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const body = {
      sourceId: sourceId.trim(),
      titleEn: titleEn.trim() || undefined,
      titleZh: titleZh.trim() || undefined,
      titleBn: titleBn.trim() || undefined,
      descriptionEn: descriptionEn.trim() || undefined,
      descriptionZh: descriptionZh.trim() || undefined,
      descriptionBn: descriptionBn.trim() || undefined,
      category,
      weightKg: parseFloat(weightKg) || 0,
      volumeCbm: parseFloat(volumeCbm) || 0,
      factoryCnyPerPc: parseFloat(factoryCnyPerPc) || 0,
      factoryMoq: parseInt(factoryMoq, 10) || 1,
      markupPct: parseFloat(markupPct) || 10,
      customsDutyPerKg: parseFloat(customsDutyPerKg) || 0,
      supplierName: supplierName.trim() || "Unknown",
      supplierCity: supplierCity.trim() || "Guangzhou",
      supplierProvince: supplierProvince.trim() || "Guangdong",
      images,
      autoTranslate,
    };
    try {
      const r = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        setSaveError(
          json.message || json.error || `HTTP ${r.status}`,
        );
        return;
      }
      router.push(`/admin/products/${json.product.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  const titleEnOk = titleEn.trim().length >= 3;
  const valid =
    sourceId.trim().length >= 2 &&
    titleEnOk &&
    parseFloat(factoryCnyPerPc) > 0 &&
    imagesText.split("\n").filter((s) => s.trim()).length >= 1;

  return (
    <Container className="py-10 max-w-3xl">
      <header className="mb-6">
        <p className="section-eyebrow">Import</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight">
          Import from Taobao / Tmall
        </h1>
        <p className="mt-2 text-[13.5px] text-fg-muted max-w-2xl">
          Paste a product URL. We'll fetch the title, images, price,
          and seller info, and pre-fill the form below. You can edit
          anything before saving. Pinduoduo URLs aren't supported —
          use the{" "}
          <Link
            href="/admin/products/new"
            className="text-cyan-700 hover:text-cyan-800 font-medium"
          >
            manual form
          </Link>{" "}
          instead.
        </p>
      </header>

      {/* ── URL paste section ─────────────────────────────────────── */}
      <form
        onSubmit={handleScrape}
        className="card p-5 mb-6 space-y-3"
      >
        <label className="block">
          <span className="text-[12px] font-medium text-fg">
            Taobao / Tmall product URL
          </span>
          <div className="mt-1.5 flex items-stretch gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://item.taobao.com/item.htm?id=123456789012"
              required
              autoComplete="off"
              className="flex-1 px-3 py-2 border border-border rounded text-[13.5px] font-mono focus:outline-none focus:border-cyan-500"
            />
            <Button type="submit" disabled={scraping || !url.trim()}>
              {scraping ? "Fetching…" : "Fetch details"}
            </Button>
          </div>
          <span className="text-[11px] text-fg-subtle mt-1.5 block">
            Scraping takes 5-20 seconds. We're calling an external
            service (Apify).
          </span>
        </label>

        {scrapeError && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-800">
            <strong>Couldn't fetch.</strong> {scrapeError}
            <div className="mt-2 text-[11.5px]">
              You can still fill in the product manually below or{" "}
              <Link
                href="/admin/products/new"
                className="underline text-cyan-700 hover:text-cyan-800"
              >
                open the manual form
              </Link>
              .
            </div>
          </div>
        )}

        {draft && (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-900 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>
              Pre-filled from{" "}
              <strong>{PLATFORM_LABEL[draft.sourcePlatform]}</strong>{" "}
              item <code className="font-mono">{draft.sourceId}</code>.
              Review the form below, fill any gaps, then Save.
            </span>
          </div>
        )}
      </form>

      {/* ── Pre-filled product form ──────────────────────────────── */}
      <form onSubmit={handleSave} className="card p-6 space-y-5">
        <Section title="Identity">
          <Field label="Source ID" required>
            <input
              type="text"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              required
              minLength={2}
              className={inputClass}
            />
          </Field>
        </Section>

        <Section title="Titles (the Chinese title from Taobao is shown; English/Bengali auto-translate on Save)">
          <Field label="Title (English)" required>
            <input
              type="text"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              required
              minLength={3}
              className={inputClass}
              placeholder="If empty, auto-translated from zh on save"
            />
          </Field>
          <Field label="Title (中文)">
            <input
              type="text"
              value={titleZh}
              onChange={(e) => setTitleZh(e.target.value)}
              className={inputClass}
              placeholder="Optional — used as auto-translate source"
            />
          </Field>
          <Field label="Title (বাংলা)">
            <input
              type="text"
              value={titleBn}
              onChange={(e) => setTitleBn(e.target.value)}
              className={inputClass}
              placeholder="Optional — auto-filled if autoTranslate is on"
            />
          </Field>
        </Section>

        <Section title="Descriptions (HTML / markdown — sanitized server-side)">
          <Field label="Description (English)">
            <textarea
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </Field>
          <Field label="Description (中文)">
            <textarea
              value={descriptionZh}
              onChange={(e) => setDescriptionZh(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </Field>
          <Field label="Description (বাংলা)">
            <textarea
              value={descriptionBn}
              onChange={(e) => setDescriptionBn(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </Field>
        </Section>

        <Section title="Pricing & category">
          <Field label="Category" required>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Factory ¥/pc" required>
              <input
                type="number"
                step="0.01"
                value={factoryCnyPerPc}
                onChange={(e) => setFactoryCnyPerPc(e.target.value)}
                required
                className={inputClass}
              />
            </Field>
            <Field label="MOQ (pcs)">
              <input
                type="number"
                min={1}
                value={factoryMoq}
                onChange={(e) => setFactoryMoq(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Markup %" hint="0-50">
              <input
                type="number"
                min={0}
                max={50}
                value={markupPct}
                onChange={(e) => setMarkupPct(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="Logistics">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Weight (kg/pc)">
              <input
                type="number"
                step="0.001"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Volume (m³/pc)">
              <input
                type="number"
                step="0.00001"
                value={volumeCbm}
                onChange={(e) => setVolumeCbm(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Customs ৳/kg" hint="BD specific duty">
              <input
                type="number"
                step="1"
                value={customsDutyPerKg}
                onChange={(e) => setCustomsDutyPerKg(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="Supplier">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Supplier name">
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="City">
              <input
                type="text"
                value={supplierCity}
                onChange={(e) => setSupplierCity(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Province">
              <input
                type="text"
                value={supplierProvince}
                onChange={(e) => setSupplierProvince(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="Images (one URL per line)">
          <textarea
            value={imagesText}
            onChange={(e) => setImagesText(e.target.value)}
            rows={5}
            className={`${inputClass} font-mono text-[12px]`}
            placeholder={"https://...\nhttps://..."}
            required
          />
          <p className="text-[11.5px] text-fg-subtle mt-1.5">
            Downloaded server-side into Supabase Storage on save.
            External URLs are kept; the admin can regenerate via the
            image agent later.
          </p>
        </Section>

        <Section title="Translation">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={autoTranslate}
              onChange={(e) => setAutoTranslate(e.target.checked)}
              className="accent-cyan-600"
            />
            <span>
              Auto-translate empty EN / BN fields from 中文 via DeepSeek
              V4-Flash on save
            </span>
          </label>
        </Section>

        {saveError && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-800">
            <strong>Couldn't save.</strong> {saveError}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <Button size="lg" disabled={!valid || saving}>
            {saving ? "Saving…" : "Save product"}
          </Button>
          <Link
            href="/admin/products"
            className="text-[12.5px] text-fg-muted hover:text-fg"
          >
            Cancel
          </Link>
        </div>
      </form>
    </Container>
  );
}

const inputClass =
  "w-full mt-1.5 px-3 py-2 border border-border rounded text-[13.5px] focus:outline-none focus:border-cyan-500 bg-bg";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="section-eyebrow mb-3">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-fg">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </span>
      {children}
      {hint && (
        <span className="text-[11px] text-fg-subtle mt-1 block">{hint}</span>
      )}
    </label>
  );
}