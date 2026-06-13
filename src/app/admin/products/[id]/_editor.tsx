"use client";
// /app/admin/products/[id]/_editor.tsx
//
// Client-side product editor for the admin portal.
// - Edits title_en / title_bn / description_en / description_bn
// - Edits markup_pct, active toggle, category, weight, volume
// - Image grid: reorder, remove, "upload new" (direct to Supabase
//   Storage via signed URL), "AI: regenerate listing" (DeepSeek V4-Flash)
// - Save button: PATCH /api/admin/products/[id]
//
// AI features are gated on the parent providing a product flag —
// DeepSeek is optional (env var) and the button shows a "disabled"
// state when the key isn't set.

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export type EditorProduct = {
  id: number;
  source_id: string;
  title_zh: string;
  title_en: string;
  title_bn: string;
  description_en: string;
  description_bn: string;
  category: string;
  active: boolean;
  markup_pct: number;
  weight_kg: number;
  volume_cbm: number;
  images: string[];
  supplier_name: string;
  supplier_city: string;
  source_url: string;
  factory_moq: number;
  price_min_cny: number;
  price_max_cny: number;
  badges: string[];
};

const CATEGORIES = [
  "gadgets",
  "eyewear",
  "shoes",
  "bags",
  "watches",
  "beauty",
  "jewelry",
] as const;

type SaveState = "idle" | "saving" | "ok" | "err";
type AiState = "idle" | "loading" | "ok" | "err";

function cn(...x: Array<string | false | undefined | null>): string {
  return x.filter(Boolean).join(" ");
}

export function AdminProductEditor({
  product,
  aiEnabled,
}: {
  product: EditorProduct;
  aiEnabled: boolean;
}) {
  const router = useRouter();

  // Form state
  const [titleEn, setTitleEn] = useState(product.title_en);
  const [titleBn, setTitleBn] = useState(product.title_bn);
  const [descEn, setDescEn] = useState(product.description_en);
  const [descBn, setDescBn] = useState(product.description_bn);
  const [category, setCategory] = useState(product.category);
  const [markupPct, setMarkupPct] = useState(String(product.markup_pct));
  const [active, setActive] = useState(product.active);
  const [weightKg, setWeightKg] = useState(String(product.weight_kg));
  const [volumeCbm, setVolumeCbm] = useState(String(product.volume_cbm));
  const [images, setImages] = useState<string[]>(product.images);

  // Save state
  const [save, setSave] = useState<SaveState>("idle");
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // AI state (per-action: regenerate, translate-only)
  const [aiRegen, setAiRegen] = useState<AiState>("idle");
  const [aiRegenErr, setAiRegenErr] = useState<string | null>(null);
  const [aiTrans, setAiTrans] = useState<AiState>("idle");
  const [aiTransErr, setAiTransErr] = useState<string | null>(null);

  // Image upload state
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Track which fields are dirty
  const dirty = useMemo(() => {
    return (
      titleEn !== product.title_en ||
      titleBn !== product.title_bn ||
      descEn !== product.description_en ||
      descBn !== product.description_bn ||
      category !== product.category ||
      String(markupPct) !== String(product.markup_pct) ||
      active !== product.active ||
      String(weightKg) !== String(product.weight_kg) ||
      String(volumeCbm) !== String(product.volume_cbm) ||
      JSON.stringify(images) !== JSON.stringify(product.images)
    );
  }, [
    titleEn,
    titleBn,
    descEn,
    descBn,
    category,
    markupPct,
    active,
    weightKg,
    volumeCbm,
    images,
    product,
  ]);

  async function handleSave() {
    setSave("saving");
    setSaveErr(null);
    try {
      const r = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title_en: titleEn,
          title_bn: titleBn,
          description_en: descEn,
          description_bn: descBn,
          category,
          markup_pct: Number.parseFloat(markupPct) || 0,
          active,
          weight_kg: Number.parseFloat(weightKg) || 0,
          volume_cbm: Number.parseFloat(volumeCbm) || 0,
          images,
        }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (!j.ok) {
        setSave("err");
        setSaveErr(j.error ?? "unknown_error");
        return;
      }
      setSave("ok");
      router.refresh();
      setTimeout(() => setSave("idle"), 2200);
    } catch (e) {
      setSave("err");
      setSaveErr((e as Error).message);
    }
  }

  async function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // allow re-selecting the same file
    setUploading(true);
    setUploadErr(null);
    try {
      // 1) Get a signed upload URL from our API
      const r1 = await fetch(`/api/admin/products/${product.id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "image/jpeg",
        }),
      });
      const j1 = (await r1.json()) as {
        ok: boolean;
        uploadUrl?: string;
        token?: string;
        publicUrl?: string;
        error?: string;
      };
      if (!j1.ok || !j1.uploadUrl || !j1.publicUrl) {
        setUploadErr(j1.error ?? "signed_url_failed");
        setUploading(false);
        return;
      }
      // 2) PUT the file directly to Supabase Storage
      const r2 = await fetch(j1.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "image/jpeg",
          Authorization: `Bearer ${j1.token}`,
        },
        body: file,
      });
      if (!r2.ok) {
        setUploadErr(`storage_${r2.status}`);
        setUploading(false);
        return;
      }
      // 3) Add the public URL to the images list (NOT auto-saving —
      // user clicks Save to persist)
      setImages((prev) => [...prev, j1.publicUrl!]);
      setUploading(false);
    } catch (err) {
      setUploadErr((err as Error).message);
      setUploading(false);
    }
  }

  async function handleRemoveImage(idx: number) {
    const url = images[idx];
    if (!url) return;
    if (!confirm("Remove this image?")) return;
    // Optimistic remove
    setImages((prev) => prev.filter((_, i) => i !== idx));
    // Best-effort delete from storage + DB
    try {
      await fetch(`/api/admin/products/${product.id}/images`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicUrl: url }),
      });
    } catch {
      // ignore — the storage object can stay; admin can retry later
    }
  }

  async function handleMoveImage(idx: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  async function handleAiRegenerate() {
    setAiRegen("loading");
    setAiRegenErr(null);
    try {
      const r = await fetch(`/api/admin/products/${product.id}/ai-regenerate`, {
        method: "POST",
      });
      const j = (await r.json()) as {
        ok: boolean;
        result?: {
          title_en: string;
          title_bn: string;
          description_en: string;
          description_bn: string;
        };
        error?: string;
      };
      if (!j.ok || !j.result) {
        setAiRegen("err");
        setAiRegenErr(j.error ?? "regenerate_failed");
        return;
      }
      setTitleEn(j.result.title_en);
      setTitleBn(j.result.title_bn);
      setDescEn(j.result.description_en);
      setDescBn(j.result.description_bn);
      setAiRegen("ok");
      setTimeout(() => setAiRegen("idle"), 2200);
    } catch (e) {
      setAiRegen("err");
      setAiRegenErr((e as Error).message);
    }
  }

  async function handleAiTranslate() {
    setAiTrans("loading");
    setAiTransErr(null);
    try {
      const r = await fetch(`/api/admin/products/${product.id}/ai-translate`, {
        method: "POST",
      });
      const j = (await r.json()) as {
        ok: boolean;
        result?: { title_en: string; title_bn: string };
        error?: string;
      };
      if (!j.ok || !j.result) {
        setAiTrans("err");
        setAiTransErr(j.error ?? "translate_failed");
        return;
      }
      setTitleEn(j.result.title_en);
      setTitleBn(j.result.title_bn);
      setAiTrans("ok");
      setTimeout(() => setAiTrans("idle"), 2200);
    } catch (e) {
      setAiTrans("err");
      setAiTransErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      {/* Title + meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-medium tracking-wider uppercase text-fg-subtle mb-1.5">
            Title (English)
          </label>
          <input
            type="text"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-md text-[14px] focus:border-border-strong outline-none"
            maxLength={200}
          />
          <p className="mt-1 text-[11px] text-fg-subtle font-mono tnum">
            {titleEn.length}/200
          </p>
        </div>
        <div>
          <label className="block text-[11px] font-medium tracking-wider uppercase text-fg-subtle mb-1.5">
            Title (বাংলা)
          </label>
          <input
            type="text"
            value={titleBn}
            onChange={(e) => setTitleBn(e.target.value)}
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-md text-[14px] focus:border-border-strong outline-none"
            maxLength={200}
          />
          <p className="mt-1 text-[11px] text-fg-subtle font-mono tnum">
            {titleBn.length}/200
          </p>
        </div>
      </div>

      <details className="text-[12px] text-fg-subtle">
        <summary className="cursor-pointer hover:text-fg">
          Original Chinese title
        </summary>
        <p className="mt-2 px-3 py-2 bg-bg-soft rounded text-[13px] font-mono">
          {product.title_zh}
        </p>
      </details>

      {/* Descriptions */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[11px] font-medium tracking-wider uppercase text-fg-subtle">
            Description (English)
          </label>
          <span className="text-[11px] text-fg-subtle font-mono tnum">
            {descEn.length}/4000
          </span>
        </div>
        <textarea
          value={descEn}
          onChange={(e) => setDescEn(e.target.value)}
          className="w-full px-3 py-2.5 bg-bg border border-border rounded-md text-[14px] focus:border-border-strong outline-none min-h-[120px] resize-y"
          maxLength={4000}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[11px] font-medium tracking-wider uppercase text-fg-subtle">
            Description (বাংলা)
          </label>
          <span className="text-[11px] text-fg-subtle font-mono tnum">
            {descBn.length}/4000
          </span>
        </div>
        <textarea
          value={descBn}
          onChange={(e) => setDescBn(e.target.value)}
          className="w-full px-3 py-2.5 bg-bg border border-border rounded-md text-[14px] focus:border-border-strong outline-none min-h-[120px] resize-y"
          maxLength={4000}
        />
      </div>

      {/* Pricing + meta */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-[11px] font-medium tracking-wider uppercase text-fg-subtle mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-md text-[14px] focus:border-border-strong outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium tracking-wider uppercase text-fg-subtle mb-1.5">
            Markup %
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="50"
            value={markupPct}
            onChange={(e) => setMarkupPct(e.target.value)}
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-md text-[14px] font-mono tnum focus:border-border-strong outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium tracking-wider uppercase text-fg-subtle mb-1.5">
            Weight (kg)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-md text-[14px] font-mono tnum focus:border-border-strong outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium tracking-wider uppercase text-fg-subtle mb-1.5">
            Volume (CBM)
          </label>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={volumeCbm}
            onChange={(e) => setVolumeCbm(e.target.value)}
            className="w-full px-3 py-2.5 bg-bg border border-border rounded-md text-[14px] font-mono tnum focus:border-border-strong outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium tracking-wider uppercase text-fg-subtle mb-1.5">
            Active
          </label>
          <button
            type="button"
            onClick={() => setActive((a) => !a)}
            className={cn(
              "w-full px-3 py-2.5 rounded-md text-[13px] font-medium border transition-colors",
              active
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-slate-50 border-slate-300 text-slate-700",
            )}
          >
            {active ? "● Active" : "○ Inactive"}
          </button>
        </div>
      </div>

      {/* Images */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-[11px] font-medium tracking-wider uppercase text-fg-subtle">
            Images ({images.length})
          </label>
          <div className="flex items-center gap-2">
            {uploadErr && (
              <p className="text-[11px] text-rose-600 font-mono">
                {uploadErr}
              </p>
            )}
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={uploading || images.length >= 12}
              className="px-3 py-1.5 bg-cyan-600 text-white rounded text-[12px] font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading…" : "+ Upload image"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelected}
              className="hidden"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {images.map((url, i) => (
            <div
              key={url + i}
              className="relative aspect-square rounded-md border border-border overflow-hidden bg-slate-50 group"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="160px"
                className="object-cover"
                unoptimized
              />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-cyan-600 text-white text-[9px] font-medium uppercase tracking-wider rounded">
                  Hero
                </span>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-center opacity-0 group-hover:opacity-100">
                <div className="flex items-center gap-1 pb-2">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => handleMoveImage(i, -1)}
                      className="w-6 h-6 rounded bg-white/90 text-fg text-[10px] hover:bg-white"
                      title="Move left"
                    >
                      ←
                    </button>
                  )}
                  {i < images.length - 1 && (
                    <button
                      type="button"
                      onClick={() => handleMoveImage(i, 1)}
                      className="w-6 h-6 rounded bg-white/90 text-fg text-[10px] hover:bg-white"
                      title="Move right"
                    >
                      →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(i)}
                    className="w-6 h-6 rounded bg-white/90 text-rose-600 text-[10px] hover:bg-rose-50"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI actions */}
      {aiEnabled && (
        <div className="card p-4 bg-cyan-50/40 border-cyan-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-medium tracking-wider uppercase text-cyan-700">
                AI assist
              </p>
              <p className="mt-1 text-[12.5px] text-fg-muted">
                Use DeepSeek to translate or rewrite this listing based on
                the original Chinese title and supplier data.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={handleAiTranslate}
                disabled={aiTrans === "loading"}
                className="px-3 py-1.5 bg-white border border-cyan-300 text-cyan-700 rounded text-[12px] font-medium hover:bg-cyan-50 disabled:opacity-50"
              >
                {aiTrans === "loading"
                  ? "Translating…"
                  : aiTrans === "ok"
                    ? "✓ Translated"
                    : "Translate titles only"}
              </button>
              <button
                type="button"
                onClick={handleAiRegenerate}
                disabled={aiRegen === "loading"}
                className="px-3 py-1.5 bg-cyan-600 text-white rounded text-[12px] font-medium hover:bg-cyan-700 disabled:opacity-50"
              >
                {aiRegen === "loading"
                  ? "Regenerating…"
                  : aiRegen === "ok"
                    ? "✓ Done"
                    : "Rewrite full listing"}
              </button>
            </div>
          </div>
          {aiTransErr && (
            <p className="mt-2 text-[11px] text-rose-600 font-mono">
              Translate failed: {aiTransErr}
            </p>
          )}
          {aiRegenErr && (
            <p className="mt-2 text-[11px] text-rose-600 font-mono">
              Regenerate failed: {aiRegenErr}
            </p>
          )}
        </div>
      )}

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-6 md:-mx-8 px-6 md:px-8 py-4 bg-bg border-t border-border flex items-center justify-between gap-4">
        <div>
          {saveErr && (
            <p className="text-[12px] text-rose-600 font-mono">
              Save failed: {saveErr}
            </p>
          )}
          {save === "ok" && (
            <p className="text-[12px] text-emerald-700 font-mono">
              ✓ Saved
            </p>
          )}
          {save === "saving" && (
            <p className="text-[12px] text-fg-muted font-mono">Saving…</p>
          )}
          {save === "idle" && !dirty && (
            <p className="text-[12px] text-fg-subtle">No changes</p>
          )}
          {save === "idle" && dirty && (
            <p className="text-[12px] text-amber-700 font-mono">
              Unsaved changes
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || save === "saving"}
          className="px-5 py-2.5 bg-cyan-600 text-white rounded-md text-[13px] font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {save === "saving" ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
