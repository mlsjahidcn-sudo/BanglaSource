# Railway deploy guide

One-time deploy of BanglaSource to Railway. The repo is already
on GitHub at `mlsjahidcn-sudo/BanglaSource`.

## 1. Create the Railway project

1. Open https://railway.com → **New Project** → **Deploy from GitHub repo**.
2. Pick `mlsjahidcn-sudo/BanglaSource`.
3. Railway auto-detects Next.js. The first deploy will likely fail because
   env vars aren't set yet — that's expected.

## 2. Set environment variables

In **Variables** tab, add the keys from `.env.example` (see that file for
inline comments). **At minimum** you must set:

```
NEXT_PUBLIC_SUPABASE_URL=https://xgudiwguopfxqiwofkuz.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
CRON_SECRET=<any 32+ char random string>
```

**Optional but recommended** (see SETUP.md for what each does):

```
RESEND_API_KEY=re_...
APIFY_TOKEN=apify_api_...
DEEPSEEK_API_KEY=sk-...
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://apinebula.com/v1
```

`NEXT_PUBLIC_*` vars are exposed to the browser — only anon-safe values
belong there. The `SUPABASE_SERVICE_ROLE_KEY` is server-only and bypasses
RLS — never put it in a `NEXT_PUBLIC_*` var.

## 3. Configure the public domain

In **Settings → Networking → Public Networking**, click **Generate Domain**.
Railway gives you a `*.up.railway.app` URL automatically. Add a custom
domain later if you have one.

Update `NEXT_PUBLIC_SITE_URL` in Variables to match the public URL — many
emails + sitemap URLs are derived from it.

## 4. Cron jobs (Railway doesn't run Vercel crons)

Vercel crons defined in `vercel.json` won't run on Railway. You need an
external scheduler — GitHub Actions is free and zero-config. See
`SETUP.md § Cron jobs` for the copy-paste workflow.

The Group Buy cron routes accept POST with header
`x-cron-secret: <CRON_SECRET>` and are idempotent + rate-limited at
30/min/IP, so duplicate pings are safe.

## 5. Build settings

The `nixpacks.toml` at the repo root pins:
- `nodejs_20` (Nixpacks attribute, not corepack — sidesteps the
  Node 20.18.x corepack signing-key failure)
- `pnpm` (matches `packageManager` field in package.json)
- `pnpm install --frozen-lockfile`
- `pnpm run build` (Next.js build)
- `pnpm run start` (binds to `0.0.0.0:$PORT`)

**Memory gotcha applied**: the SICA Railway postmortem found that
`tailwindcss`, `@tailwindcss/postcss`, and `typescript` were originally
in devDependencies but are static imports used at build time. With
Railway's `NODE_ENV=production`, pnpm skipped them and the build broke.
These are now in `dependencies` so they're always installed.

## 6. Verify the deploy

After the build succeeds:

```bash
# Replace $URL with your Railway domain
curl -fsS https://$URL/api/catalog | head -c 200
# expect: {"ok":true,"count":167,...}

# Smoke the auth flow
curl -fsS https://$URL/group-buys | grep -c "Group buys"
# expect: at least 1
```

## 7. Set up the GitHub PAT webhook (optional)

The Supabase DB webhook for `notifyWelcome` (sent when a new auth.users
row is created) needs to point at `<RAILWAY_URL>/api/auth/welcome`.
Configure it in Supabase → Database → Webhooks. See `SETUP.md` §
"Webhook for new auth users" for the payload shape.