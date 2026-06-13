// POST /api/admin/products/[id]/images
//
// Two endpoints in one file (Next.js 16 has `params: Promise<…>`):
//
//   POST   → returns a Supabase Storage signed-upload URL. The browser
//            then PUTs the file directly to that URL. Once the upload
//            succeeds, the browser calls PATCH /api/admin/products/[id]
//            with the new public URL appended to images[].
//
//   DELETE → removes an image from a product's images[] list AND
//            deletes the underlying Storage object (best effort).
//
// Auth: admin only.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/portal-auth";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function safeFilename(name: string): string {
  // Strip path, keep ascii + ascii-extended, lower, dash-separated
  return name
    .replace(/^.*\//, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase()
    .slice(0, 80) || "image";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status },
    );
  }

  const { id: idStr } = await params;
  const productId = Number.parseInt(idStr, 10);
  if (!Number.isFinite(productId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_id" },
      { status: 400 },
    );
  }

  let body: { filename?: string; contentType?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const filename = safeFilename(body.filename ?? "image.jpg");
  const contentType = body.contentType ?? "image/jpeg";
  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json(
      { ok: false, error: "unsupported_mime" },
      { status: 400 },
    );
  }

  // Path: product-images/<productId>/<timestamp>-<filename>
  const objectKey = `${productId}/${Date.now()}-${filename}`;

  const supabase = getServiceRoleClient();

  // createSignedUploadUrl gives us a URL valid for 60s that the
  // browser can PUT the file to. The file lands in the bucket and
  // is publicly readable (bucket is public).
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(objectKey);

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "signed_url_failed" },
      { status: 500 },
    );
  }

  // The public URL (read) for after the upload completes
  const { data: pub } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(objectKey);

  return NextResponse.json({
    ok: true,
    uploadUrl: data.signedUrl,
    token: data.token,
    publicUrl: pub.publicUrl,
    objectKey,
    maxBytes: MAX_BYTES,
    expiresIn: 60,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi(req);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status },
    );
  }

  const { id: idStr } = await params;
  const productId = Number.parseInt(idStr, 10);
  if (!Number.isFinite(productId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_id" },
      { status: 400 },
    );
  }

  let body: { objectKey?: string; publicUrl?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  // Resolve the storage key. We accept either the raw object key
  // ("123/1234-foo.jpg") or the full public URL.
  let objectKey = body.objectKey ?? "";
  if (!objectKey && body.publicUrl) {
    try {
      const u = new URL(body.publicUrl);
      // Path looks like: /storage/v1/object/public/product-images/123/...
      const m = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)$/);
      if (m) objectKey = m[1];
    } catch {
      // fall through to invalid
    }
  }
  if (!objectKey) {
    return NextResponse.json(
      { ok: false, error: "objectKey_or_publicUrl_required" },
      { status: 400 },
    );
  }

  const supabase = getServiceRoleClient();

  // 1) Remove from the product's images[] array (only if it was there)
  const { data: prod, error: readErr } = await supabase
    .from("products")
    .select("images")
    .eq("id", productId)
    .single();
  if (readErr || !prod) {
    return NextResponse.json(
      { ok: false, error: readErr?.message ?? "not_found" },
      { status: readErr ? 500 : 404 },
    );
  }
  const beforeCount = (prod.images ?? []).length;
  const filtered = (prod.images ?? []).filter(
    (u: string) => !u.includes(objectKey),
  );
  if (filtered.length === beforeCount) {
    // Not present in the product's image list — still try to delete
    // the storage object (best effort).
  } else {
    const { error: updErr } = await supabase
      .from("products")
      .update({ images: filtered })
      .eq("id", productId);
    if (updErr) {
      return NextResponse.json(
        { ok: false, error: updErr.message },
        { status: 500 },
      );
    }
  }

  // 2) Delete the storage object. Don't fail the request if it errors —
  // the file might already be gone.
  await supabase.storage.from(BUCKET).remove([objectKey]);

  // 3) Invalidate cache
  revalidatePath("/");
  revalidatePath("/categories");

  return NextResponse.json({
    ok: true,
    removedFromProduct: beforeCount - filtered.length,
    objectKey,
  });
}
