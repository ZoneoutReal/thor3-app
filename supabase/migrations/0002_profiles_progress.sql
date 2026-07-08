-- THOR3 multi-user: profiles, shared progress, per-profile reminder times.
-- Extends the push backend (0001). Tables stay RLS-locked (service_role only);
-- the edge functions do all reads/writes. Profile display names, the family
-- passcode, and all secrets live in the DB (seeded out-of-band), never here, so
-- the public repo carries no personal identities.

-- Per-user profile + reminder settings. Seeded out-of-band (ids + display names).
create table if not exists public.profiles (
  id text primary key,
  display_name text not null,
  reminder_enabled boolean not null default true,
  reminder_hour int not null default 6,        -- local hour (0-23)
  reminder_min int not null default 0,          -- local minute, 15-min buckets
  tz text not null default 'America/Chicago',
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- No policies on purpose: anon has no access; edge functions use the service role.

-- Shared workout progress: one row per (profile, program). days/sets mirror the
-- app's localStorage so both phones can see each other's completion state.
create table if not exists public.progress (
  profile text not null references public.profiles(id) on delete cascade,
  program text not null default '10week',
  days jsonb not null default '[]'::jsonb,       -- ["week-day", ...]
  sets jsonb not null default '[]'::jsonb,        -- strength set ids
  updated_at timestamptz not null default now(),
  primary key (profile, program)
);
alter table public.progress enable row level security;

-- Tag each push subscription with its owner so the two phones become two
-- separate notification channels. Nullable + FK: legacy rows and inserts keep working.
alter table public.push_subscriptions
  add column if not exists profile text references public.profiles(id);

-- Reminders now fire per-profile at each profile's own local time, so the old
-- once-a-day job becomes a 15-minute tick; push-send decides who is due.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'thor3-daily-reminder') then
    perform cron.unschedule('thor3-daily-reminder');
  end if;
end $$;

select cron.schedule(
  'thor3-reminder-tick',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := 'https://etcycopvymrrkrvsshbn.functions.supabase.co/push-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select value from public.app_config where key = 'cron_secret')
      ),
      body := '{}'::jsonb
    );
  $job$
);
