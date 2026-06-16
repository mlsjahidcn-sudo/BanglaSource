// GET /api/catalog
// Returns the full public catalog. Used by client components to render
// category pages, the home page strips, and the cart line items.
//
// Cached at the Supabase layer (getCatalog) and revalidated every 60s.
// Each client page can also cache via SWR/route-cache — the data is
// small and stable.

import { NextResponse } from "next/server";
import { getCatalog, dbProductToLegacy } from "@/lib/catalog";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

const RATE_LIMIT = 200;
const RATE_WINDOW_MS = 60_000;

export async function GET(req: NextRequest) {
  const rl = rateLimit({
    key: `catalog:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const products = await getCatalog();
  return NextResponse.json(
    { ok: true, total: products.length, products },
    {
      headers: {
        // Allow the browser to cache for 30s. The server (Next cache) has
        // a 60s revalidate. Together: changes propagate within 60s.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
