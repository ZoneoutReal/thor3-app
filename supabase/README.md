# THOR3 backend (Supabase)

Replaces the old Next.js server actions so the app can ship as a static export
to GitHub Pages. Project ref: `etcycopvymrrkrvsshbn` (`thor3`).

The app is multi-user (two brothers, two phones). Progress is shared through the
DB; each phone keeps a fast local copy and syncs. All tables are RLS-locked with
no policies — the edge functions (service role) are the only readers/writers.

## Tables (migrations)

- `0001_push.sql` — `push_subscriptions` (+ `profile` added in 0002) and
  `app_config` (secrets: VAPID keys, `cron_secret`, `family_passcode`).
- `0002_profiles_progress.sql`
  - `profiles` — one row per family member (`id`, `display_name`, per-profile
    `reminder_hour` / `reminder_min` / `reminder_enabled` / `tz`, `sort`).
    Seeded out-of-band (see below) so no personal names live in the repo.
  - `progress` — shared workout state, one row per `(profile, program)`:
    `days` (completed `"week-day"` ids) and `sets` (strength set ids).
  - adds `push_subscriptions.profile` so each subscription is tagged to a person.
  - reschedules the reminder cron from once-daily to a **15-minute tick**
    (`thor3-reminder-tick`), since reminders now fire at each profile's own time.

## Functions

- `progress` — client-facing, **family-passcode gated**. Actions:
  - `pull` — validate passcode; return all profiles + all progress (drives the
    gate's profile picker and the Together tab).
  - `push-progress` — upsert one profile's progress. Partial: only the `days` or
    `sets` provided are written, so day-completion (main screen) and set-logging
    (strength sheet) never clobber each other.
  - `set-reminder` — update a profile's reminder hour/minute/enabled.
- `push-subscribe` — client-facing, passcode gated. `subscribe` (tags the row
  with `profile`), `unsubscribe`, `test`.
- `push-send` — **cron-only** (`x-cron-secret`). Runs every 15 min; sends only to
  profiles whose own local reminder time matches this tick, personalized and on a
  per-profile `tag`. Prunes dead (404/410) endpoints. A `{ profile }` body forces
  a targeted send (bypasses the time check) for manual testing.

All three deploy with `verify_jwt = false` — they implement their own auth
(family passcode for the client functions, cron secret for `push-send`).

## Secrets + seed (never committed)

VAPID keys, `cron_secret`, the `family_passcode`, and the profile rows (which
hold the real display names) are inserted straight into the DB, not the repo:

```sql
insert into public.app_config (key, value) values
  ('vapid_public',    '<NEXT_PUBLIC_VAPID_PUBLIC_KEY>'),
  ('vapid_private',   '<VAPID_PRIVATE_KEY>'),
  ('vapid_subject',   'mailto:studio@thetotemworks.com'),
  ('cron_secret',     '<random hex>'),
  ('family_passcode', '<shared code the family types at the gate>')
on conflict (key) do update set value = excluded.value;

insert into public.profiles (id, display_name, sort) values
  ('<id>', '<Display Name>', 1), ('<id2>', '<Display Name 2>', 2)
on conflict (id) do update set display_name = excluded.display_name;
```

## Client config (public, safe to ship)

The static app calls the functions with two public values baked in at build time
(also set in `.github/workflows/deploy.yml`):

- `NEXT_PUBLIC_SUPABASE_URL=https://etcycopvymrrkrvsshbn.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>`

The family passcode is entered once at the gate and stored in the device's
localStorage; it is the key to every progress/subscribe call.
