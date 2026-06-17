// POST /api/cron/group-buys/form
//
// Phase 40 (formation cron). Invoked every minute via the project's
// scheduled cron (see `vercel.json` / Railway cron / external
// pinger). For every `status='open'` group buy whose SUM(qty) has
// reached `target_qty`: atomically claim it, freeze final_unit_bdt,
// create one order per member via the existing `create_order_with_items`
// RPC, mark members as charged, then flip status to 'formed'.
//
// Auth: `x-cron-secret` header must match `process.env.CRON_SECRET`.
//
// Race safety: the per-group UPDATE-WHERE-status='open' is the
// atomic claim. Two concurrent cron invocations can't both create
// duplicate orders. The /lib/group-buy-cron.ts doc-comment explains
// the full state machine.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { runFormationPass } from "@/lib/group-buy-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 1-min cron, allow up to 60s

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  // ── Rate limit (per IP)
  const rl = rateLimit({
    key: `cron.group-buy.form:${clientKey(req)}`,
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
  const result = await runFormationPass(sb);

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    ...result,
  });
}