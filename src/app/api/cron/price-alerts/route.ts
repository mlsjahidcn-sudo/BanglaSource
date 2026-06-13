// POST /api/cron/price-alerts
//
// Scans price_history for tier rows whose change_pct exceeds the
// threshold (default ±15%) in the last 24h, writes one row per
// detection to price_alert_log (deduped by product + tier + 24h
// window), and fans out in-app notifications to all watchlist
// users with `notify_on_drop = true`.
//
// What changed in Phase 8:
//   - After inserting price_alert_log rows, look up the inserted
//     ids and find all watchlist users for those products where
//     notify_on_drop = true.
//   - Insert one `notifications` row per (user, alert). UNIQUE
//     (user_id, related_alert_id) means re-running the cron is
//     safe; ON CONFLICT DO NOTHING silently drops the dup.
//   - "Send" emails — for now, log to console + emit a payload the
//     cron response can surface. Real Resend/Postmark can be added
//     later (one file, /lib/email.ts) without changing this loop.
//
// Auth: x-cron-secret header.

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const ALERT_THRESHOLD_PCT = 15;

type PriceHistoryRow = {
  id: number;
  product_id: number;
  source_id: string;
  qty_min: number;
  qty_max: number | null;
  old_price_cny_fen: number;
  new_price_cny_fen: number;
  change_pct: number;
  recorded_at: string;
};

type AlertRecord = {
  product_id: number;
  source_id: string;
  qty_min: number;
  qty_max: number | null;
  old_price_cny_fen: number;
  new_price_cny_fen: number;
  change_pct: number;
  direction: "rise" | "drop";
};

export async function POST(req: NextRequest) {
  // Auth
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not set" },
      { status: 500 },
    );
  }
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return NextResponse.json(
      { ok: false, error: "Invalid x-cron-secret" },
      { status: 401 },
    );
  }

  const rl = rateLimit({
    key: `cron.price-alerts:${clientKey(req)}`,
    capacity: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const supabase = getServiceRoleClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Big moves in the last 24h. We want |change_pct| >= threshold,
  // which is `change_pct >= 15 OR change_pct <= -15`. PostgREST's
  // filter string for that is one comma-separated OR; we can't
  // combine with .gte and .lte on the same column at the same level
  // (they would be ANDed). Use a single .or() call.
  const { data: moves, error: mErr } = await supabase
    .from("price_history")
    .select(
      "id,product_id,source_id,qty_min,qty_max,old_price_cny_fen,new_price_cny_fen,change_pct,recorded_at",
    )
    .gte("recorded_at", since)
    .or(`change_pct.gte.${ALERT_THRESHOLD_PCT},change_pct.lte.${-ALERT_THRESHOLD_PCT}`)
    .order("recorded_at", { ascending: false })
    .limit(200);
  if (mErr) {
    return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });
  }
  const rows = (moves ?? []) as PriceHistoryRow[];

  // Dedupe against existing recent alerts: a (product, qty_min, qty_max)
  // combination is "already alerted" if there's a price_alert_log row
  // for it in the last 24h.
  const candidateKeys = new Set(
    rows.map((r) => `${r.product_id}:${r.qty_min}:${r.qty_max ?? "open"}`),
  );
  const keysArr = Array.from(candidateKeys);
  const existingKeys = new Set<string>();
  if (keysArr.length > 0) {
    for (const k of keysArr) {
      const [pid, qmin, qmax] = k.split(":");
      // Build the filter chain WITHOUT awaiting each step
      const baseQ = supabase
        .from("price_alert_log")
        .select("id")
        .eq("product_id", parseInt(pid, 10))
        .eq("qty_min", parseInt(qmin, 10));
      const filtered =
        qmax === "open"
          ? baseQ.is("qty_max", null)
          : baseQ.eq("qty_max", parseInt(qmax, 10));
      const { data } = await filtered
        .gte("detected_at", since)
        .limit(1);
      if (data && data.length > 0) {
        existingKeys.add(k);
      }
    }
  }

  const toAlert: AlertRecord[] = [];
  for (const r of rows) {
    const key = `${r.product_id}:${r.qty_min}:${r.qty_max ?? "open"}`;
    if (existingKeys.has(key)) continue;
    toAlert.push({
      product_id: r.product_id,
      source_id: r.source_id,
      qty_min: r.qty_min,
      qty_max: r.qty_max,
      old_price_cny_fen: r.old_price_cny_fen,
      new_price_cny_fen: r.new_price_cny_fen,
      change_pct: r.change_pct,
      direction: r.change_pct > 0 ? "rise" : "drop",
    });
  }

  // Insert alert rows. We insert one row per detection; the unique
  // dedup index on (product_id, qty_min, qty_max, detected_at) catches
  // exact collisions. Window collisions we already filtered above.
  let insertedAlertIds: number[] = [];
  if (toAlert.length > 0) {
    const now = new Date().toISOString();
    const { data: insData, error: insErr } = await supabase
      .from("price_alert_log")
      .insert(
        toAlert.map((a) => ({
          product_id: a.product_id,
          source_id: a.source_id,
          qty_min: a.qty_min,
          qty_max: a.qty_max,
          old_price_cny_fen: a.old_price_cny_fen,
          new_price_cny_fen: a.new_price_cny_fen,
          change_pct: a.change_pct,
          direction: a.direction,
          detected_at: now,
        })),
      )
      .select("id");
    if (insErr) {
      // Non-fatal — log and continue
      console.error("[price-alerts] insert failed:", insErr.message);
    } else {
      insertedAlertIds = (insData ?? []).map((r) => r.id);
    }
  }

  // ─── Phase 8: fan out to watchlist users ───
  // For each newly-inserted alert, find all watchlist users with
  // notify_on_drop = true and create a notification per (user, alert).
  // Drops only — rises are noise for buyers.
  let notificationsCreated = 0;
  let emailsQueued = 0;
  if (insertedAlertIds.length > 0) {
    const drops = toAlert.filter(
      (a) => a.direction === "drop" && insertedAlertIds[toAlert.indexOf(a)] !== undefined,
    );
    if (drops.length > 0) {
      // Build the join: for each drop, get user_ids with notify_on_drop=true
      const dropProductIds = Array.from(new Set(drops.map((d) => d.product_id)));
      const { data: watchers, error: wErr } = await supabase
        .from("watchlist")
        .select("user_id, product_id")
        .eq("notify_on_drop", true)
        .in("product_id", dropProductIds);
      if (wErr) {
        console.error("[price-alerts] watchlist fan-out query failed:", wErr.message);
      } else {
        // Index watchers by product_id
        const watchersByProduct = new Map<number, string[]>();
        for (const w of watchers ?? []) {
          const arr = watchersByProduct.get(w.product_id) ?? [];
          arr.push(w.user_id);
          watchersByProduct.set(w.product_id, arr);
        }

        const FX = 16.85;
        const rows: Array<{
          user_id: string;
          kind: string;
          title: string;
          body: string | null;
          href: string;
          related_alert_id: number;
          related_product_id: number;
        }> = [];
        const emailPayloads: Array<{
          to: string;
          subject: string;
          body: string;
          source_id: string;
        }> = [];
        for (let i = 0; i < toAlert.length; i += 1) {
          const a = toAlert[i];
          if (a.direction !== "drop") continue;
          const aid = insertedAlertIds[i];
          if (aid === undefined) continue;
          const users = watchersByProduct.get(a.product_id) ?? [];
          if (users.length === 0) continue;
          const oldBdt = Math.ceil((a.old_price_cny_fen / 100) * FX);
          const newBdt = Math.ceil((a.new_price_cny_fen / 100) * FX);
          const pct = Math.abs(a.change_pct).toFixed(0);
          for (const uid of users) {
            rows.push({
              user_id: uid,
              kind: "price_drop",
              title: `Price dropped ${pct}% — source ${a.source_id}`,
              body:
                `Tier ${a.qty_min}${a.qty_max ? "–" + a.qty_max : "+"} pcs: ` +
                `৳${oldBdt.toLocaleString()} → ৳${newBdt.toLocaleString()} (-${pct}%)`,
              href: `/products/${a.source_id}`,
              related_alert_id: aid,
              related_product_id: a.product_id,
            });
          }
        }
        if (rows.length > 0) {
          const { data: ins, error: nErr } = await supabase
            .from("notifications")
            .insert(rows, { ignoreDuplicates: true })
            .select("id, user_id, related_alert_id");
          if (nErr) {
            console.error("[price-alerts] notifications insert failed:", nErr.message);
          } else {
            notificationsCreated = ins?.length ?? 0;
            // Look up emails for those users (only need to send for
            // users we successfully notified). Profiles table has email.
            const userIds = Array.from(new Set((ins ?? []).map((r) => r.user_id)));
            const { data: profiles, error: pErr } = await supabase
              .from("profiles")
              .select("id, email, full_name")
              .in("id", userIds);
            if (!pErr && profiles) {
              const emailByUser = new Map(
                profiles.map((p) => [p.id, p.email ?? null] as const),
              );
              for (const n of ins ?? []) {
                const email = emailByUser.get(n.user_id);
                if (!email) continue;
                const row = rows.find(
                  (r) => r.user_id === n.user_id && r.related_alert_id === n.related_alert_id,
                );
                if (!row) continue;
                emailPayloads.push({
                  to: email,
                  subject: row.title,
                  body: row.body ?? "",
                  source_id: row.href.replace("/products/", ""),
                });
              }
            }
            emailsQueued = emailPayloads.length;
            // In dev, log would-send emails. In prod, this is where
            // Resend/Postmark would go.
            if (process.env.NODE_ENV !== "production") {
              for (const e of emailPayloads) {
                // eslint-disable-next-line no-console
                console.log(
                  `[price-alerts] would-send → ${e.to}: ${e.subject}`,
                );
              }
            }
          }
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    threshold_pct: ALERT_THRESHOLD_PCT,
    window_hours: 24,
    moves_found: rows.length,
    alerts_deduplicated: rows.length - toAlert.length,
    alerts_created: insertedAlertIds.length,
    notifications_created: notificationsCreated,
    emails_queued: emailsQueued,
    alerts: toAlert,
  });
}
