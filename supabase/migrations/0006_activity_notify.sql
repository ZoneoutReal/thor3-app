-- Per-profile toggle for "someone finished a workout" family notifications.
-- Additive and safe (see supabase/RUNBOOK.md): a new column with a default,
-- no rewrite of existing progress. Defaults on so the feature is live for
-- everyone until they opt out.
alter table public.profiles
  add column if not exists activity_notify boolean not null default true;
