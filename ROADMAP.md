# BanglaSource — Next 4-6 Weeks Development Plan

_2026-06-14 / after Phase 18 (email pipeline + admin orders)_

The hard infrastructure is shipped: catalog, orders, payment, email
fan-out, image agent, manual product add. The next moves are about
**closing the loop on buyer experience** (saving time + reducing
friction) and **shipping the bits that are already half-built**
(buyer account pages, addresses, RFQs, welcome emails).

The plan is split into 5 phases. Each phase is **independently
shippable** — if you want to pause at any phase boundary, the
code is in a usable state.

## Scorecard: what's stub vs done

| Area | State | Notes |
|------|-------|-------|
| Catalog (PDP, cart, checkout, search, recs) | done | |
| Orders (buyer) | done | |
| Orders (admin list + detail + PATCH) | done | Phase 17 (2026-06-14) |
| Email pipeline (Resend + 4 fan-outs) | done | Phase 18 (2026-06-14) — needs RESEND_API_KEY to actually send |
| Image agent (manual + DeepSeek 6-prompt) | done | Phase 15b/c/d |
| Manual product add | done | Phase 15c |
| Buyer: orders, watchlist, notifications, profile (read), settings (read) | done | profile + settings are read-only |
| Buyer: **addresses** | stub (45 lines) | full CRUD needed |
| Buyer: **RFQs** | stub (55 lines) | full form + admin review needed |
| Buyer: profile **edit**, password **change** | missing | inline form + API |
| Auth: **welcome email** | not wired | needs Supabase DB webhook |
| Newsletter: **double opt-in** | not wired | needs confirmation email flow |
| Resend **provider setup** | not done | needs API key + verified domain |
| Search **empty state / "no results"** | missing | bare-bones |
| **About / How it works / Contact** | mostly static | need a few FAQs + real contact form |
| **WhatsApp per-product enquiry** | missing | static `wa.me/8617325764171` only on cart |
| **Product comparison** | missing | buyers ask for "side-by-side" |
| **Buyer order detail re-validation on status change** | working | but order detail re-fetches on every nav (consider WS or polling) |
| **Pre-existing TS errors** | open | 5 admin pages + 4 API routes have `select` → `never` lint noise. Runtime-fine. Worth a cleanup pass. |

## Phasing

The phases are roughly ordered by **(revenue impact × user impact) / effort**.
Lower phases = ship sooner.

### Phase 19 — Address book (1-2 days)

**Why now**: it's the single highest-friction thing in the buyer
flow. Today every checkout re-types full address. With addresses
saved, the next-order flow becomes "confirm + pay", not
"type-your-address-again".

**Scope**:
- New `addresses` table (already in scope notes, migration 0025):
  `id, user_id, label ('Home' | 'Office' | '3PL warehouse'),
  full_name, phone, district, address_line, country, is_default`
  with RLS (user reads/inserts/updates own only)
- `POST /api/buyer/addresses` (create)
- `PATCH /api/buyer/addresses/[id]` (update + set-default)
- `DELETE /api/buyer/addresses/[id]`
- `/buyer/addresses` — list + add/edit/delete form (replace the stub)
- `/checkout` — pre-fill address select with the saved default
- Wire the saved `address_id` into the orders table (currently
  `address_snapshot` is jsonb; add an optional FK and backfill)

**Acceptance**: end-to-end smoke (save 1 address, checkout uses
it, verify it lands on `orders.address_id`).

### Phase 20 — Resend setup + welcome email + newsletter opt-in (1 day)

**Why now**: zero-cost infrastructure. The lib is already in
place; it's a one-time provider setup and a 3-line Supabase
webhook.

**Scope**:
- Sign up at https://resend.com (free tier 3k emails/mo, 100/day)
- Verify the sending domain (one-time DNS records at the
  registrar: SPF + DKIM)
- Add `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` to
  `.env.local`
- Build `POST /api/auth/welcome` endpoint that:
  - Reads the new user's email from the Supabase webhook payload
  - Calls `notifyWelcome(userId)` (already in `lib/email.ts` but
    not wired)
  - Returns 200 to ack the webhook
- Supabase DB webhook: `auth.users` INSERT → `notifyWelcome`
  (use Supabase Studio → Database → Webhooks)
- Newsletter: build `POST /api/newsletter/confirm?token=...`
  endpoint that flips `newsletter_subscribers.confirmed_at`,
  and update `notifyNewsletterSubscribe()` in `lib/email.ts` to
  send the double-opt-in link (Resend will track clicks for
  deliverability)

**Acceptance**: real email lands in inbox for a fresh signup
+ a click on the newsletter confirmation link flips
`confirmed_at` in DB.

### Phase 21 — Profile edit + password change (0.5 day)

**Why now**: these are explicitly in the navbar, the buttons
exist, but the buttons do nothing. Tiny scope, big UX fix.

**Scope**:
- `PATCH /api/buyer/profile` (updates `profiles.full_name`,
  `company`, `phone`, `country`)
- `POST /api/buyer/profile/password` (validates current password
  via `supabase.auth.signInWithPassword`, then
  `supabase.auth.updateUser({ password: newPassword })`)
- `/buyer/profile` — convert from read-only to inline-edit form
  (same card list, click row → inline editor)

**Acceptance**: edit full_name in profile, navigate away + back,
name persists; change password, sign out, sign back in with
new password.

### Phase 22 — RFQ form + admin review (2-3 days)

**Why now**: the stub `/buyer/rfqs` page is in the navbar with
a "New RFQ" button. Closing this loop means buyers with
off-catalog needs have a real path to a quote.

**Scope**:
- New `rfqs` table: `id, user_id, product_id (nullable), title,
  spec_text, target_qty, target_price_cny_fen, image_urls[],
  status ('open'|'quoted'|'accepted'|'rejected')`
- `POST /api/buyer/rfqs` (create)
- `/buyer/rfqs` — list user's own RFQs + new-RFQ modal form
- `/admin/rfqs` (new admin page) — admin sees all open RFQs,
  can mark quoted (with their quoted price + lead time + min qty)
- Email fan-out: `notifyRFQReceived`, `notifyRFQQuoted`
- Add RFQ count to admin nav badge (Inbound group)

**Acceptance**: buyer submits RFQ → admin sees it → admin
quotes → buyer gets email with the quote.

### Phase 23 — Search & discover UX polish (1-2 days)

**Why now**: search is core to conversion. Today the "no
results" state is bare. The home page is a single
`_home-client` (you've probably felt the lack of category
previews on the homepage).

**Scope**:
- `/search` — handle the "no results for X" case with:
  - 2-3 best guesses (closest matches by trigram)
  - link to /search?forYou=true (For You recommendations)
  - "Browse all categories" + the 7 category chips
- `/search` — handle the "0 categories returned" case (search
  was empty/no spaces) with a helpful hint
- `/page.tsx` (home) — add a "Popular this week" carousel
  (top 8 by views in last 7d), "Recently restocked" carousel
  (top 8 by `price_history.recorded_at` in last 7d)
- `/products/[id]` — add "Similar products" carousel below
  the description (cross-sell on the same factory / same
  category, exclude the current product)

**Acceptance**: "0 results" search feels useful, not a dead end;
homepage has 2 scannable carousels.

### Phase 24 — Marketing pages + WhatsApp deep links (1-2 days)

**Why now**: the public site has `/about`, `/how-it-works`,
`/contact` that are mostly static copy. They rank for SEO
queries ("how to import from China to Bangladesh", "BD
wholesale supplier") but they're not pulling weight.

**Scope**:
- `/about` — flesh out: 6-section "why BanglaSource" page with
  real stats (active count, avg margin, country coverage)
- `/how-it-works` — 5-step visual flow (browse → cart → checkout
  → supplier → delivery) with the per-step cost breakdown
- `/contact` — real form that POSTs to a new
  `POST /api/contact` route, fans out via `sendEmail` to a
  `support@banglasource.com` inbox, stores in a `contact_messages`
  table
- `/products/[id]` — add a "Talk to us on WhatsApp" button
  next to the Add to Cart, with a deep link to
  `https://wa.me/8617325764171?text=Hi%20BanglaSource%2C%20I%27m%20interested%20in%20<source_id>`
  (currently only the cart drawer has the static `wa.me/` link)

**Acceptance**: contact form lands in inbox + DB; WhatsApp
button on PDP prefills product context.

### Phase 25 — Performance + SEO + accessibility audit (2-3 days)

**Why now**: with the catalog and order flow in good shape, the
biggest wins for revenue are now "the site is fast and
findable". This is a one-time investment that compounds.

**Scope**:
- Lighthouse pass on the 5 highest-traffic pages: home, PDP,
  category, cart, checkout. Target: 90+ on all categories
- Image optimization: convert the 168 product images to WebP
  via Sharp, add `loading="lazy"` + `decoding="async"` to all
  product cards
- Structured data: Product schema on PDP, Organization schema
  on home, BreadcrumbList on category/PDP
- Add a `/blog` index page (1 placeholder post) so the SEO
  sitemap has real text content
- Accessibility: tab order on the admin sidebar, focus rings
  on the 4 modal dialogs, contrast check on the warning/error
  text (currently `text-amber-800` on `bg-amber-50` is fine but
  some `text-fg-subtle` text is too low contrast)

**Acceptance**: Lighthouse 90+ on all 5 pages, structured data
validates in Google's Rich Results test.

## What's _not_ in this plan (yet)

These are higher-effort bets that I want to **defer** until the
above phases ship and we have real users giving feedback:

- **Pre-existing TS errors cleanup** — 5 admin pages + 4 API
  routes have Supabase `select` → `never` lint noise. Worth
  fixing in a focused afternoon but doesn't ship features.
  (Cheaper fix: generate the Supabase TypeScript types and
  use them — `npx supabase gen types typescript --project-id
  xgudiwguopfxqiwofkuz`.)
- **For You personalization** — currently the recs engine
  uses popularity + co-view (Phase 8). Real personalization
  would need DeepSeek to summarize per-user browsing history.
  Not worth until we have 100+ active users with at least 5
  page views each.
- **Saved searches** — buyers ask "alert me when X drops
  below ৳Y". Requires a `saved_searches` table + a daily cron
  that runs each saved search and fans out a price alert.
  Add after Phase 22 (RFQs) since both share the
  "buyer-defined query" pattern.
- **Multi-currency** — currently BDT-only. International
  wholesale is on the roadmap but no buyer has asked.
- **Mobile app** — web works on mobile (the chrome-wrapper
  adapts). PWA install banner is a 2-day lift if we want it.

## Effort + impact summary

| Phase | Effort | Direct revenue impact | User-retention impact |
|-------|--------|----------------------|----------------------|
| 19 Addresses | 1-2d | **High** (faster repeat-checkout) | High |
| 20 Resend + welcome | 1d | Low (one-time setup) | High (first impression) |
| 21 Profile edit | 0.5d | None | Medium |
| 22 RFQs | 2-3d | **High** (off-catalog sales) | High |
| 23 Search polish | 1-2d | Medium (better conversion) | Medium |
| 24 Marketing + WhatsApp | 1-2d | Medium (lead capture) | Low |
| 25 Perf + SEO + a11y | 2-3d | **High** (Lighthouse + Google) | Low |
| **Total** | **~10-15 days** | | |

## My recommendation

**Phase 19 → Phase 20 → Phase 22 → Phase 25 → Phase 23 → Phase 21 → Phase 24.**

Why this order:
- **19 (Addresses)** is the single biggest UX win. Buyers hate
  re-typing. This is the highest-ROI item in the plan.
- **20 (Resend setup)** unblocks the existing email pipeline so
  every phase after this can rely on real email. Costs one day.
- **22 (RFQs)** is the second-biggest revenue lever — it
  unlocks off-catalog sales which are the most common
  wholesale ask.
- **25 (perf + SEO + a11y)** — gets us the compounding wins.
  A 90+ Lighthouse score means lower bounce, higher conversion.
  SEO content gets us organic traffic we don't have to pay for.
- **23 (search polish)** — nice-to-have after the heavy hitters.
  Pairs well with perf work.
- **21 (profile edit)** — 4-hour lift, can be slotted anywhere.
- **24 (marketing + WhatsApp)** — at the end, the conversion
  path is fully optimized, so adding the marketing pages
  converts the traffic we've earned.

If you want to start with **just one phase**: **Phase 19 (Addresses)**
is the single best return for the time spent. Let me know which
phase to start and I'll go.
