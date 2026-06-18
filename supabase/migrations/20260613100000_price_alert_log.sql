-- Migration 0006: price_alert_log
--
-- The price-alerts cron job watches price_history for sudden moves
-- (>15% in 24h) and writes one row per detection. This lets ops see
-- recent alerts and avoid re-sending the same email twice.

begin;

create table if not exists public.price_alert_log (
  id           bigserial primary key,
  product_id   integer not null references public.products(id) on delete cascade,
  source_id    text    not null,
  qty_min      integer not null,
  qty_max      integer,
  old_price_cny_fen integer not null,
  new_price_cny_fen integer not null,
  change_pct   numeric(6,2) not null,
  direction    text    not null check (direction in ('rise', 'drop')),
  detected_at  timestamptz not null default now(),
  notified_at  timestamptz,
  acknowledged_at timestamptz
);

create index if not exists idx_price_alert_log_detected_desc
  on public.price_alert_log (detected_at desc);

create index if not exists idx_price_alert_log_product
  on public.price_alert_log (product_id, detected_at desc);

-- Dedupe index: prevent the same (product, tier, magnitude band) from
-- being logged more than once in a 24h window
create unique index if not exists uniq_price_alert_dedupe
  on public.price_alert_log (product_id, qty_min, qty_max, detected_at);

alter table public.price_alert_log enable row level security;

drop policy if exists "price_alert_log public read" on public.price_alert_log;
create policy "price_alert_log public read"
  on public.price_alert_log for select
  to anon, authenticated
  using (true);

commit;
