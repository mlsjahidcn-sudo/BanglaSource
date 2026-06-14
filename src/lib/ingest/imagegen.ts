// Thin OpenAI-compatible client for the apinebula.com proxy
// that exposes GPT Image 2 (and Image 2 Pro) for product
// image generation.
//
// Usage notes:
//   - The proxy URL is https://apinebula.com/v1 (OpenAI-compatible).
//   - Model name on apinebula is "gpt-image-2-vip" (and
//     "gpt-image-2-pro" is also available). The literal
//     "gpt-image-2" 503s on the proxy.
//   - images.generate: text-only, returns b64_json.
//   - images.edit: takes one or more reference images as
//     `File` objects (the proxy doesn't accept URLs); returns
//     b64_json.
//   - n is effectively capped at 1 per call — we call in
//     parallel via Promise.all for n>1.
//   - Returns PNG, 1024x1024 by default. We store the bytes
//     directly in the Supabase product-images bucket.
//
// Phase 15b: the "image agent" called out by the user after
// Phase 15a ("later we will use image 2 to create image for
// our website"). The agent takes a Pinduoduo / Taobao
// product image, strips the watermark / price-tag / model
// text, and emits a clean studio shot for the BanglaSource
// PDP / cart / category grid.

import "server-only";
import OpenAI from "openai";

const DEFAULT_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2-vip";
const DEFAULT_SIZE = "1024x1024";

export type ImageGenOptions = {
  /** Free-form prompt describing the desired product shot. */
  prompt: string;
  /**
   * Optional reference image URLs to anchor the style /
   * subject. The proxy's images.edit endpoint takes `File`
   * uploads (NOT URLs) so we download these on the server
   * first, then pass as Files.
   */
  referenceImageUrls?: string[];
  /**
   * Number of images to generate. The apinebula proxy caps
   * each call at 1, so this triggers parallel calls.
   * Default 1. Capped at 4 to keep the request cheap.
   */
  n?: number;
  /** Square 1024x1024 (default), landscape 1536x1024, or
   *  portrait 1024x1536. */
  size?: "1024x1024" | "1536x1024" | "1024x1536" | "1024x1536";
  /**
   * Override the model (default OPENAI_IMAGE_MODEL env or
   * "gpt-image-2-vip"). Use "gpt-image-2-pro" for higher
   * fidelity at higher cost.
   */
  model?: string;
  /**
   * Download timeout per reference image. The default 30s is
   * generous because Pinduoduo / Taobao CDN can be slow.
   */
  refDownloadTimeoutMs?: number;
};

export type GeneratedImage = {
  index: number;
  /** Raw PNG bytes. */
  buffer: Buffer;
  mime: "image/png";
  /** A short prompt-derived tag we use to namespace the file
   *  in the storage bucket (e.g. "studio-shot-1"). */
  slug: string;
};

function requireEnv(): { apiKey: string; baseURL: string } {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL ?? "https://apinebula.com/v1";
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local.",
    );
  }
  return { apiKey, baseURL };
}

function getClient() {
  const { apiKey, baseURL } = requireEnv();
  return new OpenAI({ apiKey, baseURL });
}

/**
 * Download a remote image into a Buffer. We don't trust the
 * remote's content-length, so we cap at 10MB to keep the
 * upload payload sane for GPT Image 2.
 */
async function downloadToFile(
  url: string,
  timeoutMs: number,
): Promise<File> {
  const res = await fetch(url, {
    redirect: "follow",
    // AbortSignal.timeout is supported on Node 18+ and modern TS lib
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(
      `ref_download_failed ${res.status} for ${url.slice(0, 80)}`,
    );
  }
  const ct = (res.headers.get("content-type") ?? "image/jpeg")
    .toLowerCase()
    .split(";")[0]
    .trim();
  if (
    ct !== "image/jpeg" &&
    ct !== "image/png" &&
    ct !== "image/webp"
  ) {
    throw new Error(`ref_unsupported_mime ${ct} for ${url.slice(0, 80)}`);
  }
  const ab = await res.arrayBuffer();
  if (ab.byteLength > 10 * 1024 * 1024) {
    throw new Error(`ref_too_large ${ab.byteLength} for ${url.slice(0, 80)}`);
  }
  const ext =
    ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";
  // Node 18+ has a global `File` (BufferSource-backed). We
  // pass the underlying ArrayBuffer so the multipart uploader
  // doesn't double-copy.
  return new File([ab], `ref.${ext}`, { type: ct });
}

function safeSlug(s: string): string {
  return (
    s
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .toLowerCase()
      .slice(0, 40) || "image"
  );
}

/**
 * Generate `n` product images. If `referenceImageUrls` is
 * provided, uses images.edit (image-to-image) to anchor the
 * style / subject; otherwise uses images.generate (text-to-
 * image). All calls are made in parallel when n>1.
 *
 * Returns the generated PNG buffers + a slug for each. The
 * caller is responsible for uploading them to Supabase
 * storage and appending to the product's images[].
 */
export async function generateProductImages(
  options: ImageGenOptions,
): Promise<GeneratedImage[]> {
  const n = Math.min(Math.max(options.n ?? 1, 1), 4);
  const model = options.model ?? DEFAULT_MODEL;
  const size = options.size ?? DEFAULT_SIZE;
  const refUrls = (options.referenceImageUrls ?? []).slice(0, 4); // cap refs at 4

  const client = getClient();

  // Download reference images once (shared across parallel calls).
  let refFiles: File[] = [];
  if (refUrls.length > 0) {
    refFiles = await Promise.all(
      refUrls.map((u) =>
        downloadToFile(u, options.refDownloadTimeoutMs ?? 30_000),
      ),
    );
  }

  const tag = safeSlug(
    options.prompt
      .replace(/["'\n]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 4)
      .join("-"),
  );

  const calls = Array.from({ length: n }, () => {
    if (refFiles.length > 0) {
      // image-to-image. We pass the SAME reference set to
      // every parallel call (the model samples a different
      // variation from the same anchor).
      return (client.images.edit as any)({
        model,
        image: refFiles.length === 1 ? refFiles[0] : refFiles,
        prompt: options.prompt,
        size,
        n: 1,
        response_format: "b64_json",
      });
    }
    return (client.images.generate as any)({
      model,
      prompt: options.prompt,
      size,
      n: 1,
      response_format: "b64_json",
    });
  });

  const responses = await Promise.all(calls);
  const out: GeneratedImage[] = [];
  for (let i = 0; i < responses.length; i++) {
    const item = (responses[i] as { data?: Array<{ b64_json?: string }> })
      .data?.[0];
    const b64 = item?.b64_json;
    if (!b64) {
      throw new Error(
        `apify_nebula_no_b64 in response ${i} (model=${model})`,
      );
    }
    out.push({
      index: i,
      buffer: Buffer.from(b64, "base64"),
      mime: "image/png",
      slug: `${tag}-${i + 1}`,
    });
  }
  return out;
}
