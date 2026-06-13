// Thin REST client for the Pinduoduo and Taobao Apify scrapers.
// Same pattern as src/lib/ingest/apify.ts (the 1688 scraper).
//
// Pinduoduo actor: pocesar/pinduoduo-scraper
//   input: { startUrls: [{ url }] } or { productIds: [...] }
//   output: { id, name, price, originalPrice, thumbnails, images,
//             description, weight, sku, shopName, ... }
//
// Taobao actor:    pocesar/taobao-scraper (or jupound/taobao-scraper)
//   input: { startUrls: [{ url }] } or { productIds: [...] }
//   output: { id, title, price, originalPrice, pictures (or images),
//             description, weight, shopName, ... }
//
// The raw response shapes are similar but not identical. We
// normalize to a single `ScrapedProduct` type below so the
// admin UI has one preview form regardless of source.

import "server-only";
import { startRun, pollRun, fetchDataset } from "./apify";

const APIFY_BASE = "https://api.apify.com/v2";
// Apify's Taobao/Tmall detail scraper (zen-studio) is the only
// reliable English-friendly actor in the Store for Chinese
// e-commerce URLs. It's documented for Taobao + Tmall but the
// actor also handles other Alibaba-group domains (Pinduoduo,
// 1688 redirect URLs, etc.) as long as the startUrl is the
// real product page. Pinduoduo's share short-URLs (p.pinduoduo.com/abc)
// get followed to the mobile.yangkeduo.com/goods.html?goods_id=…
// form internally.
//
// If Apify's Store ever gets a dedicated Pinduoduo actor,
// swap PINDUODUO_ACTOR for it. The contract (input + output
// shape) is normalized below so the rest of the app doesn't
// care.
const PINDUODUO_ACTOR = "zen-studio~taobao-detail-scraper";
const TAOBAO_ACTOR = "zen-studio~taobao-detail-scraper";

/** The two source platforms we support. */
export type Source = "pinduoduo" | "taobao";

/**
 * Best-effort detection of which platform a URL belongs to.
 * Returns null for unknown URLs.
 */
export function detectSource(url: string): Source | null {
  const u = url.toLowerCase();
  // Pinduoduo / Temu / Duoduo share hosts:
  //   pinduoduo.com  mobile.yangkeduo.com  p.pinduoduo.com  temu.com
  if (
    u.includes("pinduoduo.com") ||
    u.includes("yangkeduo.com") ||
    u.includes("temu.com")
  ) {
    return "pinduoduo";
  }
  // Taobao / Tmall:
  //   taobao.com  tmall.com  world.taobao.com  detail.tmall.com
  if (
    u.includes("taobao.com") ||
    u.includes("tmall.com") ||
    u.includes("aliexpress.com")
  ) {
    return "taobao";
  }
  return null;
}

/**
 * Extract the goods/item id from a Pinduoduo or Taobao URL.
 *
 * Pinduoduo share URLs come in many forms:
 *   https://mobile.yangkeduo.com/goods.html?goods_id=123456
 *   https://p.pinduoduo.com/Q7cKabc123
 *   https://item.pinduoduo.com/item.html?sku_id=789
 *
 * Taobao URLs:
 *   https://item.taobao.com/item.html?id=123456
 *   https://detail.tmall.com/item.htm?id=789
 *   https://world.taobao.com/item/i123.htm
 *
 * Returns the long numeric id when we can find one. For
 * short-share URLs we return the slug so the Apify actor
 * can follow the redirect itself.
 */
export function extractItemId(url: string): string | null {
  // Try to pull an id= / goods_id= / sku_id= param first
  try {
    const u = new URL(url);
    const param =
      u.searchParams.get("id") ??
      u.searchParams.get("goods_id") ??
      u.searchParams.get("item_id") ??
      u.searchParams.get("sku_id");
    if (param && /^\d{6,}$/.test(param)) return param;
  } catch {
    // not a valid URL — fall through
  }
  // Fallback: regex over the path
  const m = url.match(/(?:id|goods_id|item_id|sku_id)[=/]([0-9]{6,})/);
  if (m) return m[1];
  return null;
}

/**
 * Raw actor response (loose). We don't commit to a strict
 * shape — different Apify actors return slightly different
 * fields. The normalizer below picks the right ones.
 */
type RawItem = Record<string, unknown> & {
  id?: string | number;
  name?: string;
  title?: string;
  goodsName?: string;
  goods_title?: string;
  price?: number | string;
  price_cny?: number | string;
  originalPrice?: number | string;
  original_price?: number | string;
  thumbnails?: string[];
  thumbnail?: string;
  images?: string[];
  pictures?: string[];
  goods_images?: string[];
  desc?: string;
  description?: string;
  goodsDesc?: string;
  weight?: number | string;
  weight_g?: number | string;
  weightKg?: number | string;
  shopName?: string;
  shop_name?: string;
  storeName?: string;
  shopId?: string | number;
  mallId?: string | number;
  sales?: number | string;
  category?: string;
};

/**
 * Normalized scraped product. Fields the admin MUST fill
 * before save (category, factory FOB) are present but may
 * be empty — the UI prompts for them.
 */
export type ScrapedProduct = {
  source: Source;
  sourceUrl: string;
  sourceId: string; // goods_id / item_id (used as our products.source_id)
  titleZh: string; // raw Chinese title from the platform
  descriptionZh: string;
  priceCny: number; // retail price on the platform (not factory FOB)
  originalPriceCny: number | null;
  images: string[]; // CDN URLs, in display order (thumbnail first)
  weightKg: number; // best-effort; 0.5 default if unknown
  supplierName: string;
  supplierCity: string;
  supplierProvince: string;
  sales: number;
  rawItem: RawItem; // the full actor response, for the UI to peek at
};

function firstString(item: RawItem, keys: string[]): string {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return "";
}

function firstNumber(item: RawItem, keys: string[]): number {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim().length > 0) {
      const n = Number.parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function firstImageList(item: RawItem, keys: string[]): string[] {
  for (const k of keys) {
    const v = item[k];
    if (Array.isArray(v)) {
      const filtered = v.filter(
        (u): u is string => typeof u === "string" && u.length > 4,
      );
      if (filtered.length > 0) return filtered;
    }
  }
  return [];
}

function normalize(
  source: Source,
  url: string,
  raw: RawItem,
  idOverride?: string,
): ScrapedProduct {
  const id =
    idOverride ??
    (raw.id != null ? String(raw.id) : "") ??
    extractItemId(url) ??
    "";

  const titleZh = firstString(raw, [
    "name",
    "title",
    "goodsName",
    "goods_title",
    "goodsName",
  ]);
  const descriptionZh = firstString(raw, [
    "description",
    "desc",
    "goodsDesc",
  ]);

  const priceCny = firstNumber(raw, ["price", "price_cny", "salePrice"]);
  const originalPriceCny = firstNumber(raw, [
    "originalPrice",
    "original_price",
    "marketPrice",
  ]);

  // Images — try several keys, then de-dupe while preserving order
  const images = firstImageList(raw, [
    "images",
    "pictures",
    "goods_images",
    "thumbnails",
    "thumbnail",
  ]);
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const u of images) {
    // Pinduoduo / Taobao CDN URLs sometimes have ?imageView2/2/w/...
    // query strings that swap resolution. Strip them so we always
    // get the largest available image at upload time.
    const clean = u.split("?")[0];
    if (!seen.has(clean)) {
      seen.add(clean);
      deduped.push(clean);
    }
  }

  // Weight — many Pinduoduo items don't include weight; default
  // to 0.5kg so the admin has a placeholder to edit. 1kg for
  // Taobao (Taobao tends to weight in grams).
  const rawWeight = firstNumber(raw, [
    "weight_g",
    "weight",
    "weightKg",
  ]);
  let weightKg = rawWeight;
  if (weightKg > 0 && weightKg < 50) {
    // likely grams, convert to kg
    weightKg = weightKg / 1000;
  }
  if (weightKg <= 0) weightKg = 0.5;

  const supplierName = firstString(raw, [
    "shopName",
    "shop_name",
    "storeName",
  ]) || (source === "pinduoduo" ? "Pinduoduo supplier" : "Taobao supplier");

  // Pinduoduo + Taobao don't expose province/city in the basic
  // actor output. Default to a generic "Guangdong, Guangzhou"
  // for both — admin can override.
  const supplierProvince = "Guangdong";
  const supplierCity = "Guangzhou";

  const sales = firstNumber(raw, ["sales", "soldCount", "saleCount"]);

  return {
    source,
    sourceUrl: url,
    sourceId: id,
    titleZh,
    descriptionZh,
    priceCny,
    originalPriceCny: originalPriceCny > 0 ? originalPriceCny : null,
    images: deduped,
    weightKg,
    supplierName,
    supplierProvince,
    supplierCity,
    sales,
    rawItem: raw,
  };
}

/**
 * Run the right Apify actor for `source`, poll until
 * SUCCEEDED, fetch the dataset, and return the first item
 * normalized. Throws on failure / timeout / empty.
 */
export async function scrapeProduct(
  url: string,
  source: Source,
): Promise<ScrapedProduct> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN is not set. Add it to .env.local.");
  }
  const actorId = source === "pinduoduo" ? PINDUODUO_ACTOR : TAOBAO_ACTOR;
  const itemId = extractItemId(url);

  // The zen-studio actor accepts an `items` array. Each item
  // is either `{ url: "https://..." }` or `{ id: "123" }`.
  // We always pass the URL so the actor follows redirects
  // (important for short-share URLs like p.pinduoduo.com/abc).
  const input: Record<string, unknown> = {
    items: [{ url }],
    maxItems: 1,
  };
  if (itemId) {
    // Belt-and-suspenders: also pass the numeric id so the
    // actor can skip the redirect hop when the id is embedded
    // in a canonical Taobao/Tmall URL.
    (input.items as Array<Record<string, unknown>>)[0].id = itemId;
  }

  const startRes = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      // @ts-expect-error Node 25 supports this
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!startRes.ok) {
    const body = await startRes.text();
    throw new Error(`Apify start ${startRes.status}: ${body.slice(0, 500)}`);
  }
  const startData = (await startRes.json()) as {
    data: { id: string; defaultDatasetId: string };
  };
  const runId = startData.data.id;
  const datasetId = startData.data.defaultDatasetId;

  // Poll — these actors typically finish in 30-90s
  const result = await pollRun(runId, { pollMs: 4_000, timeoutMs: 240_000 });
  if (result.status !== "SUCCEEDED") {
    throw new Error(
      `Apify ${source} run ${result.status}: ${result.errorMessage ?? "(no error)"}`,
    );
  }
  const items = await fetchDataset<RawItem>(datasetId);
  if (!items || items.length === 0) {
    throw new Error(
      `Apify ${source} returned no items. The product page may be unavailable, require login, or the URL may be malformed.`,
    );
  }
  return normalize(source, url, items[0], itemId ?? undefined);
}
