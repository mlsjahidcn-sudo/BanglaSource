-- ── Backfill weight / volume for products missing these fields ──────────
--
-- 1688 listings rarely publish per-piece weight or volume, so most
-- products had weight_kg=0 / volume_cbm=0, which collapsed the
-- shipping cost calculator to its minimum (¥2,000) and inflated
-- landed cost absurdly for cheap products.
--
-- We backfill with category-typical values so the calculator at
-- least approximates real shipping weight/volume. These are
-- conservative estimates — when a real quote is requested, an admin
-- can override per-product in the editor (the API accepts weight_kg
-- and volume_cbm).
--
-- Reference dimensions (per piece):
--   gadgets  (TWS, cables, power banks): ~80g,  10×8×4   cm
--   eyewear  (sunglasses, frames):       ~50g,  15×6×5   cm
--   shoes    (sneakers — one shoe):      ~600g, 30×20×12 cm
--   bags     (backpacks, handbags):      ~600g, 45×30×15 cm
--   watches  (smart watches):            ~80g,  12×8×5   cm
--   beauty   (lipstick, skincare):      ~150g, 12×6×5   cm
--   jewelry  (rings, earrings):          ~30g,  8×6×3    cm
--
-- Migration is idempotent: only updates rows where weight_kg is
-- null or zero.

BEGIN;

WITH defaults AS (
  SELECT 'gadgets'::text AS cat, 0.080::numeric AS kg, 0.000320::numeric AS cbm
  UNION ALL SELECT 'eyewear', 0.050, 0.000450
  UNION ALL SELECT 'shoes',   0.600, 0.007200
  UNION ALL SELECT 'bags',    0.600, 0.020250
  UNION ALL SELECT 'watches', 0.080, 0.000480
  UNION ALL SELECT 'beauty',  0.150, 0.000360
  UNION ALL SELECT 'jewelry', 0.030, 0.000144
)
UPDATE products p SET
  weight_kg = d.kg,
  volume_cbm = d.cbm
FROM defaults d
WHERE p.category = d.cat
  AND (p.weight_kg IS NULL OR p.weight_kg = 0);

COMMIT;
