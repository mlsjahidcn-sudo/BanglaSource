// POST /api/cron/group-buys/expire
//
// Phase 40 (expire cron). Invoked every 5 minutes. Finds every
// `status='open'` group whose deadline has passed, atomically
// flips it to 'expired', and notifies every member that no charge
// happened.
//
// Auth: `x-cron-secret` header must match `process.env.CRON_SECRET`.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { runExpirePass } from "@/lib/group-buy-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  // ── Rate limit (per IP)
  const rl = rateLimit({
    key: `cron.group-buy.expire:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        resetIn: rl.resetIn,
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) },
      },
    );
  }

  // ── Auth
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not set" },
      { status: 500 },
    );
  }
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const sb = getServiceRoleClient();
  const startedAt = new Date().toISOString();
  const result = await runExpirePass(sb);

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...result,
  });
}