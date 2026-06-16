# scripts/

Helper scripts for working with the Supabase backend.

## `gen-seed.mts`

Regenerate `supabase/seed.sql` from the source-of-truth catalog in
`src/data/products.ts`. Run after you add or change a product:

```bash
pnpm tsx scripts/gen-seed.mts
```

Output uses subqueries (`SELECT id FROM public.products WHERE source_id = ...`)
to link price_tiers to products, so the file is portable and doesn't need
to run inside a single transaction.

## `smoke-e2e.mts`

End-to-end smoke test: signs in as the seeded test user, calls
`/api/quote/landed` for a real quote, then POSTs to `/api/quote/save` to
verify the full Supabase round-trip works.

```bash
# First: apply the schema via supabase/00_run_all.sql
# Then: create the test user (one-time) with:
#   curl -X POST .../auth/v1/admin/users -H "apikey: $SVC" \
#     -d '{"email":"test+phase3@banglasource.bd","password":"TestPass123!","email_confirm":true}'
export $(grep -v '^#' .env.local | xargs) && pnpm tsx scripts/smoke-e2e.mts
```

Expected output:
```
✓ signed in as test+phase3@banglasource.bd
✓ fetched real quote: Q-...
✓ /api/quote/save → HTTP 200
✅ END-TO-END SUCCESS
```
