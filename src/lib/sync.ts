// Client for the `progress` edge function: the shared source of truth for both
// brothers' workout progress and per-profile reminder settings. Every call is
// authenticated with the family passcode the user entered at the gate.

import { getPasscode, getProfileId, type Profile } from "./profiles";

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

// Debounced, patch-merging pusher. Day toggles and set toggles can both call
// this from anywhere; only the fields provided are written server-side.
let pending: { days?: string[]; sets?: string[]; logs?: Record<string, LoggedValue> } = {};
let timer: ReturnType<typeof setTimeout> | null = null;

export function queuePush(patch: { days?: string[]; sets?: string[]; logs?: Record<string, LoggedValue> }) {
  const passcode = getPasscode();
  const profile = getProfileId();
  if (!passcode || !profile) return;
  pending = { ...pending, ...patch };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const p = pending;
    pending = {};
    timer = null;
    call({ action: "push-progress", passcode, profile, ...p });
  }, 700);
}
