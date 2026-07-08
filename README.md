# THOR3

A private, installable workout PWA for a two-person family training group. It
runs the SFAS-prep conditioning programs (a 10-week and a 14-week plan) with
per-day logging, a strength sheet with built-in timers, shared progress across
both phones, and daily push reminders at each person's own time.

Live: https://zoneoutreal.github.io/thor3-app

## What it does

- **Weekly plan** — every day of the program (runs, rucks, strength, APFT,
  rest) as an expandable card. A per-profile **start date** anchors "Today" to
  the right week and day; the week selector jumps there on open.
- **Program picker** — switch between the 10-week and 14-week plans in Settings.
  Progress is tracked separately per program.
- **Day logger** — record reps/times per step with countdown and stopwatch
  timers, see "last time" values week over week, and log effort (RPE) plus a
  free-text note for how the session went.
- **Strength sheet** — the strength-day workout with a dynamic warm-up, a
  workout mode (loggable sets with rest timers) and a reference mode.
- **Together tab** — both members' progress side by side: overall %, weeks
  completed, and a week-by-week heat grid.
- **Reminders** — per-profile daily push at a chosen time; skipped on days
  you've already logged.
- **Offline-first** — local cache with a durable outbox that retries and flushes
  when the device comes back online, so a flaky connection never loses a log.

## Architecture

Static Next.js export hosted on GitHub Pages; all server work runs in Supabase
edge functions (no Vercel, no long-running server).

- **Frontend** — Next.js (App Router) exported to static HTML in `out/`,
  deployed by `.github/workflows/deploy.yml` on push to `main`. Identity and
  per-profile preferences live in `localStorage`; shared workout data syncs to
  Supabase.
- **Backend** — Supabase project `thor3` (`etcycopvymrrkrvsshbn`). Tables are
  RLS-locked with no policies; the edge functions (service role) are the only
  readers/writers, gated by a shared **family passcode**. See
  [`supabase/README.md`](supabase/README.md).
- **Push** — Web Push (VAPID). A 15-minute cron hits the `push-send` function,
  which notifies only the profiles whose reminder time matches the tick.

Key modules:

| Path | Role |
|---|---|
| `src/app/page.tsx` | Main screen: week selector, day cards, settings, gate |
| `src/app/DayLogger.tsx` | Per-day step logging, timers, RPE + notes |
| `src/app/StrengthSheet.tsx` | Strength workout (workout + reference modes) |
| `src/app/Together.tsx` | Shared progress view |
| `src/lib/program-data.ts` | Program + strength content (the source of truth) |
| `src/lib/program-prefs.ts` | Per-profile program choice + start-date anchor |
| `src/lib/sync.ts` | Passcode-gated client + durable push queue |
| `supabase/functions/` | `progress`, `push-subscribe`, `push-send` |

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static export to out/ (also full typecheck)
npm run lint
```

`.env.local` holds the public client config (Supabase URL + publishable key,
VAPID public key, base path). All of it is safe to ship; real secrets and the
family passcode live only in the Supabase `app_config` table, never in the repo.

## Deploy

Push to `main`. GitHub Actions builds the static export and publishes it to
GitHub Pages. Backend changes (migrations, edge functions) are applied to the
Supabase project directly.

## Data safety

Workout progress is precious and hard to re-enter. Before any DB change, read
[`supabase/RUNBOOK.md`](supabase/RUNBOOK.md) — migrations are additive only, and
there is a change-history trigger plus a daily snapshot for recovery.
