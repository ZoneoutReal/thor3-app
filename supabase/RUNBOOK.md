# THOR3 data safety — don't erase workout progress

Progress lives in Supabase (`public.progress`, keyed by profile). Each phone keeps
a localStorage cache and syncs; on load it **unions** local with the server, so a
normal frontend deploy, a PWA reinstall, or a cleared browser never loses data.
The server is the anchor. Protect the server data and everything else follows.

## Golden rules (while developing)

1. **Migrations are additive only.** `create table if not exists`, `add column if
   not exists`. Never `drop` / `rename` / retype the `progress` or `profiles`
   tables, and never `delete` / `truncate` `progress` on the live project.
2. **Never test-write to `jon` / `brody`.** Use a throwaway profile whose id starts
   with `_` (e.g. `_dev`). The app hides `_`-prefixed profiles; tear it down when
   done. See "Safe testing" below.
3. **Never change a localStorage key format without a legacy fallback.** A device
   that suddenly reads "empty" could push empty up. (See how `page.tsx` /
   `WorkoutMode.tsx` fall back to the pre-multiuser key.)

## The safety net (already live, migration 0003)

- **`progress_history`** — an `AFTER UPDATE OR DELETE` trigger records the *prior*
  state of a row before every change. Any bad overwrite or delete is recoverable.
- **`progress_snapshots`** — a daily full snapshot (`05:17 UTC`) of all progress,
  in case of a `truncate`/`drop` (which row triggers don't catch).
- The reminder cron runs every 15 min, which also keeps the free-tier project from
  idling into a pause.

## Recovery

See a profile's change history (newest first):
```sql
select id, op, days, sets, changed_at
from public.progress_history
where profile = 'jon'
order by id desc;
```

Restore a profile to its most recent non-empty state:
```sql
insert into public.progress (profile, program, days, sets)
select profile, program, days, sets
from public.progress_history
where profile = 'jon' and jsonb_array_length(days) > 0
order by id desc limit 1
on conflict (profile, program) do update
  set days = excluded.days, sets = excluded.sets;
```

Restore everything from the latest daily snapshot:
```sql
insert into public.progress (profile, program, days, sets)
select (r->>'profile'), (r->>'program'),
       coalesce(r->'days','[]'::jsonb), coalesce(r->'sets','[]'::jsonb)
from public.progress_snapshots,
     lateral jsonb_array_elements(rows) as r
where snapshot_at = (select max(snapshot_at) from public.progress_snapshots)
on conflict (profile, program) do update
  set days = excluded.days, sets = excluded.sets;
```

## Safe testing

```sql
-- create a hidden throwaway profile
insert into public.profiles (id, display_name, sort) values ('_dev','DEV',999)
on conflict (id) do nothing;
-- ... run write tests against profile '_dev' ...
-- tear down
delete from public.progress where profile='_dev';
delete from public.progress_history where profile='_dev';
delete from public.profiles where id='_dev';
```
