<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:supabase-setup -->
# Supabase backend (cloud)

- Project: `xgudiwguopfxqiwofkuz.supabase.co` (official supabase.com)
- Schema bootstrap: paste `supabase/00_run_all.sql` into Supabase → SQL Editor → Run.
  This is one file containing both migrations + the 21-product seed.
- Env (`.env.local`):
  - `NEXT_PUBLIC_SUPABASE_URL` — publishable, client-safe
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable, client-safe (anon RLS context)
  - `SUPABASE_SERVICE_ROLE_KEY` — secret, **server-only**, bypasses RLS. Get from
    Supabase dashboard → Project Settings → API → service_role.
- Clients (always import from these, never from `@supabase/supabase-js` directly):
  - `src/lib/supabase/server.ts` — `getServerClient()` for cookies-bound RSC/route-handler reads;
    `getServiceRoleClient()` for trusted server writes that bypass RLS.
  - `src/lib/supabase/browser.ts` — `getBrowserClient()` for client-side sign-in / user-scoped reads.
- Auth model: email + password. Email confirmation is ON by default — for local dev either:
  (a) disable it in Supabase dashboard → Authentication → Providers → Email → "Confirm email",
  or (b) click the link in the confirmation email.
- Middleware (`middleware.ts`) gates `/account` (redirects unauthenticated users to `/login`).
- RLS:
  - `profiles`: users see/edit only their own row.
  - `quotes`: users see/insert only their own; updates are service-role only (ops-only).
  - `products` / `price_tiers`: public read, anon, no auth needed for catalog browse.
- `data/products.ts` (the 20-product seed file in src/) is now duplicated in the DB.
  Future work: replace the TS import in `landing-cost` and `search` API routes with
  Supabase queries so the DB is the single source of truth.
<!-- END:supabase-setup -->
