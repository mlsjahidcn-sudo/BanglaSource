-- Migration 0028: popular_by_views() RPC
--
-- Phase 23: backend for the "Popular this week" home
-- carousel. A SQL function is more efficient than a
-- JS-side group-by when the page_views table has
-- >100k rows in the 7-day window.
--
-- Strategy: filter the window with the
-- (path, recorded_at DESC) index, then group by
-- the source_id embedded in the URL path.
--
--   path = '/products/<source_id>'
--   split_part(path, '/', 3) extracts the source_id.
--
-- We INNER JOIN products on source_id to drop
-- deactivated products + allow the planner to use
-- the products_source_id_key index.
--
-- Returns a uniform PopularProduct shape so the home
-- carousel doesn't need to know which query produced
-- the row. `rank_score` is the raw view count (used
-- for sort tie-breaking in the JS layer).

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
    order by rv.view_count desc, p.source_id
    limit p_limit;
end;
$$;

revoke all on function public.popular_by_views(timestamptz, int) from public;
grant execute on function public.popular_by_views(timestamptz, int) to service_role;
