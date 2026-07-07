-- THOR3 push-notification backend (Supabase project: thor3 / etcycopvymrrkrvsshbn)
-- No secrets live here. VAPID keys + cron secret are inserted separately into
-- public.app_config (see supabase/README.md) so they stay out of the repo.

-- Web-push subscriptions. Only the service_role (edge functions) touches this.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
-- No policies on purpose: anon has no access; edge functions use the service role.

-- Server-side config/secrets (VAPID private key, cron secret). RLS on, no
-- policies -> only the service_role can read it.
create table if not exists public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;

-- Daily reminder at 11:00 UTC (= 06:00 America/Chicago during CDT). The cron
-- secret is read from app_config so no secret appears in this migration.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'thor3-daily-reminder',
  '0 11 * * *',
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
