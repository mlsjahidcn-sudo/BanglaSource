-- Migration 0007: discovered_products
--
-- When the discover-1688 cron runs a keyword search, Apify returns
-- many SKUs we don't have in the catalog. We store them here with
-- the raw scraped data + a "status" column. From /ops/discovery you
-- can review and approve rows into public.products.

begin;

create table if not exists public.discovered_products (
  id              bigserial primary key,
  offer_id        text not null unique,
  title_zh        text not null,
  title_en        text,                    -- filled in by /ops/discovery review
  category        text,
  factory_moq     integer,
  price_tiers     jsonb,                   -- the raw quantityPrices array
  images          jsonb,                   -- array of URLs
  supplier_name   text,
  supplier_province text,
  supplier_city   text,
  badges          jsonb,
  source_url      text,
  raw_response    jsonb,                   -- the full Apify row for forensics
  status          text not null default 'new' check (status in ('new', 'approved', 'rejected', 'imported')),
  discovered_at   timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewer_note   text,
  source_keyword  text,                    -- the keyword that surfaced this row
  product_id      integer references public.products(id) on delete set null  -- populated on 'imported'
);

create index if not exists idx_discovered_status on public.discovered_products (status, discovered_at desc);
create index if not exists idx_discovered_category on public.discovered_products (category);
create index if not exists idx_discovered_keyword on public.discovered_products (source_keyword);

alter table public.discovered_products enable row level security;

drop policy if exists "discovered_products public read" on public.discovered_products;
create policy "discovered_products public read"
  on public.discovered_products for select
  to anon, authenticated
  using (true);

commit;
