-- ============================================================================
-- 00_run_all.sql
-- Single-file setup: migrations + seed (in one transaction).
-- Paste this into Supabase → SQL Editor → New query → Run.
-- Then: Supabase → Authentication → Providers → enable Email (already on by default).
-- ============================================================================

-- ── shared updated_at trigger fn ──────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION 1: profiles + quotes
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  company     text,
  phone       text,
  country     text default 'BD',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.quotes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  quote_id        text not null unique,
  product_ids     text[] not null,
  shipping_mode   text not null check (shipping_mode in ('air','sea','express')),
  total_qty       integer not null check (total_qty > 0),
  fob_cny_fen     bigint not null,
  fx_cny_bdt      numeric(10,4) not null,
  cn_subtotal_bdt bigint not null,
  intl_bdt        bigint not null,
  agent_bdt       bigint not null,
  consol_bdt      bigint not null,
  duty_bdt        bigint not null,
  duty_pct        numeric(5,4) not null,
  vat_bdt         bigint not null,
  ait_bdt         bigint not null,
  markup_bdt      bigint not null,
  markup_pct      numeric(5,2) not null,
  total_bdt       bigint not null,
  unit_bdt        bigint not null,
  chargeable_kg   numeric(10,2) not null,
  transit_days    text not null,
  status          text not null default 'pending'
                    check (status in ('pending','sourced','quoted','confirmed','paid','shipped','delivered','cancelled')),
  notes           text,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists quotes_user_id_idx on public.quotes(user_id);
create index if not exists quotes_status_idx on public.quotes(status);
create index if not exists quotes_created_at_idx on public.quotes(created_at desc);

drop trigger if exists trg_quotes_updated_at on public.quotes;
create trigger trg_quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.quotes   enable row level security;

drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "quotes: select own" on public.quotes;
create policy "quotes: select own"
  on public.quotes for select
  using (auth.uid() = user_id);

drop policy if exists "quotes: insert own" on public.quotes;
create policy "quotes: insert own"
  on public.quotes for insert
  with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION 2: products + price_tiers
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.products (
  id                 bigserial primary key,
  source_id          text not null unique,
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

create table if not exists public.price_tiers (
  id              bigserial primary key,
  product_id      bigint not null references public.products(id) on delete cascade,
  qty_min         integer not null check (qty_min > 0),
  qty_max         integer not null check (qty_max >= qty_min),
  price_cny_fen   integer not null check (price_cny_fen > 0),
  unique (product_id, qty_min)
);

create index if not exists price_tiers_product_idx on public.price_tiers(product_id);

alter table public.products    enable row level security;
alter table public.price_tiers enable row level security;

drop policy if exists "products: public read" on public.products;
create policy "products: public read"
  on public.products for select
  using (active = true);

drop policy if exists "price_tiers: public read" on public.price_tiers;
create policy "price_tiers: public read"

-- ════════════════════════════════════════════════════════════════════════════
-- SEED: 21 products + price tiers
-- (Generated from src/data/products.ts via scripts/gen-seed.mts)
-- ════════════════════════════════════════════════════════════════════════════

-- Auto-generated seed from src/data/products.ts (21 products)
-- Run AFTER migrations 0001 + 0002 are applied.
-- Uses a single CTE chain so the bigserial IDs from products are visible
-- to the price_tiers INSERTs without needing a multi-statement transaction.

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('738201456912', 'Ice Silk Ribbed Hijab Muslim Women Scarf', 'আইস সিল্ক রিবড হিজাব মুসলিম নারী স্কার্ফ', '新款冰丝螺纹头巾穆斯林女士头巾', 'apparel', 5, 0.08, 0.0003, 30, 8, '义乌市漫莎服饰有限公司', '浙江', '义乌市', 28400, 1840, 4.7, ARRAY['verified_factory', '24h_response', 'top_supplier']::text[], ARRAY['https://images.unsplash.com/photo-1580901368919-7738efb0f87e?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&auto=format&fit=crop&q=80']::text[], 'Breathable ice-silk hijab with ribbed texture. Soft, non-slip, suitable for daily wear and prayer. 18 color options available.', 'শ্বাস-প্রশ্বাসযোগ্য আইস-সিল্ক হিজাব রিবড টেক্সচার সহ। নরম, পিছলে না, দৈনন্দিন ব্যবহার ও নামাজের জন্য উপযুক্ত। ১৮টি রঙ পাওয়া যায়।', 'https://detail.1688.com/offer/738201456912.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '738201456912'), 1, 9, 680);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '738201456912'), 10, 49, 520);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '738201456912'), 50, 199, 410);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '738201456912'), 200, 9999, 320);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('742193608527', '2024 New Cotton Printed Long Kurti for Women', '২০২৪ নতুন সুতির প্রিন্টেড লং কুর্তি মহিলাদের জন্য', '2024新款纯棉印花长款kurti女装', 'apparel', 3, 0.28, 0.0009, 30, 9, '广州市莎丽服饰有限公司', '广东', '广州市', 8500, 920, 4.6, ARRAY['verified_factory', 'top_supplier']::text[], ARRAY['https://images.unsplash.com/photo-1551803091-e20673f15770?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1564859228273-274232fdb516?w=800&auto=format&fit=crop&q=80']::text[], 'Pure cotton long kurti with ethnic block print. Loose fit, suitable for South Asian market. Sizes M-3XL available.', 'খাঁটি সুতির লং কুর্তি ঐতিহ্যবাহী ব্লক প্রিন্ট সহ। ঢিলেঢালা ফিট, দক্ষিণ এশীয় বাজারের জন্য উপযুক্ত। M-3XL সাইজ পাওয়া যায়।', 'https://detail.1688.com/offer/742193608527.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '742193608527'), 1, 4, 4500);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '742193608527'), 5, 19, 3850);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '742193608527'), 20, 99, 3300);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '742193608527'), 100, 9999, 2890);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('756402138976', 'Blank Cotton Short Sleeve T-Shirt Plain Custom Print', 'ফাঁকা সুতির শর্ট স্লিভ টি-শার্ট প্লেইন কাস্টম প্রিন্ট', '空白纯棉短袖T恤印花定制圆领', 'apparel', 10, 0.2, 0.0008, 30, 8, '中山市恒泰制衣厂', '广东', '中山市', 48000, 3210, 4.8, ARRAY['verified_factory', '24h_response', 'top_supplier', 'trade_assurance']::text[], ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&auto=format&fit=crop&q=80']::text[], '180gsm combed cotton blank t-shirt, OEM print available. 30+ colors in stock. OEM logo printing supported.', '১৮০gsm কম্বড সুতির ফাঁকা টি-শার্ট, OEM প্রিন্ট পাওয়া যায়। ৩০+ রঙ স্টকে আছে। OEM লোগো প্রিন্টিং সমর্থিত।', 'https://detail.1688.com/offer/756402138976.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '756402138976'), 10, 49, 1280);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '756402138976'), 50, 199, 980);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '756402138976'), 200, 999, 820);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '756402138976'), 1000, 9999, 690);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('739815247063', 'Korean Style Ins Fashion Shoulder Crossbody Handbag', 'কোরিয়ান স্টাইল ইনস ফ্যাশন শোল্ডার ক্রসবডি হ্যান্ডব্যাগ', '韩版ins潮小香风手提单肩斜挎女包', 'apparel', 2, 0.45, 0.0035, 30, 8, '广州市花都区狮岭皮具厂', '广东', '广州市', 6200, 1480, 4.6, ARRAY['verified_factory', '24h_response']::text[], ARRAY['https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80']::text[], 'PU leather quilted handbag with chain strap. 3-in-1 carry: hand/shoulder/crossbody. 12 colors.', 'PU চামড়ার কোয়েল্টেড হ্যান্ডব্যাগ চেইন স্ট্র্যাপ সহ। ৩-ইন-১ বহন: হাত/কাঁধ/ক্রসবডি। ১২টি রঙ।', 'https://detail.1688.com/offer/739815247063.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '739815247063'), 2, 9, 3580);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '739815247063'), 10, 29, 2890);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '739815247063'), 30, 99, 2350);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '739815247063'), 100, 9999, 1980);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('748293716540', 'Summer Ice Silk UV Sun Sleeves Arm Cover Gloves', 'গ্রীষ্মকালীন আইস সিল্ক UV সান স্লিভ আর্ম কভার গ্লাভস', '夏季冰丝防晒袖套手套骑行户外袖套', 'apparel', 20, 0.05, 0.0002, 30, 7, '义乌市韩尚针织有限公司', '浙江', '义乌市', 35000, 2890, 4.7, ARRAY['verified_factory', '24h_response', 'top_supplier']::text[], ARRAY['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1591348122449-02525d70379b?w=800&auto=format&fit=crop&q=80']::text[], 'UPF50+ ice silk sun sleeves for cycling/driving. Cooling effect, fingerless gloves attached.', 'সাইক্লিং/ড্রাইভিংয়ের জন্য UPF50+ আইস সিল্ক সান স্লিভ। কুলিং ইফেক্ট, আঙুল ছাড়া গ্লাভস সংযুক্ত।', 'https://detail.1688.com/offer/748293716540.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '748293716540'), 20, 99, 320);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '748293716540'), 100, 499, 240);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '748293716540'), 500, 1999, 190);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '748293716540'), 2000, 9999, 150);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('731925804637', 'TWS Wireless Bluetooth Earbuds Noise Cancelling Long Battery', 'TWS ওয়্যারলেস ব্লুটুথ ইয়ারবাড নয়েজ ক্যান্সেলিং দীর্ঘ ব্যাটারি', '无线蓝牙耳机入耳式运动降噪长续航', 'electronics', 5, 0.12, 0.0006, 25, 9, '深圳市华强北数码电子商行', '广东', '深圳市', 18500, 4250, 4.7, ARRAY['verified_factory', '24h_response', 'top_supplier', 'trade_assurance']::text[], ARRAY['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80']::text[], 'BT 5.3 TWS earbuds, ANC active noise cancelling, 40h total battery with case. OEM branding free.', 'BT 5.3 TWS ইয়ারবাড, ANC অ্যাক্টিভ নয়েজ ক্যান্সেলিং, কেস সহ ৪০ ঘণ্টা ব্যাটারি। OEM ব্র্যান্ডিং ফ্রি।', 'https://detail.1688.com/offer/731925804637.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '731925804637'), 5, 19, 1980);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '731925804637'), 20, 99, 1680);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '731925804637'), 100, 499, 1380);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '731925804637'), 500, 9999, 1150);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('745628193057', 'iPhone 15 Transparent Shockproof Silicone Phone Case', 'iPhone 15 ট্রান্সপারেন্ট শকপ্রুফ সিলিকন ফোন কেস', 'iPhone15透明防摔手机壳硅胶软壳', 'electronics', 20, 0.04, 0.00015, 35, 8, '深圳市宝安区凯利手机配件厂', '广东', '深圳市', 50000, 4820, 4.6, ARRAY['verified_factory', '24h_response', 'top_supplier']::text[], ARRAY['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1605236453806-6ff36851218e?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1551739440-5dd934d3a94a?w=800&auto=format&fit=crop&q=80']::text[], 'Clear TPU+PC hybrid shockproof case for iPhone 15 series. Raised lens edge, MagSafe compatible.', 'iPhone 15 সিরিজের জন্য পরিষ্কার TPU+PC হাইব্রিড শকপ্রুফ কেস। উঁচু লেন্স প্রান্ত, MagSafe সামঞ্জস্যপূর্ণ।', 'https://detail.1688.com/offer/745628193057.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '745628193057'), 20, 99, 280);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '745628193057'), 100, 499, 210);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '745628193057'), 500, 1999, 165);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '745628193057'), 2000, 9999, 120);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('752140896312', 'PD 20W Fast Charger Type-C Android iPhone Universal', 'PD 20W দ্রুত চার্জার Type-C অ্যান্ড্রয়েড আইফোন ইউনিভার্সাল', 'PD20W快充充电器type-c安卓苹果通用', 'electronics', 10, 0.08, 0.0003, 25, 9, '东莞市华联电子科技有限公司', '广东', '东莞市', 32000, 3680, 4.8, ARRAY['verified_factory', '24h_response', 'top_supplier', 'trade_assurance']::text[], ARRAY['https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1556228852-80b6e5eeff06?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1611078489935-0cb964de46d6?w=800&auto=format&fit=crop&q=80']::text[], 'GaN PD 20W USB-C wall charger. EU/UK/US plug optional. CE/FCC certified, supports iPhone 8-15.', 'GaN PD 20W USB-C ওয়াল চার্জার। EU/UK/US প্লাগ ঐচ্ছিক। CE/FCC প্রত্যয়িত, iPhone 8-15 সমর্থিত।', 'https://detail.1688.com/offer/752140896312.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '752140896312'), 10, 49, 980);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '752140896312'), 50, 199, 780);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '752140896312'), 200, 999, 650);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '752140896312'), 1000, 9999, 520);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('736947512803', '3-in-1 Magnetic Wireless Charging Stand Dock', '৩-ইন-১ ম্যাগনেটিক ওয়্যারলেস চার্জিং স্ট্যান্ড ডক', '三合一磁吸无线充电底座手机支架', 'electronics', 3, 0.3, 0.0018, 25, 9, '深圳市倍思创新科技有限公司', '广东', '深圳市', 9800, 1240, 4.7, ARRAY['verified_factory', 'top_supplier', 'trade_assurance']::text[], ARRAY['https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1622445275576-721325763afe?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1592890288564-76628a30a657?w=800&auto=format&fit=crop&q=80']::text[], 'MagSafe 3-in-1 wireless charger for phone/watch/earbuds. 15W fast charging, foldable travel design.', 'ফোন/ঘড়ি/ইয়ারবাডের জন্য MagSafe ৩-ইন-১ ওয়্যারলেস চার্জার। ১৫W দ্রুত চার্জিং, ভাঁজযোগ্য ভ্রমণ ডিজাইন।', 'https://detail.1688.com/offer/736947512803.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '736947512803'), 3, 9, 3580);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '736947512803'), 10, 49, 2980);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '736947512803'), 50, 199, 2580);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '736947512803'), 200, 9999, 2250);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('749182350674', 'Braided Type-C Cable 1m Fast Charging iPhone Android', 'ব্রেইডেড Type-C কেবল ১মি দ্রুত চার্জিং আইফোন অ্যান্ড্রয়েড', '编织type-c数据线1米苹果安卓快充线', 'electronics', 50, 0.05, 0.0002, 35, 7, '东莞市金辉线材有限公司', '广东', '东莞市', 48000, 4150, 4.6, ARRAY['verified_factory', '24h_response', 'top_supplier']::text[], ARRAY['https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1605236453806-6ff36851218e?w=800&auto=format&fit=crop&q=80']::text[], 'Nylon braided USB-C to Lightning cable, 1m. Supports PD 20W fast charge. 5 colors available.', 'নাইলন ব্রেইডেড USB-C থেকে লাইটনিং কেবল, ১মি। PD 20W দ্রুত চার্জ সমর্থন করে। ৫টি রঙ পাওয়া যায়।', 'https://detail.1688.com/offer/749182350674.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '749182350674'), 50, 199, 350);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '749182350674'), 200, 999, 260);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '749182350674'), 1000, 4999, 190);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '749182350674'), 5000, 9999, 140);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('734527819306', 'Stainless Steel 18K Gold Plated Bracelet for Women', 'স্টেইনলেস স্টিল 18K গোল্ড প্লেটেড ব্রেসলেট মহিলাদের জন্য', '不锈钢18K金包金手链女士时尚ins手链', 'jewelry', 10, 0.03, 0.0001, 50, 8, '义乌市宝瑞珠宝饰品有限公司', '浙江', '义乌市', 12500, 2150, 4.7, ARRAY['verified_factory', '24h_response', 'top_supplier']::text[], ARRAY['https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1560343776-97e7d202ff0e?w=800&auto=format&fit=crop&q=80']::text[], '18K gold-plated stainless steel bracelet, hypoallergenic, tarnish-resistant. 8 design styles.', '18K গোল্ড-প্লেটেড স্টেইনলেস স্টিল ব্রেসলেট, হাইপোঅ্যালার্জেনিক, মরিচ-প্রতিরোধী। ৮টি ডিজাইন স্টাইল।', 'https://detail.1688.com/offer/734527819306.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '734527819306'), 10, 49, 580);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '734527819306'), 50, 199, 420);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '734527819306'), 200, 999, 310);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '734527819306'), 1000, 9999, 220);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('743068219457', 'Vintage Baroque Pearl Stud Earrings for Women', 'ভিন্টেজ বারোক মুক্তা স্টাড কানের দুল মহিলাদের জন্য', '复古巴洛克珍珠耳钉女气质网红耳环', 'jewelry', 20, 0.01, 0.0001, 50, 7, '青岛市即墨区潮品饰品厂', '山东', '青岛市', 28000, 1820, 4.6, ARRAY['verified_factory', '24h_response']::text[], ARRAY['https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1560343776-97e7d202ff0e?w=800&auto=format&fit=crop&q=80']::text[], 'Faux baroque pearl stud earrings with alloy setting. 12 styles, suitable for daily and party wear.', 'অ্যালয় সেটিং সহ নকল বারোক মুক্তা স্টাড কানের দুল। ১২টি স্টাইল, দৈনন্দিন ও পার্টি পরিধানের জন্য উপযুক্ত।', 'https://detail.1688.com/offer/743068219457.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '743068219457'), 20, 99, 380);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '743068219457'), 100, 499, 280);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '743068219457'), 500, 1999, 210);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '743068219457'), 2000, 9999, 150);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('758291436017', 'Smart LED Bulb RGB Bluetooth Remote Color Changing', 'স্মার্ট LED বাল্ব RGB ব্লুটুথ রিমোট রঙ পরিবর্তনশীল', 'LED智能灯泡RGB蓝牙遥控变色节能灯', 'home', 10, 0.12, 0.0006, 35, 9, '中山市古镇光之韵照明有限公司', '广东', '中山市', 38000, 2950, 4.7, ARRAY['verified_factory', '24h_response', 'top_supplier', 'trade_assurance']::text[], ARRAY['https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=800&auto=format&fit=crop&q=80']::text[], '9W RGB+CCT smart LED bulb, E27/B22 base. Bluetooth app + IR remote. 16 million colors.', '9W RGB+CCT স্মার্ট LED বাল্ব, E27/B22 বেস। ব্লুটুথ অ্যাপ + IR রিমোট। ১৬ মিলিয়ন রঙ।', 'https://detail.1688.com/offer/758291436017.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '758291436017'), 10, 49, 1280);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '758291436017'), 50, 199, 980);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '758291436017'), 200, 999, 780);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '758291436017'), 1000, 9999, 580);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('741628903574', 'Kitchen Storage Container Plastic Sealed Jar Set', 'রান্নাঘর স্টোরেজ কন্টেইনার প্লাস্টিক সিল করা জার সেট', '厨房收纳盒塑料储物罐透明密封罐', 'home', 5, 0.45, 0.004, 35, 8, '台州市路桥区家家美家居用品有限公司', '浙江', '台州市', 22000, 1850, 4.6, ARRAY['verified_factory', '24h_response', 'top_supplier']::text[], ARRAY['https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=800&auto=format&fit=crop&q=80']::text[], 'Food-grade PP plastic airtight container set, 6-piece. BPA-free, microwave safe (no lid).', 'ফুড-গ্রেড PP প্লাস্টিক এয়ারটাইট কন্টেইনার সেট, ৬ পিস। BPA-মুক্ত, মাইক্রোওয়েভ নিরাপদ (ঢাকনা ছাড়া)।', 'https://detail.1688.com/offer/741628903574.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '741628903574'), 5, 19, 1850);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '741628903574'), 20, 99, 1480);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '741628903574'), 100, 499, 1180);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '741628903574'), 500, 9999, 980);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('746183529407', 'Portable Blender USB Rechargeable Mini Juicer Cup', 'পোর্টেবল ব্লেন্ডার USB রিচার্জেবল মিনি জুসার কাপ', '便携式榨汁机USB充电家用小型果汁杯', 'home', 3, 0.55, 0.0028, 35, 8, '佛山市顺德区小熊家电有限公司', '广东', '佛山市', 8500, 1620, 4.7, ARRAY['verified_factory', '24h_response', 'top_supplier']::text[], ARRAY['https://images.unsplash.com/photo-1567696911980-2eed69a46042?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1610725664285-7c57e6eeac3f?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=800&auto=format&fit=crop&q=80']::text[], '400ml portable personal blender, USB-C rechargeable, 6-blade. 15 charges per use, BPA-free.', '৪০০মিলি পোর্টেবল পার্সোনাল ব্লেন্ডার, USB-C রিচার্জেবল, ৬-ব্লেড। প্রতি ব্যবহারে ১৫ বার চার্জ, BPA-মুক্ত।', 'https://detail.1688.com/offer/746183529407.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '746183529407'), 3, 9, 2580);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '746183529407'), 10, 49, 2150);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '746183529407'), 50, 199, 1780);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '746183529407'), 200, 9999, 1480);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('751437628190', 'Aloe Vera Hydrating Face Mist Spray Soothing Portable', 'অ্যালোভেরা হাইড্রেটিং ফেস মিস্ট স্প্রে শান্তকারী পোর্টেবল', '芦荟保湿补水喷雾女舒缓肌肤便携', 'beauty', 10, 0.2, 0.0008, 45, 8, '广州市韩后化妆品有限公司', '广东', '广州市', 18000, 2280, 4.7, ARRAY['verified_factory', '24h_response', 'top_supplier', 'trade_assurance']::text[], ARRAY['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1631730486572-226d1f595b68?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&auto=format&fit=crop&q=80']::text[], '100ml aloe vera facial mist, oil-control + hydrating. Suitable for sensitive skin, OEM logo available.', '১০০মিলি অ্যালোভেরা ফেসিয়াল মিস্ট, তেল নিয়ন্ত্রণ + হাইড্রেটিং। সংবেদনশীল ত্বকের জন্য উপযুক্ত, OEM লোগো পাওয়া যায়।', 'https://detail.1688.com/offer/751437628190.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '751437628190'), 10, 49, 980);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '751437628190'), 50, 199, 780);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '751437628190'), 200, 999, 640);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '751437628190'), 1000, 9999, 520);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('738694217503', 'Electric Eyelash Curler USB Rechargeable Long Lasting', 'ইলেকট্রিক আইল্যাশ কার্লার USB রিচার্জেবল দীর্ঘস্থায়ী', '电动睫毛卷翘器USB充电持久定型', 'beauty', 5, 0.1, 0.0004, 45, 8, '深圳市美之约电子有限公司', '广东', '深圳市', 14200, 1450, 4.6, ARRAY['verified_factory', '24h_response']::text[], ARRAY['https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1612817288484-6f916006741a?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1580870069867-74c57ee1bb07?w=800&auto=format&fit=crop&q=80']::text[], 'Heated eyelash curler with 3 temp levels. 60-min USB charge lasts 30 days. Safe anti-scald head.', '৩টি তাপমাত্রা স্তর সহ গরম আইল্যাশ কার্লার। ৬০ মিনিটের USB চার্জ ৩০ দিন স্থায়ী হয়। নিরাপদ অ্যান্টি-স্কাল্ড হেড।', 'https://detail.1688.com/offer/738694217503.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '738694217503'), 5, 19, 1280);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '738694217503'), 20, 99, 1080);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '738694217503'), 100, 499, 880);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '738694217503'), 500, 9999, 720);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('747283159642', 'Kids DIY Playdough Tool Kit Clay Mold Toy Set', 'শিশু DIY প্লেডো টুল কিট ক্লে ছাঁচ খেলনা সেট', '儿童DIY彩泥工具套装橡皮泥模具玩具', 'toys', 5, 0.5, 0.003, 30, 8, '汕头市澄海区乐乐玩具厂', '广东', '汕头市', 16000, 1320, 4.7, ARRAY['verified_factory', '24h_response', 'top_supplier']::text[], ARRAY['https://images.unsplash.com/photo-1600003263720-95b45a4035d5?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=800&auto=format&fit=crop&q=80']::text[], '24-piece playdough tool kit with 12 colors of clay + molds. Non-toxic, ASTM/CPSIA certified.', '১২ রঙের ক্লে + ছাঁচ সহ ২৪-পিস প্লেডো টুল কিট। অ-বিষাক্ত, ASTM/CPSIA প্রত্যয়িত।', 'https://detail.1688.com/offer/747283159642.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '747283159642'), 5, 19, 1580);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '747283159642'), 20, 99, 1280);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '747283159642'), 100, 499, 1050);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '747283159642'), 500, 9999, 850);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('755416302897', 'Color Gel Pen Student Stationery Set 0.5mm Black', 'রঙ জেল কলম ছাত্র স্টেশনারি সেট 0.5মিমি কালো', '彩色中性笔学生文具套装0.5mm黑色', 'toys', 20, 0.3, 0.0015, 30, 8, '义乌市晨光文具贸易有限公司', '浙江', '义乌市', 45000, 3120, 4.8, ARRAY['verified_factory', '24h_response', 'top_supplier', 'trade_assurance']::text[], ARRAY['https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=800&auto=format&fit=crop&q=80']::text[], 'Pack of 20 colored gel pens, 0.5mm tip. Smooth-flow ink, suitable for school/office.', '২০টি রঙিন জেল কলমের প্যাক, 0.5মিমি টিপ। মসৃণ-প্রবাহ কালি, স্কুল/অফিসের জন্য উপযুক্ত।', 'https://detail.1688.com/offer/755416302897.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '755416302897'), 20, 99, 850);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '755416302897'), 100, 499, 680);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '755416302897'), 500, 1999, 540);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '755416302897'), 2000, 9999, 420);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('742319865720', 'Motorcycle Phone Holder Waterproof Shockproof Aluminum', 'মোটরসাইকেল ফোন হোল্ডার ওয়াটারপ্রুফ শকপ্রুফ অ্যালুমিনিয়াম', '摩托车手机支架防水防震铝合金导航架', 'automotive', 5, 0.25, 0.0015, 35, 9, '佛山市南海区骑士配件有限公司', '广东', '佛山市', 12500, 1680, 4.7, ARRAY['verified_factory', '24h_response', 'top_supplier']::text[], ARRAY['https://images.unsplash.com/photo-1549924231-f129b911e442?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1581349437898-cebbe9831942?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=800&auto=format&fit=crop&q=80']::text[], 'Aluminum motorcycle phone mount, IPX6 waterproof, fits 4.7-7" phones. One-hand release.', 'অ্যালুমিনিয়াম মোটরসাইকেল ফোন মাউন্ট, IPX6 ওয়াটারপ্রুফ, ৪.৭-৭" ফোনে ফিট করে। এক-হাতে রিলিজ।', 'https://detail.1688.com/offer/742319865720.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '742319865720'), 5, 19, 1480);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '742319865720'), 20, 99, 1180);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '742319865720'), 100, 499, 950);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '742319865720'), 500, 9999, 780);

INSERT INTO public.products (source_id, title_en, title_bn, title_zh, category, factory_moq, weight_kg, volume_cbm, markup_pct, quality_score, supplier_name, supplier_province, supplier_city, stock_total, order_count_30d, rating_overall, badges, images, description_en, description_bn, source_url) VALUES
  ('753184720961', 'Car Phone Charger 3-in-1 Cigarette Lighter Dual USB', 'গাড়ির ফোন চার্জার ৩-ইন-১ সিগারেট লাইটার ডুয়াল USB', '车载手机充电器一拖三点烟器双USB', 'automotive', 10, 0.09, 0.0004, 35, 8, '东莞市车元素电子有限公司', '广东', '东莞市', 28000, 2340, 4.6, ARRAY['verified_factory', '24h_response', 'top_supplier']::text[], ARRAY['https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=800&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1556228852-80b6e5eeff06?w=800&auto=format&fit=crop&q=80']::text[], '3-port car charger (2 USB + 1 Type-C PD). Total 42W output. LED voltage display.', '৩-পোর্ট গাড়ির চার্জার (২ USB + ১ Type-C PD)। মোট ৪২W আউটপুট। LED ভোল্টেজ ডিসপ্লে।', 'https://detail.1688.com/offer/753184720961.html');

INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '753184720961'), 10, 49, 680);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '753184720961'), 50, 199, 540);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '753184720961'), 200, 999, 420);
INSERT INTO public.price_tiers (product_id, qty_min, qty_max, price_cny_fen) VALUES ((SELECT id FROM public.products WHERE source_id = '753184720961'), 1000, 9999, 320);

