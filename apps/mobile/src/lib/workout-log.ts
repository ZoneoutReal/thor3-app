// Durable, clobber-safe writes for the synced logs map and set-completion list.
//
// The day logger (DayLogger) and the strength view (WorkoutMode) can be mounted
// at the same time — WorkoutMode is embedded inside the logger on strength days —
// and both write to the SAME store-backed `logs` map and `sets` list, which the
// server replaces wholesale on each push. If each component wrote its own
// in-memory snapshot, the last writer would drop the other's keys. So every
// durable write here is a read-modify-write against the synchronous store (see
// store.ts — always current, single-threaded), which keeps disjoint key
// namespaces (cardio steps / rpe / notes vs. strength reps / weights) from wiping
// each other.

import { getProfileId } from './profiles';
import { getItem, setItem } from './store';
import { queuePush, type LoggedValue } from './sync';

const logsKey = (pid: string | null, program: string) =>
  pid ? `thor3-logs-${pid}-${program}` : `thor3-logs-${program}`;
const setsKey = (pid: string | null, program: string) =>
  pid ? `thor3-sets-${pid}-${program}` : `thor3-sets-${program}`;

// Local deletion tombstones. The server merge (mergeServer*) is a union, so a
// day/set/log the user UN-did would otherwise resurrect from the server row on
// the next pull, before this device's removal has synced. We record removed ids
// locally and subtract them from every merge; re-doing the action clears the mark.
type TombKind = 'days' | 'sets' | 'logs';
const tombKey = (kind: TombKind, pid: string | null, program: string) =>
  pid ? `thor3-tomb-${kind}-${pid}-${program}` : `thor3-tomb-${kind}-${program}`;

function readTomb(kind: TombKind, program: string): Set<string> {
  try {
    const raw = getItem(tombKey(kind, getProfileId(), program));
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

export function markTombstone(kind: TombKind, program: string, id: string, removed: boolean) {
  const s = readTomb(kind, program);
  if (removed ? s.has(id) : !s.has(id)) return; // already in the desired state
  if (removed) s.add(id);
  else s.delete(id);
  setItem(tombKey(kind, getProfileId(), program), JSON.stringify([...s]));
}

export function withoutTombstoned(kind: TombKind, program: string, ids: Iterable<string>): string[] {
  const t = readTomb(kind, program);
  return [...new Set(ids)].filter((id) => !t.has(id));
}

export function readLogs(program: string): Record<string, LoggedValue> {
  const pid = getProfileId();
  try {
    const raw = getItem(logsKey(pid, program)) ?? getItem(`thor3-logs-${program}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function readSets(program: string): string[] {
  const pid = getProfileId();
  try {
    const raw = getItem(setsKey(pid, program)) ?? getItem(`thor3-sets-${program}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Set (or clear, when value is blank) one log entry; returns the full updated map.
export function writeLog(
  program: string,
  key: string,
  value: string,
  opts: { metric?: string; week?: number } = {}
): Record<string, LoggedValue> {
  const pid = getProfileId();
  const map = readLogs(program);
  // Store the value RAW. Trimming here (on every keystroke of a controlled input)
  // reverts trailing spaces, which makes it impossible to type a space in notes.
  if (value.trim() === '') {
    delete map[key];
    markTombstone('logs', program, key, true);
  } else {
    map[key] = { v: value, m: opts.metric, w: opts.week };
    markTombstone('logs', program, key, false);
  }
  setItem(logsKey(pid, program), JSON.stringify(map));
  queuePush({ logs: map });
  return map;
}

// Flip one set's completion; returns the full updated array.
export function writeSetDone(program: string, id: string, done: boolean): string[] {
  const pid = getProfileId();
  const cur = new Set(readSets(program));
  if (done) cur.add(id);
  else cur.delete(id);
  markTombstone('sets', program, id, !done);
  const arr = [...cur];
  setItem(setsKey(pid, program), JSON.stringify(arr));
  queuePush({ sets: arr });
  return arr;
}

// Pull server values down into local (local wins) and persist. Mount-time
// hydration only — no queuePush, since this originates no user change.
export function mergeServerLogs(
  program: string,
  serverLogs: Record<string, LoggedValue>
): Record<string, LoggedValue> {
  const pid = getProfileId();
  const merged = { ...(serverLogs ?? {}), ...readLogs(program) };
  for (const k of readTomb('logs', program)) delete merged[k]; // keep local clears
  setItem(logsKey(pid, program), JSON.stringify(merged));
  return merged;
}

export function mergeServerSets(program: string, serverSets: string[]): string[] {
  const pid = getProfileId();
  const merged = withoutTombstoned('sets', program, [...(serverSets ?? []), ...readSets(program)]);
  setItem(setsKey(pid, program), JSON.stringify(merged));
  return merged;
}
