-- Migration 0008: page_views (self-hosted analytics)
--
-- Records every page view. Lightweight Plausible-style. 90-day retention
-- is enough; downstream rollups can summarize weekly.

begin;

create table if not exists public.page_views (
  id          bigserial primary key,
  path        text not null,
  referrer    text,
  user_agent  text,
  session_id  text,
  country     text,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_page_views_path_recent
  on public.page_views (path, recorded_at desc);

create index if not exists idx_page_views_recorded_desc
  on public.page_views (recorded_at desc);

create index if not exists idx_page_views_session
  on public.page_views (session_id, recorded_at desc);

alter table public.page_views enable row level security;

-- No public read (analytics is internal); ops reads use service-role.
-- No insert policy — only the server endpoint writes (service-role).

commit;
