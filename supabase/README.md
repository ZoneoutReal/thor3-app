# THOR3 push backend (Supabase)

Replaces the old Next.js server actions so the app can ship as a static export
to GitHub Pages. Project ref: `etcycopvymrrkrvsshbn` (`thor3`).

## Pieces

- `migrations/0001_push.sql` — `push_subscriptions` + `app_config` tables (RLS
  locked, no policies) and a `pg_cron` job that calls `push-send` daily at
  11:00 UTC (06:00 America/Chicago during CDT).
- `functions/push-subscribe` — client-facing. Actions: `subscribe`,
  `unsubscribe`, `test`. Reads VAPID from `app_config`, writes subscriptions.
- `functions/push-send` — cron-only. Gated by an `x-cron-secret` header checked
  against `app_config.cron_secret`. Sends to all subscriptions and prunes any
  that return 404/410 (dead endpoints).

Both functions are deployed with `verify_jwt = false` (personal single-user app;
`push-send` is protected by the cron secret).

## Secrets (never committed)

The VAPID keys and cron secret live in `public.app_config`, not in the repo:

```sql
insert into public.app_config (key, value) values
  ('vapid_public',  '<NEXT_PUBLIC_VAPID_PUBLIC_KEY>'),
  ('vapid_private', '<VAPID_PRIVATE_KEY>'),
  ('vapid_subject', 'mailto:studio@thetotemworks.com'),
  ('cron_secret',   '<random hex>')
on conflict (key) do update set value = excluded.value;
```

## Client config (public, safe to ship)

The static app calls `push-subscribe` using two public values baked in at build
time (also set in `.github/workflows/deploy.yml`):

- `NEXT_PUBLIC_SUPABASE_URL=https://etcycopvymrrkrvsshbn.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>`
