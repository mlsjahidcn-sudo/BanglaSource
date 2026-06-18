-- Migration 0003: Price history + ingestion bookkeeping
--
-- Why: the 1688 Apify scraper will refresh price_tiers nightly. To know
-- what changed (and let ops see price trends), we record every diff.
--
-- The `set_updated_at` trigger function was created in migration 0001 and
-- re-used here.

begin;

-- ─────────────────────────────────────────────────────────────
-- price_history — one row per changed tier, per sync run
-- ─────────────────────────────────────────────────────────────
create table if not exists public.price_history (
  id          bigserial primary key,
  product_id  integer      not null references public.products(id) on delete cascade,
  source_id   text         not null,        -- denormalized for fast joins / display
  qty_min     integer      not null,
  qty_max     integer,                     -- null = open-ended top tier
  old_price_cny_fen integer,               -- null = tier was new
  new_price_cny_fen integer not null,
  change_pct  numeric(6,2) generated always as (
    case
      when old_price_cny_fen is null or old_price_cny_fen = 0 then null
      else round(((new_price_cny_fen - old_price_cny_fen)::numeric / old_price_cny_fen) * 100, 2)
    end
  ) stored,
  sync_run_id uuid         not null,        -- groups rows from a single ingestion
  source      text         not null default 'apify-1688-scraper',
  recorded_at timestamptz  not null default now()
);

create index if not exists idx_price_history_product_recorded
  on public.price_history (product_id, recorded_at desc);

create index if not exists idx_price_history_sync_run
  on public.price_history (sync_run_id);

create index if not exists idx_price_history_source
  on public.price_history (source_id, recorded_at desc);

alter table public.price_history enable row level security;

-- Public read so /ops can show charts to anyone with a read key in the future
-- (we'll keep it write-locked: only service-role can insert).
drop policy if exists "price_history public read" on public.price_history;
create policy "price_history public read"
  on public.price_history for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policy for anon/authenticated → those are
-- service-role only (cron job).

-- ─────────────────────────────────────────────────────────────
-- sync_runs — bookend rows for each ingestion run
-- ─────────────────────────────────────────────────────────────
create table if not exists public.sync_runs (
  id              uuid primary key default gen_random_uuid(),
  source          text not null,                 -- 'apify-1688-scraper', 'manual', etc.
  trigger         text not null,                 -- 'cron', 'manual-script', 'admin-button'
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  products_seen   integer default 0,
  products_changed integer default 0,
  products_added  integer default 0,
  products_removed integer default 0,
  tiers_changed   integer default 0,
  api_cost_usd    numeric(8,4) default 0,
  error           text,
  metadata        jsonb
);

create index if not exists idx_sync_runs_started_desc
  on public.sync_runs (started_at desc);

alter table public.sync_runs enable row level security;

drop policy if exists "sync_runs public read" on public.sync_runs;
create policy "sync_runs public read"
  on public.sync_runs for select
  to anon, authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────
-- set_updated_at trigger for sync_runs
-- (products already has it from 0001; price_history is append-only
--  so it doesn't need updated_at)
-- ─────────────────────────────────────────────────────────────
drop trigger if exists trg_sync_runs_updated_at on public.sync_runs;
create trigger trg_sync_runs_updated_at
  before update on public.sync_runs
  for each row execute function public.set_updated_at();

commit;
