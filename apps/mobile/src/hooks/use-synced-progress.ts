// Day-completion state for the on-screen (profile, program), local-first with a
// shared-server union. Ported from the PWA hook; the storage calls changed
// (localStorage -> the synchronous store) and the mount/reset effects were
// rewritten to the idiomatic non-effect patterns (lazy init + reset-during-render
// on key change), leaving only the genuine server-pull as an effect.

import { useCallback, useEffect, useState } from 'react';

import { getPasscode, getProfileId } from '@/lib/profiles';
import { getItem, setItem } from '@/lib/store';
import { pullAll, queuePush, type Snapshot } from '@/lib/sync';

function readDone(key: string, legacyKey: string): Set<string> {
  try {
    const raw = getItem(key) ?? getItem(legacyKey);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

export function useSyncedProgress(programId: string, profileId: string | null, unlocked: boolean) {
  const key = profileId ? `thor3-progress-${profileId}-${programId}` : `thor3-progress-${programId}`;
  const legacyKey = `thor3-progress-${programId}`;

  // Local-first: instant paint from this device (profile-scoped, falling back to
  // any pre-multiuser progress). Reloaded when the (profile, program) key changes,
  // via the React "adjust state when a dependency changes" render-time pattern.
  const [done, setDone] = useState<Set<string>>(() => readDone(key, legacyKey));
  const [seenKey, setSeenKey] = useState(key);
  if (key !== seenKey) {
    setSeenKey(key);
    setDone(readDone(key, legacyKey));
  }

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Pull the shared snapshot on unlock; union my server progress into local so
  // nothing is lost across devices, then push the union back up if it grew.
  useEffect(() => {
    if (!unlocked) return;
    let alive = true;
    (async () => {
      const pc = getPasscode();
      const pid = getProfileId();
      if (!pc || !pid) return;
      const r = await pullAll(pc);
      if (!alive || !r.ok || !r.snapshot) return;
      setSnapshot(r.snapshot);
      const mine = r.snapshot.progress.find((p) => p.profile === pid && p.program === programId);
      if (mine) {
        setDone((prev) => {
          const union = new Set(prev);
          mine.days.forEach((d) => union.add(d));
          const arr = [...union];
          setItem(key, JSON.stringify(arr));
          if (arr.length !== mine.days.length) queuePush({ days: arr });
          return union;
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [unlocked, programId, key]);

  const refresh = useCallback(async () => {
    const pc = getPasscode();
    if (!pc) return;
    setRefreshing(true);
    const r = await pullAll(pc);
    if (r.ok && r.snapshot) setSnapshot(r.snapshot);
    setRefreshing(false);
  }, []);

  const toggle = useCallback(
    (week: number, day: number, label?: string) => {
      setDone((prev) => {
        const id = `${week}-${day}`;
        const next = new Set(prev);
        const wasDone = next.has(id);
        if (wasDone) next.delete(id);
        else next.add(id);
        const arr = [...next];
        setItem(key, JSON.stringify(arr));
        // Only tag the "just finished X" hint when newly completing (not undo).
        queuePush({ days: arr, ...(!wasDone && label ? { done: { id, label } } : {}) });
        return next;
      });
    },
    [key]
  );

  const isDone = useCallback((week: number, day: number) => done.has(`${week}-${day}`), [done]);

  return { isDone, toggle, count: done.size, done, snapshot, refresh, refreshing };
}
