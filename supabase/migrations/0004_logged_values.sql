-- Fitbod-style recorded values: each logged set can carry a number (reps, run
-- time, distance) keyed by "week-day-step". Stored as a jsonb map on the shared
-- progress row so it rides the existing sync, gate, history, and snapshot layers.

alter table public.progress
  add column if not exists logs jsonb not null default '{}'::jsonb;

-- History captures logs too, so a bad overwrite of recorded numbers is recoverable.
alter table public.progress_history
  add column if not exists logs jsonb;

create or replace function public.log_progress_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.progress_history (profile, program, days, sets, logs, op)
  values (OLD.profile, OLD.program, OLD.days, OLD.sets, OLD.logs, TG_OP);
  return null;
end;
$$;
-- The AFTER UPDATE/DELETE trigger from 0003 already points at this function.
