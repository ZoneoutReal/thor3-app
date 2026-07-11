// Client for the `progress` edge function: the shared source of truth for both
// brothers' workout progress and per-profile reminder settings. Every call is
// authenticated with the family passcode the user entered at the gate. This is a
// verbatim port of the PWA's sync client — same edge-function contract — with
// three platform swaps: EXPO_PUBLIC_* env, the local store for the outbox, and
// NetInfo/AppState (instead of the browser `online` event) to trigger flushes.

import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { DEV_BYPASS, mockSnapshot } from './dev-bypass';
import { getPasscode, getProfileId, type Profile } from './profiles';
import { DEFAULT_PROGRAM } from './program-prefs';
import { getItem, removeItem, setItem } from './store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const FN_URL = `${SUPABASE_URL}/functions/v1/progress`;

// A recorded value for one logged step: v = the number/time the user entered,
// m = semantic metric (for week-over-week history), w = week it was logged in.
export type LoggedValue = { v: string; m?: string; w?: number };

export type ProgressRow = {
  profile: string;
  program: string;
  days: string[];
  sets: string[];
  logs: Record<string, LoggedValue>;
  updated_at: string;
};

export type Snapshot = { profiles: Profile[]; progress: ProgressRow[] };

async function call(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!SUPABASE_URL) return { error: 'not configured' };
  try {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ANON ? { apikey: ANON, Authorization: `Bearer ${ANON}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { error: body.error ?? `HTTP ${res.status}`, status: res.status };
    return body;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'request failed' };
  }
}

// Validate a passcode and fetch everyone's progress + profiles in one shot.
export async function pullAll(passcode: string): Promise<{ ok: boolean; snapshot?: Snapshot; error?: string }> {
  if (DEV_BYPASS) return { ok: true, snapshot: mockSnapshot };
  const r = await call({ action: 'pull', passcode });
  if (r.error) return { ok: false, error: String(r.error) };
  return {
    ok: true,
    snapshot: { profiles: (r.profiles as Profile[]) ?? [], progress: (r.progress as ProgressRow[]) ?? [] },
  };
}

export async function setReminder(profile: string, r: { hour?: number; min?: number; enabled?: boolean }) {
  if (DEV_BYPASS) return { success: true };
  const passcode = getPasscode();
  if (!passcode) return { error: 'locked' };
  return call({ action: 'set-reminder', passcode, profile, ...r });
}

// Toggle whether this profile gets pinged when a family member finishes a workout.
export async function setActivityNotify(profile: string, enabled: boolean) {
  if (DEV_BYPASS) return { success: true };
  const passcode = getPasscode();
  if (!passcode) return { error: 'locked' };
  return call({ action: 'set-activity', passcode, profile, enabled });
}

// --- Durable, program-aware push queue --------------------------------------
//
// Progress rows are keyed by (profile, program), so every push must carry the
// program the app is currently showing. The active program is set by the app
// whenever the selected program changes.

let activeProgram = DEFAULT_PROGRAM;
export function setActiveProgram(id: string) {
  activeProgram = id || DEFAULT_PROGRAM;
}

// `done` is a transient hint (not stored on the row): the day just marked
// complete + a human label, so the server can say "finished a 3-mile ruck".
export type Patch = {
  days?: string[];
  sets?: string[];
  logs?: Record<string, LoggedValue>;
  done?: { id: string; label: string };
};
type OutboxEntry = { profile: string; program: string; patch: Patch };

const OUTBOX_KEY = 'thor3-outbox';
const DEBOUNCE_MS = 700;
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 5 * 60_000;
const MAX_ATTEMPTS_BEFORE_DROP = 4;

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let attempts = 0;

export type SyncStatus = 'idle' | 'syncing' | 'error';
let status: SyncStatus = 'idle';
const listeners = new Set<(s: SyncStatus) => void>();
function setStatus(s: SyncStatus) {
  if (s === status) return;
  status = s;
  listeners.forEach((fn) => fn(s));
}
export function getSyncStatus(): SyncStatus {
  return status;
}
export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => {
    listeners.delete(fn);
  };
}

// The outbox is a FIFO queue of at most one entry per (profile, program). A
// context switch (different brother or program) ENQUEUES a new entry rather than
// clobbering the pending one, so nothing queued offline is ever dropped.
function readOutbox(): OutboxEntry[] {
  try {
    const raw = getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as OutboxEntry[];
    // Back-compat: migrate a legacy single-object outbox to a one-entry queue.
    const one = parsed as OutboxEntry;
    return one && one.profile ? [one] : [];
  } catch {
    return [];
  }
}
function writeOutbox(q: OutboxEntry[]) {
  try {
    if (q.length) setItem(OUTBOX_KEY, JSON.stringify(q));
    else removeItem(OUTBOX_KEY);
  } catch {
    /* ignore */
  }
}

function scheduleFlush(ms = DEBOUNCE_MS) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, ms);
}

// Push the outbox to the server. On failure the patch stays queued (persisted, so
// it survives a reload/close) and a retry is scheduled. When the device comes
// back online / to the foreground we flush immediately (see initSync).
export async function flush(): Promise<void> {
  if (DEV_BYPASS) return; // dev bypass runs fully offline; local writes still persist
  if (inFlight) return;
  const queue = readOutbox();
  if (!queue.length) {
    setStatus('idle');
    return;
  }
  const passcode = getPasscode();
  if (!passcode) return; // locked — keep the outbox for after unlock

  const head = queue[0];
  const sentPatch = head.patch;
  inFlight = true;
  setStatus('syncing');
  const r = await call({ action: 'push-progress', passcode, profile: head.profile, program: head.program, ...sentPatch });
  inFlight = false;

  if (r.error) {
    attempts += 1;
    // A non-retryable client error (a 4xx that isn't auth/rate-limit) would loop
    // forever and block the whole queue. After a few tries, drop the poison head
    // so the remaining entries can still drain.
    const status = typeof r.status === 'number' ? r.status : 0;
    const nonRetryable = status >= 400 && status < 500 && status !== 401 && status !== 429;
    if (nonRetryable && attempts >= MAX_ATTEMPTS_BEFORE_DROP) {
      const rest = readOutbox().slice(1);
      writeOutbox(rest);
      attempts = 0;
      if (rest.length) scheduleFlush();
      else setStatus('idle');
      return;
    }
    setStatus('error');
    scheduleFlush(Math.min(RETRY_BASE_MS * 2 ** (attempts - 1), RETRY_MAX_MS));
    return;
  }

  attempts = 0;
  // Success. Remove the entry we just sent — unless new writes for the same
  // context merged into it while in flight, in which case keep it (minus the
  // one-shot `done` hint, already delivered) so the new changes still get sent.
  const after = readOutbox();
  const idx = after.findIndex((e) => e.profile === head.profile && e.program === head.program);
  if (idx >= 0) {
    if (JSON.stringify(after[idx].patch) === JSON.stringify(sentPatch)) {
      after.splice(idx, 1);
    } else {
      delete after[idx].patch.done;
    }
    writeOutbox(after);
  }
  if (readOutbox().length) scheduleFlush();
  else setStatus('idle');
}

// Debounced, patch-merging pusher. Day toggles, set toggles, and value logs all
// call this; only the fields provided are written server-side.
export function queuePush(patch: Patch) {
  const passcode = getPasscode();
  const profile = getProfileId();
  if (!passcode || !profile) return;

  const queue = readOutbox();
  const idx = queue.findIndex((e) => e.profile === profile && e.program === activeProgram);
  if (idx >= 0) {
    // Merge into the pending entry for this context. Each field carries the full
    // current value (whole days/sets/logs arrays), so a shallow merge = latest wins.
    queue[idx].patch = { ...queue[idx].patch, ...patch };
  } else {
    // New (profile, program) context — enqueue, never overwrite another entry.
    queue.push({ profile, program: activeProgram, patch: { ...patch } });
  }
  writeOutbox(queue);
  scheduleFlush();
}

// Wire up background flushing once, after the store has hydrated. Called from the
// app root (not at import time) so nothing touches native modules during the web
// static-render pass. Flush triggers: network regained, app foregrounded, and a
// startup drain for anything left from a previous session (fires after unlock,
// since flush() no-ops while locked).
let initialized = false;
export function initSync() {
  if (initialized) return;
  initialized = true;
  NetInfo.addEventListener((state) => {
    if (state.isConnected) void flush();
  });
  AppState.addEventListener('change', (s) => {
    if (s === 'active') void flush();
  });
  scheduleFlush(1500);
}
