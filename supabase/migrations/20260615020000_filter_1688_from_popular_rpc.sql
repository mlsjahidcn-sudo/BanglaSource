-- Migration 0030: filter 1688-source products from the public
-- popular_by_views() RPC.
--
-- The platform is now hand-picked products (Pinduoduo / Taobao /
-- trendy China sources) added via /admin/products/new, NOT Apify
-- 1688 imports. 1688 products still exist in the DB (the Apify
-- pipeline can keep running, ops can see them) but they must NOT
-- surface on the public home carousels. The source_url pattern
-- `https://detail.1688.com/...` is the only signal we have without
-- a dedicated `source` column.
--
-- This adds the same `not ilike '%1688.com%'` filter the JS layer
-- (src/lib/source-filter.ts) applies to getCatalog / getProduct /
-- similarProducts / recentlyChanged.

create or replace function public.popular_by_views(
  p_since timestamptz,
  p_limit int
) returns table (
  source_id text,
  title_en text,
  title_bn text,
  image text,
  min_bdt int,
  category text,
  rank_score int
)
language plpgsql
stable
as $$
begin
  return query
    with recent_views as (
      select
        split_part(path, '/', 3) as sid,
        count(*) as view_count
      from public.page_views
      where
        path like '/products/%'
        and recorded_at >= p_since
      group by split_part(path, '/', 3)
    )
    select
      p.source_id::text,
      p.title_en,
      p.title_bn,
      (p.images[1])::text as image,
      coalesce(
        (
          select ceil(
            (min(pt.price_cny_fen)::numeric / 100.0) * 1.65
          )::int
          from public.price_tiers pt
          where pt.product_id = p.id
        ),
        0
      ) as min_bdt,
      p.category,
      rv.view_count::int as rank_score
    from recent_views rv
    inner join public.products p on p.source_id = rv.sid
    where p.active = true
      and p.source_url not ilike '%1688.com%'
    order by rv.view_count desc, p.source_id
    limit p_limit;
end;
$$;

revoke all on function public.popular_by_views(timestamptz, int) from public;
grant execute on function public.popular_by_views(timestamptz, int) to service_role;
