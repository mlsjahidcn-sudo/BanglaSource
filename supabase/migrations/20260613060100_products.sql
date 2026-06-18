-- ============================================================================
-- 0002_products.sql
-- Catalog schema:
--   - products    (one row per SKU)
--   - price_tiers (qty → unit price)
--
-- Public-readable. RLS disabled (catalog is public marketing data).
-- ============================================================================

create table if not exists public.products (
  id                 bigserial primary key,
  source_id          text not null unique,                -- e.g. "738201456912"
  title_en           text not null,
  title_bn           text not null,
  title_zh           text not null,
  category           text not null check (category in (
                       'apparel','electronics','jewelry',
                       'home','beauty','toys','automotive'
                     )),
  factory_moq        integer not null check (factory_moq > 0),
  weight_kg          numeric(10,3) not null,
  volume_cbm         numeric(12,6) not null,
  markup_pct         numeric(5,2) not null default 10,
  quality_score      numeric(3,1),
  supplier_name      text not null,
  supplier_province  text not null,
  supplier_city      text not null,
  stock_total        integer not null default 0,
  order_count_30d    integer not null default 0,
  rating_overall     numeric(3,2) not null default 0,
  badges             text[] not null default '{}',
  images             text[] not null default '{}',
  description_en     text not null,
  description_bn     text not null,
  source_url         text not null,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists products_category_idx on public.products(category);
create index if not exists products_active_idx on public.products(active);
create index if not exists products_source_id_idx on public.products(source_id);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ── price_tiers ────────────────────────────────────────────────────────────
create table if not exists public.price_tiers (
  id              bigserial primary key,
  product_id      bigint not null references public.products(id) on delete cascade,
  qty_min         integer not null check (qty_min > 0),
  qty_max         integer not null check (qty_max >= qty_min),
  price_cny_fen   integer not null check (price_cny_fen > 0),
  unique (product_id, qty_min)
);

create index if not exists price_tiers_product_idx on public.price_tiers(product_id);

-- Public catalog: enable read for anon + authenticated
alter table public.products   enable row level security;
alter table public.price_tiers enable row level security;

drop policy if exists "products: public read" on public.products;
create policy "products: public read"
  on public.products for select
  using (active = true);

drop policy if exists "price_tiers: public read" on public.price_tiers;
create policy "price_tiers: public read"
  on public.price_tiers for select
  using (
    exists (
      select 1 from public.products p
      where p.id = price_tiers.product_id and p.active = true
    )
  );

-- No INSERT/UPDATE/DELETE policies: writes go through service-role only.
