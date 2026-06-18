-- Migration 0009: admin role on profiles
--
-- Adds an is_admin boolean to profiles. Used by middleware to gate
-- /admin/* routes. The RLS policy on profiles already lets users
-- read their own row, so they can read their own is_admin flag.

begin;

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Backfill the seed admin. The profiles table stores `email`
-- directly (denormalized from auth.users on signup), so we can
-- match against it without a join.
update public.profiles
  set is_admin = true
  where lower(email) in (
    'mlsjahid.cn@gmail.com'
  );

-- Helpful index for admin lookups (rare, but cheap)
create index if not exists idx_profiles_is_admin
  on public.profiles (is_admin)
  where is_admin = true;

-- Extend the auth trigger so future signups matching the admin email
-- are auto-promoted. Idempotent: uses ON CONFLICT and re-creates the
-- function in place.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (
    new.id,
    new.email,
    case
      when lower(new.email) in ('mlsjahid.cn@gmail.com') then true
      else false
    end
  )
  on conflict (id) do update
    set is_admin = public.profiles.is_admin
                 or excluded.is_admin;
  return new;
end;
$$;

commit;
