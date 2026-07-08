-- THOR3 data-durability: workout progress must never be silently lost as we
-- keep developing. Three layers, all additive:
--   1) Row-level history — capture the prior state before every UPDATE/DELETE on
--      progress, so an accidental overwrite or `delete from progress` is fully
--      recoverable (one query, see supabase/RUNBOOK.md).
--   2) Daily full snapshot — belt-and-suspenders against a TRUNCATE/DROP, which
--      row-level triggers do not fire on.
-- Nothing here changes app behavior; it only records.

-- 1) Change history -----------------------------------------------------------
create table if not exists public.progress_history (
  id bigint generated always as identity primary key,
  profile text,
  program text,
  days jsonb,
  sets jsonb,
  op text,
  changed_at timestamptz not null default now()
);
alter table public.progress_history enable row level security;
-- No policies: service-role only, like every other table here.

-- AFTER trigger: it records the prior row but cannot alter the write. (A BEFORE
-- trigger returning OLD would silently REVERT every update — i.e. block saves.)
create or replace function public.log_progress_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.progress_history (profile, program, days, sets, op)
  values (OLD.profile, OLD.program, OLD.days, OLD.sets, TG_OP);
  return null;
end;
$$;

drop trigger if exists progress_audit on public.progress;
create trigger progress_audit
  after update or delete on public.progress
  for each row execute function public.log_progress_change();

-- 2) Daily full snapshot ------------------------------------------------------
create table if not exists public.progress_snapshots (
  snapshot_at timestamptz not null default now(),
  rows jsonb not null
);
alter table public.progress_snapshots enable row level security;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'thor3-progress-snapshot') then
    perform cron.unschedule('thor3-progress-snapshot');
  end if;
end $$;

select cron.schedule(
  'thor3-progress-snapshot',
  '17 5 * * *',  -- 05:17 UTC daily (~00:17 Central), clear of the reminder ticks
  $job$
    insert into public.progress_snapshots (rows)
    select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.progress p;
  $job$
);
