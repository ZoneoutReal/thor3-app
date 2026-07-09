// Client for the `progress` edge function: the shared source of truth for both
// brothers' workout progress and per-profile reminder settings. Every call is
// authenticated with the family passcode the user entered at the gate.

import { getPasscode, getProfileId, type Profile } from "./profiles";
import { DEFAULT_PROGRAM } from "./program-prefs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
  if (!SUPABASE_URL) return { error: "not configured" };
  try {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ANON ? { apikey: ANON, Authorization: `Bearer ${ANON}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { error: body.error ?? `HTTP ${res.status}`, status: res.status };
    return body;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "request failed" };
  }
}

// Validate a passcode and fetch everyone's progress + profiles in one shot.
export async function pullAll(passcode: string): Promise<{ ok: boolean; snapshot?: Snapshot; error?: string }> {
  const r = await call({ action: "pull", passcode });
  if (r.error) return { ok: false, error: String(r.error) };
  return { ok: true, snapshot: { profiles: (r.profiles as Profile[]) ?? [], progress: (r.progress as ProgressRow[]) ?? [] } };
}

export async function setReminder(profile: string, r: { hour?: number; min?: number; enabled?: boolean }) {
  const passcode = getPasscode();
  if (!passcode) return { error: "locked" };
  return call({ action: "set-reminder", passcode, profile, ...r });
}

// Toggle whether this profile gets pinged when a family member finishes a workout.
export async function setActivityNotify(profile: string, enabled: boolean) {
  const passcode = getPasscode();
  if (!passcode) return { error: "locked" };
  return call({ action: "set-activity", passcode, profile, enabled });
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
type Outbox = { profile: string; program: string; patch: Patch };

const OUTBOX_KEY = "thor3-outbox";
const DEBOUNCE_MS = 700;
const RETRY_MS = 5000;

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;

export type SyncStatus = "idle" | "syncing" | "error";
let status: SyncStatus = "idle";
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

function readOutbox(): Outbox | null {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as Outbox) : null;
  } catch {
    return null;
  }
}
function writeOutbox(o: Outbox | null) {
  try {
    if (o) localStorage.setItem(OUTBOX_KEY, JSON.stringify(o));
    else localStorage.removeItem(OUTBOX_KEY);
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

// Push the outbox to the server. On failure the patch stays queued (in
// localStorage, so it survives a reload/close) and a retry is scheduled. On the
// browser coming back online we flush immediately.
export async function flush(): Promise<void> {
  if (inFlight) return;
  const out = readOutbox();
  if (!out) {
    setStatus("idle");
    return;
  }
  const passcode = getPasscode();
  if (!passcode) return; // locked — keep the outbox for after unlock

  inFlight = true;
  setStatus("syncing");
  const r = await call({ action: "push-progress", passcode, profile: out.profile, program: out.program, ...out.patch });
  inFlight = false;

  if (r.error) {
    setStatus("error");
    scheduleFlush(RETRY_MS);
    return;
  }

  // Success. If more writes landed while we were in flight, flush again;
  // otherwise the queue is empty. (push-progress upserts full arrays, so a
  // redundant resend is harmless.)
  const after = readOutbox();
  const unchanged =
    after && after.profile === out.profile && after.program === out.program && JSON.stringify(after.patch) === JSON.stringify(out.patch);
  if (unchanged) {
    writeOutbox(null);
    setStatus("idle");
  } else {
    scheduleFlush();
  }
}

// Debounced, patch-merging pusher. Day toggles, set toggles, and value logs all
// call this; only the fields provided are written server-side.
export function queuePush(patch: Patch) {
  const passcode = getPasscode();
  const profile = getProfileId();
  if (!passcode || !profile) return;

  const prev = readOutbox();
  if (prev && (prev.profile !== profile || prev.program !== activeProgram)) {
    // Context switched (profile or program). Flush the old queue before we
    // start merging into a different row, so nothing is misattributed.
    void flush();
  }
  const base: Outbox =
    prev && prev.profile === profile && prev.program === activeProgram
      ? prev
      : { profile, program: activeProgram, patch: {} };
  base.patch = { ...base.patch, ...patch };
  writeOutbox(base);
  scheduleFlush();
}

// Wire up background flushing once, on the client.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flush());
  // Drain anything left over from a previous session (fires after unlock, since
  // flush() no-ops while locked).
  scheduleFlush(1500);
}
