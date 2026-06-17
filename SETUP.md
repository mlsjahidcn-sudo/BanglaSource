# Operator setup

> One-time setup steps for the human in the loop. Once done,
> these don't need to be repeated.

## Email (Resend) — Phase 20

BanglaSource uses Resend for transactional email (order
confirmations, payment received, status changes, price alerts,
welcome, newsletter double opt-in). Without `RESEND_API_KEY`,
all 6 fan-out helpers log to stdout instead of sending.

### 1. Create a Resend account

- Go to https://resend.com and sign up
- Free tier: 3,000 emails/month, 100/day — plenty for early traffic

### 2. Verify a sending domain

BanglaSource will send from `orders@banglasource.com` (and
`noreply@` for transactional). To pass SPF/DKIM, you need to
verify the domain you own:

- In Resend → **Domains** → **Add Domain** → `banglasource.com`
- Resend shows 3 DNS records (SPF, DKIM, DMARC) — add them at
  your registrar (Cloudflare, Namecheap, etc.) as TXT records
- Wait for Resend to confirm verification (usually <30 min)

### 3. Get the API key

- In Resend → **API Keys** → **Create API Key**
- Copy the `re_xxx` string

### 4. Add to `.env.local`

```bash
# .env.local
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM="BanglaSource <orders@banglasource.com>"
EMAIL_REPLY_TO="support@banglasource.com"
SUPABASE_WEBHOOK_SECRET=any-random-string-you-pick  # optional
```

- `RESEND_API_KEY` is the gate. Once set + production
  `NODE_ENV`, the next email send goes to Resend instead of
  stdout.
- `EMAIL_FROM` overrides the default
  `BanglaSource <noreply@banglasource.com>`. The address
  part (`orders@...`) must be on the verified domain.
- `EMAIL_REPLY_TO` is what shows up as Reply-To on every
  email. Optional.
- `SUPABASE_WEBHOOK_SECRET` enables webhook signature
  checking on `/api/auth/welcome`. Pick any string; the
  same string goes in the Supabase webhook header config.

### 5. Wire the Supabase DB webhook for `notifyWelcome`

- Supabase Studio → **Database** → **Webhooks** → **Create**
- **Name**: `welcome-email`
- **Table**: `auth.users` (under the `auth` schema)
- **Events**: `INSERT`
- **Type**: HTTP Request
- **URL**: `https://<your-site>/api/auth/welcome`
- **Method**: POST
- **HTTP Headers**: add `X-Webhook-Secret: <same string as
  SUPABASE_WEBHOOK_SECRET>`

The webhook fires the moment a new user signs up.

### 6. Restart and test

- Restart `pnpm dev` (or your prod deploy) so the new env
  is picked up.
- Sign up with a real email → check the inbox (and spam).
- Place a test order → confirm the order-placed email lands.
- Subscribe to the newsletter from the footer → confirm the
  double opt-in email lands → click the link → /newsletter/confirmed
  shows "You're in".

## What the 6 fan-out helpers send

| Helper | When | Subject example |
|--------|------|-----------------|
| `notifyOrderPlaced` | `/api/orders` POST | `Order BS-000123 received — ৳56,456 to pay` |
| `notifyOrderPaid` | `/api/orders/[id]/paid` POST | `Order BS-000123 — payment received, processing now` |
| `notifyOrderStatusChange` | Admin PATCH to `in_transit` or `delivered` | `Order BS-000123 — in transit (air freight)` |
| `notifyPriceAlert` | `/api/cron/price-alerts` (15%+ move) | `Price dropped 20.0% on Retro Sunglasses for Women` |
| `notifyWelcome` | Supabase DB webhook on `auth.users` INSERT | `Welcome to BanglaSource — your wholesale import shortcut` |
| `notifyNewsletterConfirm` | `/api/newsletter/subscribe` POST | `Confirm your BanglaSource newsletter subscription` |

All 6 are in `src/lib/email.ts`. All 6 return a non-throwing
`EmailResult` envelope. All 6 log to stdout if `RESEND_API_KEY`
is unset or `NODE_ENV !== "production"`.

Phase 38/40 added 4 more helpers — see `group_buy.*` keys in
`src/lib/i18n-dict.ts` for the buyer-facing copy that drives
each template (`group_buy_joined`, `group_buy_membership_cancelled`,
`group_buy_formed`, `group_buy_failed`, `group_buy_expired`).

## Cron jobs (Phases 8, 9, 27, 40)

All cron routes gate on the `x-cron-secret` header matching
`process.env.CRON_SECRET`. On Vercel, the scheduler hits each
route automatically per `vercel.json`:

| Path | Schedule | Phase | Purpose |
|------|----------|-------|---------|
| `/api/cron/sync-1688`     | daily 03:00 UTC | 9  | Apify 1688 price + stock refresh |
| `/api/cron/discover-1688` | daily 05:00 UTC | 9  | New 1688 product discovery |
| `/api/cron/price-alerts`  | daily 04:30 UTC | 8  | Detect ≥15% price moves, fan out |
| `/api/cron/group-buys/form`   | every minute   | 40 | Form group_buys at target qty |
| `/api/cron/group-buys/expire` | every 5 min    | 40 | Expire past-deadline open groups |

**Railway / self-hosted**: Vercel cron jobs don't run on Railway
(or any other host). You need an external scheduler. The
cheapest reliable option is **GitHub Actions scheduled workflows**
on this same repo (no extra account needed) — three workflow
files are pre-shipped in `.github/workflows/`:

| File | Schedule | Endpoint |
|------|----------|----------|
| `cron-1min.yml`   | every minute     | `/api/cron/group-buys/form` |
| `cron-5min.yml`   | every 5 minutes  | `/api/cron/group-buys/expire` |
| `cron-daily.yml`  | 03:00, 04:30, 05:00 UTC | `/api/cron/sync-1688`, `/api/cron/price-alerts`, `/api/cron/discover-1688` |

Activate them:

1. Set **two repository secrets** under
   GitHub → Settings → Secrets and variables → Actions:
   - `CRON_SECRET` — must match `CRON_SECRET` on the BanglaSource
     deployment (default `bnG_x9Kp7vR3wQzL2mY8sN4jH6tD5fE1aC0bVg`)
   - `NEXT_PUBLIC_SITE_URL` — production URL, e.g.
     `https://banglasource.up.railway.app`
2. Ensure Actions are enabled on the repo
   (Settings → Actions → General → Allow all actions +
   all required permissions — read-only is fine)
3. Verify: GitHub → Actions tab → click `Cron (1-min)` →
   Run workflow (manual trigger). Watch the run log for
   `Ping /api/cron/group-buys/form` exit code 0.

Each route is idempotent and rate-limited at 30/min/IP, so
duplicate pings from a misbehaving scheduler (or a brief
Vercel+GitHub overlap if you ever dual-host) won't cause
double-orders. The 1688 routes no-op cleanly if `APIFY_TOKEN`
is unset (they log + return 200), so leaving them wired is
safe even before you set up Apify.

Alternatives to GitHub Actions:
[cron-job.org](https://cron-job.org) (free, no GitHub dep) and
[EasyCron](https://www.easycron.com) work identically —
both fire `curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET"
"$NEXT_PUBLIC_SITE_URL/api/cron/<route>"`.
