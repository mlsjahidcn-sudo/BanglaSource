// /lib/group-buy-cron.ts
//
// Phase 40 core logic — the formation cron (`/api/cron/group-buys/form`)
// and the expire cron (`/api/cron/group-buys/expire`) both delegate
// to pure functions in this module so they can be unit-tested
// without HTTP plumbing.
//
// State machine the cron drives:
//
//   open → forming → formed (target hit, orders created)
//   open → expired  (deadline passed, no charge)
//
// Race-safety: the formation cron uses an atomic UPDATE-WHERE-status='open'
// to claim a group. Two concurrent cron runs CAN'T both claim — the
// second one's UPDATE returns 0 rows and the function bails. This
// avoids duplicate orders.
//
// Buyer-fairness: each member is charged at
//   MIN(unit_bdt_at_commit, final_unit_bdt)
// — never more than what they saw at commit time, possibly less if
// the group crossed a deeper tier after they joined. The final
// `final_unit_bdt` is frozen at formation and shared across all
// members, but the per-member charge respects their snapshot.

import "server-only";
import { getServiceRoleClient } from "@/lib/supabase/server";
import {
  groupBuyPriceAtQty,
  groupBuyOrderCost,
  type GroupBuyPriceTier,
} from "@/lib/pricing";

// Use a loose typed handle for the RPC so we don't have to enumerate
// every field; the Database["public"]["Functions"]["create_order_with_items"]
// generic is the source of truth in production, but at this layer
// we want flexibility for the order_items payload.
type SupabaseLike = ReturnType<typeof getServiceRoleClient>;

/**
 * Create an order for a single member. Used by both the formation
 * cron (runFormationPass) and the admin retry endpoint
 * (POST /api/admin/group-buys/[id]/members/[memberId]/retry).
 *
 * Returns the new order_id on success, or an error message.
 * On any failure: marks payment_state='failed' and emails the
 * buyer with the reason.
 */
export async function createOrderForMember(
  sb: SupabaseLike,
  args: {
    group: {
      id: string;
      product_id: number;
      final_unit_bdt: number;
    };
    member: {
      id: string;
      user_id: string;
      qty: number;
      unit_bdt_at_commit: number;
      shipping_mode: string;
    };
    product: {
      title_en: string;
      images: string[] | null;
      category: string;
      weight_kg: number;
      volume_cbm: number;
      customs_duty_per_kg: number;
    };
  },
): Promise<{ ok: true; orderId: number } | { ok: false; reason: string }> {
  const chargedUnitBdt = Math.min(
    args.member.unit_bdt_at_commit,
    args.group.final_unit_bdt,
  );
  const cost = groupBuyOrderCost({
    unit_bdt: chargedUnitBdt,
    qty: args.member.qty,
    weight_per_piece_kg: args.product.weight_kg,
    volume_per_piece_cbm: args.product.volume_cbm,
    customs_duty_per_kg: args.product.customs_duty_per_kg,
  });

  const { data: addr } = await sb
    .from("addresses")
    .select("id, label, full_name, phone, country, district, address_line")
    .eq("user_id", args.member.user_id)
    .eq("is_default", true)
    .maybeSingle();

  if (!addr) {
    await sb
      .from("group_buy_members")
      .update({ payment_state: "failed" })
      .eq("id", args.member.id);
    void import("@/lib/email")
      .then(({ notifyGroupBuyFailed }) =>
        notifyGroupBuyFailed(args.member.id, args.group.id, "no_default_address").catch(
          () => undefined,
        ),
      )
      .catch(() => undefined);
    return { ok: false, reason: "no_default_address" };
  }

  const addressSnapshot = {
    label: addr.label,
    full_name: addr.full_name,
    phone: addr.phone,
    country: addr.country,
    district: addr.district,
    address_line: addr.address_line,
  };

  const rpcArgs = {
    p_user_id: args.member.user_id,
    p_shipping_mode: (args.member.shipping_mode as "air" | "sea" | "express") ?? "air",
    p_payment_method: "bkash",
    p_product_subtotal_bdt: cost.product_subtotal_bdt,
    p_shipping_bdt: cost.shipping_bdt,
    p_duty_bdt: cost.duty_bdt,
    p_vat_bdt: cost.vat_bdt,
    p_ait_bdt: cost.ait_bdt,
    p_total_bdt: cost.total_bdt,
    p_deposit_bdt: cost.deposit_bdt,
    p_balance_bdt: cost.balance_bdt,
    p_address_id: addr.id,
    p_address_snapshot: addressSnapshot,
    p_buyer_note: `Group buy ${args.group.id}`,
    p_items: [
      {
        product_id: args.group.product_id,
        qty: args.member.qty,
        title_snapshot: args.product.title_en,
        image_snapshot: args.product.images?.[0] ?? null,
        unit_cny_fen: 0,
        fx_cny_to_bdt: 16.85,
        markup_pct: 0,
        weight_kg: args.product.weight_kg,
        volume_cbm: args.product.volume_cbm,
        category: args.product.category,
        customs_duty_per_kg: args.product.customs_duty_per_kg,
        unit_bdt: chargedUnitBdt,
        line_bdt: cost.product_subtotal_bdt,
        line_duty_bdt: cost.duty_bdt,
        position: 0,
      },
    ],
  };

  const { data: orderId, error: rpcErr } = await sb.rpc(
    "create_order_with_items",
    rpcArgs as never,
  );
  if (rpcErr || !orderId) {
    await sb
      .from("group_buy_members")
      .update({ payment_state: "failed" })
      .eq("id", args.member.id);
    void import("@/lib/email")
      .then(({ notifyGroupBuyFailed }) =>
        notifyGroupBuyFailed(
          args.member.id,
          args.group.id,
          `order_creation_failed: ${rpcErr?.message ?? "no_order_id"}`,
        ).catch(() => undefined),
      )
      .catch(() => undefined);
    return {
      ok: false,
      reason: `order_creation_failed: ${rpcErr?.message ?? "no_order_id"}`,
    };
  }

  await sb
    .from("group_buy_members")
    .update({
      payment_state: "charged",
      order_id: orderId,
      charged_at: new Date().toISOString(),
    })
    .eq("id", args.member.id);

  void import("@/lib/email")
    .then(({ notifyGroupBuyFormed }) =>
      notifyGroupBuyFormed(args.member.id).catch(() => undefined),
    )
    .catch(() => undefined);

  return { ok: true, orderId };
}

/**
 * The single "scan and form" pass the cron invokes every minute.
 * Iterates all `status='open'` group buys whose SUM(qty) has hit
 * `target_qty` and locks each one with an atomic UPDATE. For each
 * claimed group: computes final_unit_bdt, creates one order per
 * member via `create_order_with_items` RPC, marks members as
 * charged, then flips the group to 'formed'.
 *
 * Returns a per-group summary; the caller decides what to do with it
 * (log, fan out notifications, etc.). Email fan-outs are fire-and-forget
 * via `notifyGroupBuyFormed` / `notifyGroupBuyFailed`.
 *
 * Idempotent: a second call right after the first is a no-op for
 * already-formed groups (the WHERE-status='open' UPDATE returns 0).
 */
export async function runFormationPass(sb: SupabaseLike): Promise<{
  scanned: number;
  formed: Array<{
    group_buy_id: string;
    final_unit_bdt: number;
    member_count: number;
    total_qty: number;
  }>;
  skipped: Array<{ group_buy_id: string; reason: string }>;
  errors: Array<{ group_buy_id: string; error: string }>;
}> {
  const formed: Array<{
    group_buy_id: string;
    final_unit_bdt: number;
    member_count: number;
    total_qty: number;
  }> = [];
  const skipped: Array<{ group_buy_id: string; reason: string }> = [];
  const errors: Array<{ group_buy_id: string; error: string }> = [];

  // Scan: pull all open group buys with their product embed. The
  // scan is small (status='open' is bounded) — even at thousands
  // it's fine for a 1-min cron.
  const { data: groups, error: scanErr } = await sb
    .from("group_buys")
    .select(
      "id, target_qty, min_qty_per_buyer, price_tiers, product_id, products!inner(id, title_en, title_bn, source_id, images, category, weight_kg, volume_cbm, customs_duty_per_kg)",
    )
    .eq("status", "open")
    .limit(100);
  if (scanErr) {
    return {
      scanned: 0,
      formed: [],
      skipped: [],
      errors: [{ group_buy_id: "*", error: scanErr.message }],
    };
  }
  if (!groups || groups.length === 0) {
    return { scanned: 0, formed: [], skipped: [], errors: [] };
  }

  for (const g of groups) {
    // Bulk-load current SUM(qty) for this group. With the partial
    // unique index on group_buys(product_id) WHERE status='open',
    // a group can only be 'open' if no other is — so concurrent
    // join activity on THIS group is the only thing that matters.
    const { data: memberRows } = await sb
      .from("group_buy_members")
      .select("id, user_id, qty, unit_bdt_at_commit, payment_state")
      .eq("group_buy_id", g.id);
    const totalQty = (memberRows ?? []).reduce(
      (s, m) => s + (m.qty ?? 0),
      0,
    );
    if (totalQty < g.target_qty) {
      // Not yet at target — leave it open for more commits.
      continue;
    }

    // Atomic claim: flip status='open' → 'forming'. If 0 rows
    // updated, another cron already claimed it; bail.
    const { data: claimed, error: claimErr } = await sb
      .from("group_buys")
      .update({ status: "forming" })
      .eq("id", g.id)
      .eq("status", "open")
      .select("id")
      .maybeSingle();
    if (claimErr) {
      errors.push({ group_buy_id: g.id, error: claimErr.message });
      continue;
    }
    if (!claimed) {
      skipped.push({ group_buy_id: g.id, reason: "already_claimed" });
      continue;
    }

    // We now own this group. Re-read SUM one more time in case a
    // buyer cancelled or joined between the scan and the claim.
    // Phase 41: include shipping_mode (per-member air/sea/express).
    const { data: freshMembers } = await sb
      .from("group_buy_members")
      .select("id, user_id, qty, unit_bdt_at_commit, payment_state, shipping_mode")
      .eq("group_buy_id", g.id);
    const freshTotal = (freshMembers ?? []).reduce(
      (s, m) => s + (m.qty ?? 0),
      0,
    );
    if (freshTotal < g.target_qty) {
      // A buyer cancelled between scan and claim. Roll back to
      // 'open' so the next cron attempt can re-evaluate.
      await sb
        .from("group_buys")
        .update({ status: "open" })
        .eq("id", g.id)
        .eq("status", "forming");
      skipped.push({
        group_buy_id: g.id,
        reason: "below_target_after_claim",
      });
      continue;
    }

    // Freeze final_unit_bdt at the tiered price for freshTotal.
    const tiers = (g.price_tiers as unknown as GroupBuyPriceTier[]) ?? [];
    const finalUnitBdt = groupBuyPriceAtQty(tiers, freshTotal);

    const product = (g as unknown as {
      products: {
        id: number;
        title_en: string;
        title_bn: string | null;
        source_id: string;
        images: string[] | null;
        category: string;
        weight_kg: number;
        volume_cbm: number;
        customs_duty_per_kg: number;
      };
    }).products;

    let memberErrors = 0;
    for (const m of freshMembers ?? []) {
      const result = await createOrderForMember(sb, {
        group: {
          id: g.id,
          product_id: g.product_id,
          final_unit_bdt: finalUnitBdt,
        },
        member: {
          id: m.id,
          user_id: m.user_id,
          qty: m.qty,
          unit_bdt_at_commit: m.unit_bdt_at_commit,
          shipping_mode: (m.shipping_mode as string) ?? "air",
        },
        product,
      });
      if (!result.ok) memberErrors += 1;
    }

    // Flip the group to 'formed' with the frozen final_unit_bdt.
    // Even if some members failed, the group DID form — admin can
    // retry the failed ones from /admin/group-buys/[id] (Phase 41).
    const { error: formedErr } = await sb
      .from("group_buys")
      .update({
        status: "formed",
        final_unit_bdt: finalUnitBdt,
        formed_at: new Date().toISOString(),
      })
      .eq("id", g.id)
      .eq("status", "forming");

    if (formedErr) {
      errors.push({
        group_buy_id: g.id,
        error: `flip_to_formed_failed: ${formedErr.message}`,
      });
      continue;
    }

    formed.push({
      group_buy_id: g.id,
      final_unit_bdt: finalUnitBdt,
      member_count: (freshMembers ?? []).length,
      total_qty: freshTotal,
    });
  }

  return { scanned: groups.length, formed, skipped, errors };
}

/**
 * The expire pass. Finds every `status='open'` group whose
 * deadline has passed, atomically flips it to 'expired', and
 * fires `notifyGroupBuyExpired` for each member.
 *
 * Idempotent: same atomic-UPDATE pattern as formation.
 */
export async function runExpirePass(sb: SupabaseLike): Promise<{
  scanned: number;
  expired: Array<{ group_buy_id: string; member_count: number }>;
  skipped: Array<{ group_buy_id: string; reason: string }>;
  errors: Array<{ group_buy_id: string; error: string }>;
}> {
  const expired: Array<{ group_buy_id: string; member_count: number }> = [];
  const skipped: Array<{ group_buy_id: string; reason: string }> = [];
  const errors: Array<{ group_buy_id: string; error: string }> = [];

  const { data: candidates, error: scanErr } = await sb
    .from("group_buys")
    .select("id")
    .eq("status", "open")
    .lte("deadline_at", new Date().toISOString())
    .limit(100);
  if (scanErr) {
    return {
      scanned: 0,
      expired: [],
      skipped: [],
      errors: [{ group_buy_id: "*", error: scanErr.message }],
    };
  }
  if (!candidates || candidates.length === 0) {
    return { scanned: 0, expired: [], skipped: [], errors: [] };
  }

  for (const c of candidates) {
    // Atomic claim: flip status='open' → 'expired'.
    const { data: claimed, error: claimErr } = await sb
      .from("group_buys")
      .update({ status: "expired" })
      .eq("id", c.id)
      .eq("status", "open")
      .select("id")
      .maybeSingle();
    if (claimErr) {
      errors.push({ group_buy_id: c.id, error: claimErr.message });
      continue;
    }
    if (!claimed) {
      skipped.push({ group_buy_id: c.id, reason: "already_claimed" });
      continue;
    }

    // Fan out "expired" emails to all members.
    const { data: members } = await sb
      .from("group_buy_members")
      .select("id")
      .eq("group_buy_id", c.id);
    for (const m of members ?? []) {
      void import("@/lib/email")
        .then(({ notifyGroupBuyExpired }) =>
          notifyGroupBuyExpired(m.id).catch(() => undefined),
        )
        .catch(() => undefined);
    }
    expired.push({
      group_buy_id: c.id,
      member_count: members?.length ?? 0,
    });
  }

  return { scanned: candidates.length, expired, skipped, errors };
}