// scripts/backfill-customs-duty.mts
//
// One-time title-keyword backfill of products.customs_duty_per_kg
// based on the Bangladesh air-cargo specific duty schedule:
//
//   Category A — 750 ৳/kg  (default for shoes, bags, jewelry,
//                              regular electronics, etc.)
//   Category B — 1,150 ৳/kg  (battery-operated electronics,
//                              networking/magnet/laser items,
//                              seeds, chemicals, etc.)
//   Category C — 3,500 ৳/kg  (sunglasses)
//              — 1,500 ৳/kg  (CCTV camera)
//              — 1,350 ৳/kg  (battery or power bank only)
//              — 1,200 ৳/kg  (smart watch, BT headphone, food,
//                              kitchen knife, powder)
//              — 1,150 ৳/kg  (clothing default 750, liquid
//                              cosmetics, regular watch)
//
// Run with:
//   NODE_OPTIONS="--conditions=react-server" \
//     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     pnpm tsx scripts/backfill-customs-duty.mts
//
// Idempotent — re-running just re-classifies.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local or in the shell.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

type Classified = {
  per_kg: number;
  class: string;
};

function classify(
  titleEn: string,
  category: string,
): Classified {
  const t = titleEn;
  const tLower = t.toLowerCase();

  // ── Eyewear ──
  if (category === "eyewear") {
    if (/sunglass|spectacle|shades|uv\s*400|polariz/.test(tLower)) {
      return { per_kg: 3500, class: "sunglasses-c" };
    }
    return { per_kg: 750, class: "cat-a" };
  }

  // ── Watches ──
  if (category === "watches") {
    if (/smart/.test(tLower)) return { per_kg: 1200, class: "smart-watch-c" };
    return { per_kg: 1150, class: "regular-watch-c" };
  }

  // ── Beauty / Personal care ──
  if (category === "beauty") {
    // Battery-powered grooming tools count as electronics, not beauty
    if (
      /usb|rechargeable|wireless|electric|battery|heated|curler|straightener|comb/.test(
        tLower,
      )
    ) {
      return { per_kg: 1150, class: "beauty-electronics-b" };
    }
    // Powders
    if (/powder|blush|foundation|concealer|eyeshadow|highlighter/.test(tLower)) {
      return { per_kg: 1200, class: "powder-c" };
    }
    // Liquids / creams / serums / sprays / perfumes
    if (
      /serum|essence|toner|perfume|fragrance|lotion|shampoo|conditioner|gel|cream|oil|spray|mist|collagen|whitening|moistur|sunscreen|mask|vitamin|facial|skin|hydrat|peptide|growth|body\s*spray/.test(
        tLower,
      )
    ) {
      return { per_kg: 1150, class: "liquid-cosmetic-c" };
    }
    return { per_kg: 750, class: "cat-a" };
  }

  // ── Gadgets / Electronics ──
  if (category === "gadgets") {
    if (/bluetooth|tws|earbud|airbud|earphone|headphone|headset|wireless\s*ear/.test(tLower)) {
      return { per_kg: 1200, class: "bluetooth-c" };
    }
    if (/smart\s*watch/.test(tLower)) {
      return { per_kg: 1200, class: "smart-watch-c" };
    }
    if (/power\s*bank/.test(tLower)) {
      return { per_kg: 1350, class: "power-bank-c" };
    }
    if (/cctv/.test(tLower)) {
      return { per_kg: 1500, class: "cctv-c" };
    }
    if (/battery|rechargeable/.test(tLower)) {
      return { per_kg: 1150, class: "cat-b" };
    }
    return { per_kg: 750, class: "cat-a" };
  }

  // ── Default per category ──
  if (category === "shoes") return { per_kg: 750, class: "cat-a" };
  if (category === "bags") return { per_kg: 750, class: "cat-a" };
  if (category === "jewelry") return { per_kg: 750, class: "cat-a" };

  return { per_kg: 750, class: "cat-a" };
}

async function main() {
  // Pull all active products (we use the service-role client so this
  // is fast — no RLS round-trip)
  const { data, error } = await supabase
    .from("products")
    .select("source_id, title_en, category, customs_duty_per_kg, customs_duty_class")
    .eq("active", true)
    .limit(500);

  if (error) {
    console.error("Failed to load products:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.log("No products found.");
    return;
  }

  // Classify + collect updates
  const updates: Array<{
    source_id: string;
    customs_duty_per_kg: number;
    customs_duty_class: string;
    title_en: string;
    category: string;
  }> = [];
  const stats = new Map<string, number>();

  for (const p of data) {
    const { per_kg, class: cls } = classify(p.title_en ?? "", p.category ?? "");
    stats.set(cls, (stats.get(cls) ?? 0) + 1);
    // Only emit UPDATE if the value actually changed
    if (
      Number(p.customs_duty_per_kg) !== per_kg ||
      p.customs_duty_class !== cls
    ) {
      updates.push({
        source_id: p.source_id,
        customs_duty_per_kg: per_kg,
        customs_duty_class: cls,
        title_en: p.title_en,
        category: p.category,
      });
    }
  }

  console.log("\n=== Classification results ===\n");
  for (const [cls, n] of [...stats.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cls.padEnd(28)} ${n.toString().padStart(4)} products`);
  }
  console.log(`\n  Total classified: ${data.length}`);
  console.log(`  Updates needed:    ${updates.length}`);

  if (updates.length === 0) {
    console.log("\nNothing to update — all products already classified.");
    return;
  }

  // Apply updates in batches of 50 (Supabase has a row limit per
  // .update() but no real limit on .upsert() so we use upsert keyed
  // on source_id).
  let applied = 0;
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    // We need an explicit primary-key column for upsert. The
    // `id` is the integer PK; we need to look those up. Simpler:
    // use the .update() with .in() on source_id.
    const sourceIds = batch.map((u) => u.source_id);
    // We can only set one (per_kg, class) pair at a time per row,
    // so we just iterate. For 166 rows it's fast enough.
    for (const u of batch) {
      const { error: e } = await supabase
        .from("products")
        .update({
          customs_duty_per_kg: u.customs_duty_per_kg,
          customs_duty_class: u.customs_duty_class,
        })
        .eq("source_id", u.source_id);
      if (e) {
        console.error(`  FAIL  ${u.source_id} (${u.title_en.slice(0, 40)}): ${e.message}`);
      } else {
        applied += 1;
      }
    }
  }
  console.log(`\n  Applied: ${applied}/${updates.length} updates`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
