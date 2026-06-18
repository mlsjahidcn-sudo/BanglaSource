-- Migration 0005: Drop the misconfigured set_updated_at trigger on sync_runs
--
-- The `set_updated_at()` function tries to update NEW.updated_at, but
-- the sync_runs table doesn't have that column. That made any UPDATE
-- on sync_runs fail silently (the JS client doesn't surface trigger
-- errors), so the route's final "closeout" update was never persisted.
--
-- sync_runs doesn't really need an updated_at column — it's a
-- run-record that gets created and then finalized; we record the
-- final state in finished_at. Drop the trigger.

begin;

drop trigger if exists trg_sync_runs_updated_at on public.sync_runs;

commit;
