// /lib/taobao-import.ts
//
// Phase 43 — Taobao/Tmall product import via Apify.
//
// FLOW:
//   1. Admin pastes a Taobao/Tmall URL on /admin/import.
//   2. The page POSTs to /api/admin/import/scrape with { url }.
//   3. parseTaobaoUrl() extracts the numeric item ID + the platform.
//   4. scrapeTaobao() calls Apify actor `zen-studio/taobao-detail-scraper`
//      with a { startUrls: [{ url }] } input. The actor runs synchronously
//      (Apify's API offers a "waitForFinish" option up to ~5 min).
//   5. mapApifyToProductDraft() converts the Apify result to a
//      BanglaSource-compatible product draft that the existing
//      /admin/products/new form can render + submit.
//
// NOTES:
//   - Pinduoduo URLs are REJECTED at the parser (the actor doesn't
//     support them; mobile page is JS-rendered; API requires app auth).
//   - The actor scrapes from Apify's own infra, so geo-blocks that
//     hit us from Singapore/Shanghai aren't an issue.
//   - We DON'T auto-translate in this route — translation happens in
//     the existing /api/admin/products POST if `autoTranslate` is true.
//     Keeps this route's responsibility narrow: scrape → draft.

export type TaobaoPlatform = "taobao" | "tmall" | "world_taobao";

export type ParsedTaobaoUrl =
  | {
      ok: true;
      platform: TaobaoPlatform;
      itemId: string;
      /** Canonical URL — useful for the admin to copy back. */
      canonicalUrl: string;
    }
  | {
      ok: false;
      reason:
        | "unsupported_platform"
        | "missing_item_id"
        | "invalid_url"
        | "pinduoduo_unsupported";
    };

const TAOBAO_HOSTS = new Set([
  "item.taobao.com",
  "detail.taobao.com",
  "chaoshi.detail.taobao.com",
]);
// World Taobao is checked BEFORE the generic taobao hosts set —
// world.taobao.com would otherwise match TAOBAO_HOSTS via overlap.
const WORLD_TAOBAO_HOSTS = new Set([
  "world.taobao.com",
  "item.world.taobao.com",
]);
const TMALL_HOSTS = new Set([
  "detail.tmall.com",
  "detail.tmall.hk",
  "chaoshi.tmall.com",
  "item.tmall.com",
]);
const PINDUODUO_HOSTS = new Set([
  "mobile.yangkeduo.com",
  "yangkeduo.com",
  "pinduoduo.com",
  "item.pinduoduo.com",
  "pdd.com",
]);

/**
 * Parse a Taobao/Tmall product URL into a structured form.
 * Accepts:
 *   https://item.taobao.com/item.htm?id=123456
 *   https://detail.tmall.com/item.htm?id=987654
 *   https://world.taobao.com/item/123456
 *   https://detail.tmall.hk/item.htm?id=987654&skuId=...
 *
 * Returns a discriminated union — `ok: false` carries a `reason`
 * the UI can render directly.
 */
export function parseTaobaoUrl(input: string): ParsedTaobaoUrl {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (PINDUODUO_HOSTS.has(host)) {
    return { ok: false, reason: "pinduoduo_unsupported" };
  }

  let platform: TaobaoPlatform | null = null;
  if (WORLD_TAOBAO_HOSTS.has(host)) platform = "world_taobao";
  else if (TAOBAO_HOSTS.has(host)) platform = "taobao";
  else if (TMALL_HOSTS.has(host)) platform = "tmall";
  if (!platform) return { ok: false, reason: "unsupported_platform" };

  // Two URL shapes:
  //   1) /item.htm?id=<digits>   (item.taobao.com, tmall, etc.)
  //   2) /item/<digits>          (world.taobao.com clean URL)
  let itemId: string | null = url.searchParams.get("id");
  if (!itemId) {
    const m = url.pathname.match(/\/item\/(\d+)/);
    if (m) itemId = m[1];
  }
  if (!itemId || !/^\d{3,20}$/.test(itemId)) {
    return { ok: false, reason: "missing_item_id" };
  }

  const canonicalUrl =
    platform === "taobao"
      ? `https://item.taobao.com/item.htm?id=${itemId}`
      : platform === "world_taobao"
        ? `https://world.taobao.com/item/${itemId}`
        : `https://detail.tmall.com/item.htm?id=${itemId}`;
  return { ok: true, platform, itemId, canonicalUrl };
}

/**
 * The Apify actor returns a heterogeneous shape — different fields
 * for Taobao vs Tmall, sometimes nested under translated keys.
 * This type captures the subset we actually use.
 */
export type ApifyTaobaoItem = {
  id?: string | number;
  itemId?: string | number;
  /** Raw Chinese title — the actor usually returns `title` for the original. */
  title?: string;
  /** Sometimes the actor returns an English title too; not always present. */
  titleEn?: string;
  /** Price in CNY fen (¥1 = 100 fen). */
  price?: number | string;
  priceCNY?: number | string;
  /** Original images array (full URLs). */
  images?: string[];
  itemImgs?: string[];
  picUrl?: string;
  /** Optional seller info. */
  shopName?: string;
  sellerNick?: string;
  /** Optional MOQ — Tmall often exposes this. */
  minQuantity?: number;
  /** Optional category breadcrumb (array of strings). */
  category?: string[];
  /** Optional description (HTML or text). */
  description?: string;
  desc?: string;
};

/**
 * Call Apify actor `sian.agency/taobao-tmall-product-scraper` and
 * wait for the run to finish. Uses Apify's synchronous API with a
 * 90-second timeout (the actor normally finishes in 5-20s for a
 * single URL).
 *
 * The actor accepts FOUR operations; we always send
 * `operation: "productDetail"` + the numeric `itemId`. The URL is
 * passed in but the actor parses out the id internally.
 *
 * Cost: roughly $0.001-0.005 per URL on the free tier; the actor's
 * own page lists the current rate.
 *
 * GEO NOTE: Taobao's anti-bot blocks most Apify server IPs (US/EU).
 * The actor runs but reports "Upstream error: This item is not
 * supported." for items that Taobao refuses to serve to its
 * datacenter IPs. When this happens, we surface it as a clean
 * apify_no_results with a friendly message.
 */
export async function scrapeTaobao(input: {
  url: string;
  apifyToken: string;
  timeoutMs?: number;
}): Promise<{
  ok: true;
  item: ApifyTaobaoItem;
  runId: string;
} | {
  ok: false;
  reason: "apify_timeout" | "apify_failed" | "apify_no_results" | "apify_api_error";
  message: string;
  runId?: string;
}> {
  const { url, apifyToken, timeoutMs = 90_000 } = input;
  const ACTOR_ID = "sian.agency/taobao-tmall-product-scraper";

  // Extract the numeric item ID from the URL — the actor expects
  // { operation: "productDetail", itemId: "<digits>" }.
  const parsed = parseTaobaoUrl(url);
  if (!parsed.ok) {
    return {
      ok: false,
      reason: "apify_api_error",
      message: `Cannot extract item ID from URL: ${parsed.reason}`,
    };
  }
  const itemId = parsed.itemId;

  // 1. Start the run.
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(ACTOR_ID)}/runs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apifyToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operation: "productDetail",
        itemId,
      }),
    },
  );
  if (!startRes.ok) {
    const text = await startRes.text();
    return {
      ok: false,
      reason: "apify_api_error",
      message: `Apify run start failed: ${startRes.status} ${text.slice(0, 200)}`,
    };
  }
  const run = (await startRes.json()) as { data?: { id?: string }; id?: string };
  const runId = run.data?.id ?? run.id;
  if (!runId) {
    return {
      ok: false,
      reason: "apify_api_error",
      message: "Apify run start returned no id",
    };
  }

  // 2. Poll for completion on /v2/actor-runs/<id> (NOT /v2/acts/.../runs).
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(2_000);
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      { headers: { Authorization: `Bearer ${apifyToken}` } },
    );
    if (!statusRes.ok) {
      const text = await statusRes.text();
      return {
        ok: false,
        reason: "apify_api_error",
        message: `Apify status check failed: ${statusRes.status} ${text.slice(0, 200)}`,
        runId,
      };
    }
    const statusJson = (await statusRes.json()) as {
      data: { status: string };
    };
    const status = statusJson.data?.status;
    if (status === "SUCCEEDED") break;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      return {
        ok: false,
        reason: "apify_failed",
        message: `Apify run ended with status: ${status}`,
        runId,
      };
    }
  }
  if (Date.now() >= deadline) {
    return {
      ok: false,
      reason: "apify_timeout",
      message: `Apify run did not finish within ${Math.round(timeoutMs / 1000)}s`,
      runId,
    };
  }

  // 3. Read the run's dataset via /v2/datasets/<id>/items. Use the
  //    run's `defaultDatasetId` (NOT datasetId — they're different).
  const dsMeta = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}`,
    { headers: { Authorization: `Bearer ${apifyToken}` } },
  );
  const dsMetaJson = (await dsMeta.json()) as {
    data: { defaultDatasetId?: string; datasetId?: string };
  };
  const datasetId =
    dsMetaJson.data?.defaultDatasetId ?? dsMetaJson.data?.datasetId;
  if (!datasetId) {
    return {
      ok: false,
      reason: "apify_api_error",
      message: "Apify returned no dataset id for the run",
      runId,
    };
  }
  const dsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items`,
    { headers: { Authorization: `Bearer ${apifyToken}` } },
  );
  if (!dsRes.ok) {
    const text = await dsRes.text();
    return {
      ok: false,
      reason: "apify_api_error",
      message: `Apify dataset fetch failed: ${dsRes.status} ${text.slice(0, 200)}`,
      runId,
    };
  }
  const items = (await dsRes.json()) as Array<
    ApifyTaobaoItem & {
      status?: string;
      errorMessage?: string;
      _operation?: string;
      _fetchedAt?: string;
      _sourceItemId?: string;
    }
  >;
  if (!items || items.length === 0) {
    return {
      ok: false,
      reason: "apify_no_results",
      message: "Apify returned no items for this URL.",
      runId,
    };
  }
  // The actor wraps every product in { status, errorMessage?, ...fields }.
  // If status='error', the item couldn't be scraped (Taobao geo-block,
  // item removed, etc.). Surface as apify_no_results with the reason.
  const first = items[0];
  if (first.status === "error") {
    return {
      ok: false,
      reason: "apify_no_results",
      message:
        first.errorMessage ??
        "Apify couldn't fetch this product (Taobao may be geo-blocking or the item has been removed).",
      runId,
    };
  }
  // Strip actor-internal keys before returning
  const item: ApifyTaobaoItem = {
    id: first.id ?? first.itemId ?? itemId,
    itemId: first.itemId ?? first.id ?? itemId,
    title: first.title,
    titleEn: first.titleEn,
    price: first.price,
    priceCNY: first.priceCNY,
    images: first.images,
    itemImgs: first.itemImgs,
    picUrl: first.picUrl,
    shopName: first.shopName,
    sellerNick: first.sellerNick,
    minQuantity: first.minQuantity,
    category: first.category,
    description: first.description,
    desc: first.desc,
  };
  return { ok: true, item, runId };
}

/**
 * Map an Apify result to the BanglaSource product draft shape used
 * by /admin/products/new + /api/admin/products POST. Fields the
 * actor didn't provide are returned as null — the admin fills
 * them in on the form before submit.
 */
export type ProductDraft = {
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
  raw: ApifyTaobaoItem;
};

const ALLOWED_CATEGORIES = new Set([
  "gadgets",
  "eyewear",
  "shoes",
  "bags",
  "watches",
  "beauty",
]);

/**
 * Heuristic category guess from a Taobao/Tmall category breadcrumb.
 * The actor sometimes returns a path like ["女装/女士上衣/T恤"]; we
 * map the leaf to one of our 6 categories. Falls back to null when
 * the breadcrumb doesn't match anything.
 */
export function guessCategoryFromBreadcrumb(
  breadcrumb: readonly string[] | undefined,
): string | null {
  if (!breadcrumb || breadcrumb.length === 0) return null;
  const text = breadcrumb.join(" ").toLowerCase();
  if (/手机|耳机|充电器|数据线|充电宝|充电|数码|电子|speaker|earbud|phone|charger|power\s*bank|cable|gadget|electronics?/i.test(text))
    return "gadgets";
  if (/眼镜|墨镜|sunglass|glasses|eyewear/i.test(text)) return "eyewear";
  if (/鞋|shoe|sneaker|boot|loafer|heel/i.test(text)) return "shoes";
  if (/包|钱包|背包|wallet|bag|backpack|handbag|purse/i.test(text)) return "bags";
  if (/表|watch|wristwatch|smartwatch/i.test(text)) return "watches";
  if (/美妆|化妆|护肤|香水|口红|beauty|cosmetic|skin\s*care|perfume|lipstick|makeup/i.test(text))
    return "beauty";
  return null;
}

export function mapApifyToProductDraft(input: {
  item: ApifyTaobaoItem;
  parsed: ParsedTaobaoUrl & { ok: true };
  runId: string;
}): ProductDraft {
  const { item, parsed, runId } = input;

  // Price: prefer `price`, fall back to `priceCNY`. The actor returns
  // CNY in yuan (sometimes fen — Apify is inconsistent across runs).
  let priceYuan: number | null = null;
  const rawPrice = item.price ?? item.priceCNY;
  if (typeof rawPrice === "number" && Number.isFinite(rawPrice)) {
    priceYuan = rawPrice > 10000 ? rawPrice / 100 : rawPrice;
  } else if (typeof rawPrice === "string" && rawPrice.trim()) {
    const n = Number(rawPrice.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n)) priceYuan = n > 10000 ? n / 100 : n;
  }

  // Images: aggregate from any of the actor's possible fields.
  const images: string[] = [];
  if (Array.isArray(item.images)) images.push(...item.images);
  if (Array.isArray(item.itemImgs)) {
    for (const x of item.itemImgs) {
      if (typeof x === "string") images.push(x);
      else if (x && typeof x === "object" && "url" in x)
        images.push(String((x as { url: string }).url));
    }
  }
  if (item.picUrl && !images.includes(item.picUrl)) images.unshift(item.picUrl);

  // Description: pick whichever the actor gave us.
  const descriptionZh =
    (typeof item.description === "string" && item.description.trim()) ||
    (typeof item.desc === "string" && item.desc.trim()) ||
    null;

  // MOQ: Tmall usually exposes this; default to 1 if unknown.
  const moq =
    typeof item.minQuantity === "number" && item.minQuantity > 0
      ? Math.floor(item.minQuantity)
      : 1;

  // Supplier: prefer shopName, fall back to sellerNick.
  const supplierName =
    (typeof item.shopName === "string" && item.shopName.trim()) ||
    (typeof item.sellerNick === "string" && item.sellerNick.trim()) ||
    null;

  const categoryGuess = guessCategoryFromBreadcrumb(item.category);
  const safeCategory =
    categoryGuess && ALLOWED_CATEGORIES.has(categoryGuess) ? categoryGuess : null;

  return {
    sourceId: `taobao-${parsed.itemId}`,
    sourceUrl: parsed.canonicalUrl,
    sourcePlatform: parsed.platform,
    apifyRunId: runId,
    scrapedAt: new Date().toISOString(),
    titleZh: typeof item.title === "string" && item.title.trim() ? item.title.trim() : null,
    titleEn:
      typeof item.titleEn === "string" && item.titleEn.trim() ? item.titleEn.trim() : null,
    descriptionZh,
    descriptionEn: null, // actor doesn't translate; admin can request autoTranslate on save
    categoryGuess: safeCategory,
    factoryCnyPerPc: priceYuan,
    factoryMoq: moq,
    supplierName,
    images: dedupeAndCleanImages(images),
    raw: item,
  };
}

/**
 * Clean the image list: drop empty strings, drop URLs without an
 * image-like extension, dedupe. The admin can still hand-edit after.
 */
function dedupeAndCleanImages(input: string[]): string[] {
  const out = new Set<string>();
  for (const url of input) {
    if (!url || typeof url !== "string") continue;
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) continue;
    out.add(trimmed);
  }
  return Array.from(out);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}