"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getProgram,
  programs,
  DAY_LABELS,
  TYPE_META,
  workoutLabel,
  type DayWorkout,
  type WorkoutType,
} from "@/lib/program-data";
import { subscribeUser, unsubscribeUser, sendTestNotification } from "@/lib/push";
import { fmtDuration } from "@/lib/day-steps";
import { StrengthSheet } from "./StrengthSheet";
import { DayLogger } from "./DayLogger";
import { Gate } from "./Gate";
import { Together } from "./Together";
import { Metrics } from "./Metrics";
import { pullAll, queuePush, setReminder, setActivityNotify, setActiveProgram, onSyncStatus, type Snapshot, type SyncStatus } from "@/lib/sync";
import { getPasscode, getProfileId, type Profile } from "@/lib/profiles";
import { getProgramPref, setProgramPref, getStartDate, setStartDate, currentPosition } from "@/lib/program-prefs";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// --- Service Worker & Install Prompt ---

function useServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/`, updateViaCache: "none" })
        .catch(() => {});
    }
  }, []);
}

function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !("MSStream" in window)
    );

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as any).prompt();
    const result = await (deferredPrompt as any).userChoice;
    if (result.outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return { deferredPrompt, isInstalled, isIOS, install };
}

function InstallBanner({
  isIOS,
  deferredPrompt,
  onInstall,
  onDismiss,
}: {
  isIOS: boolean;
  deferredPrompt: Event | null;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  if (isIOS) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-2">
        <div className="flex items-start gap-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3">
          <span className="text-lg">&#x2193;</span>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-[var(--accent)]">Install Rukr</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[var(--muted)]">
              <li>Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li>
              <li>Open Rukr from your home screen.</li>
              <li>Enter the <strong>family code</strong> and tap <strong>your name</strong> to set your profile.</li>
              <li>Turn on reminders so you get your daily nudge.</li>
            </ol>
          </div>
          <button onClick={onDismiss} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            &#x2715;
          </button>
        </div>
      </div>
    );
  }

  if (deferredPrompt) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-2">
        <div className="flex items-center gap-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3">
          <span className="text-lg">&#x2193;</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--accent)]">Install Rukr</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Add to home screen for offline access</p>
          </div>
          <button
            onClick={onInstall}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "#000" }}
          >
            Install
          </button>
          <button onClick={onDismiss} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            &#x2715;
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// --- Push Notifications ---

function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermission(Notification.permission);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then(setSubscription);
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      setSubscription(sub);
      await subscribeUser(sub.toJSON());
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = subscription?.endpoint;
      await subscription?.unsubscribe();
      setSubscription(null);
      await unsubscribeUser(endpoint);
    } finally {
      setLoading(false);
    }
  }, [subscription]);

  const testNotification = useCallback(async () => {
    if (!subscription) return;
    await sendTestNotification(subscription.endpoint);
  }, [subscription]);

  return { permission, subscription, loading, subscribe, unsubscribe, testNotification };
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = [0, 15, 30, 45];
function fmt12(h: number, m: number) {
  const ap = h < 12 ? "AM" : "PM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

function ReminderTime({
  myProfile,
  onReminderSaved,
}: {
  myProfile?: Profile;
  onReminderSaved: () => void;
}) {
  const [hour, setHour] = useState(myProfile?.reminder_hour ?? 6);
  const [min, setMin] = useState(myProfile?.reminder_min ?? 0);
  const [enabled, setEnabled] = useState(myProfile?.reminder_enabled ?? true);
  const [saving, setSaving] = useState(false);

  // Re-seed if the profile snapshot arrives/changes.
  useEffect(() => {
    if (!myProfile) return;
    setHour(myProfile.reminder_hour);
    setMin(myProfile.reminder_min);
    setEnabled(myProfile.reminder_enabled);
  }, [myProfile?.id, myProfile?.reminder_hour, myProfile?.reminder_min, myProfile?.reminder_enabled]);

  const save = useCallback(
    async (patch: { hour?: number; min?: number; enabled?: boolean }) => {
      const pid = getProfileId();
      if (!pid) return;
      setSaving(true);
      await setReminder(pid, patch);
      setSaving(false);
      onReminderSaved();
    },
    [onReminderSaved]
  );

  return (
    <div className="mt-5 border-t border-[var(--border)] pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Daily reminder</p>
          <p className="text-xs text-[var(--muted)]">
            Your own time{saving ? " · saving..." : ""}
          </p>
        </div>
        <button
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            save({ enabled: next });
          }}
          className="relative h-6 w-11 rounded-full transition-colors"
          style={{ backgroundColor: enabled ? "var(--accent)" : "var(--border)" }}
          aria-label="Toggle daily reminder"
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
            style={{ left: enabled ? "22px" : "2px" }}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-3 flex items-center gap-2">
          <select
            value={hour}
            onChange={(e) => {
              const h = Number(e.target.value);
              setHour(h);
              save({ hour: h });
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {fmt12(h, min)}
              </option>
            ))}
          </select>
          <select
            value={min}
            onChange={(e) => {
              const m = Number(e.target.value);
              setMin(m);
              save({ min: m });
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none"
          >
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                :{String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
          <span className="text-xs text-[var(--muted)]">Central</span>
        </div>
      )}
    </div>
  );
}

function ActivityNotifyToggle({
  myProfile,
  onSaved,
}: {
  myProfile?: Profile;
  onSaved: () => void;
}) {
  const [on, setOn] = useState(myProfile?.activity_notify ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (myProfile) setOn(myProfile.activity_notify);
  }, [myProfile?.id, myProfile?.activity_notify]);

  const save = useCallback(
    async (next: boolean) => {
      const pid = getProfileId();
      if (!pid) return;
      setOn(next);
      setSaving(true);
      await setActivityNotify(pid, next);
      setSaving(false);
      onSaved();
    },
    [onSaved]
  );

  return (
    <div className="mt-5 border-t border-[var(--border)] pt-4">
      <div className="flex items-center justify-between">
        <div className="pr-3">
          <p className="text-sm font-semibold">Family activity</p>
          <p className="text-xs text-[var(--muted)]">
            Get a nudge when someone finishes a workout{saving ? " · saving..." : ""}
          </p>
        </div>
        <button
          onClick={() => save(!on)}
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
          style={{ backgroundColor: on ? "var(--accent)" : "var(--border)" }}
          aria-label="Toggle family activity notifications"
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
            style={{ left: on ? "22px" : "2px" }}
          />
        </button>
      </div>
    </div>
  );
}

function NotificationSettings({
  myProfile,
  programId,
  startDate,
  onProgramChange,
  onStartDateChange,
  onReminderSaved,
  onClose,
}: {
  myProfile?: Profile;
  programId: string;
  startDate: string | null;
  onProgramChange: (id: string) => void;
  onStartDateChange: (iso: string) => void;
  onReminderSaved: () => void;
  onClose: () => void;
}) {
  const { permission, subscription, loading, subscribe, unsubscribe, testNotification } =
    useNotifications();
  const supported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--background)] px-5 pb-8 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border)]" />
        <h3 className="text-base font-bold">Settings</h3>
        {myProfile && (
          <p className="mt-0.5 text-xs text-[var(--muted)]">Signed in as {myProfile.display_name}</p>
        )}

        {/* Program + start-date anchor */}
        <div className="mt-4 space-y-4 border-b border-[var(--border)] pb-4">
          <div>
            <p className="text-sm font-semibold">Program</p>
            <div className="mt-2 flex gap-1.5">
              {programs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onProgramChange(p.id)}
                  className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: programId === p.id ? "var(--accent)" : "var(--card)",
                    color: programId === p.id ? "#000" : "var(--muted)",
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="thor3-start" className="text-sm font-semibold">
              Start date
            </label>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              The Monday of Week 1. Anchors &ldquo;Today&rdquo; to the right week and day.
            </p>
            <input
              id="thor3-start"
              type="date"
              value={startDate ?? ""}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <h4 className="mt-4 text-sm font-bold">Notifications</h4>

        {!supported ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Push notifications are not supported in this browser.
          </p>
        ) : permission === "denied" ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Notifications are blocked. Enable them in your browser settings, then reload.
          </p>
        ) : subscription ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
              <span className="text-sm text-[var(--success)]">Notifications enabled</span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Daily workout reminders will appear in your notification bar and lock screen.
            </p>
            <div className="flex gap-2">
              <button
                onClick={testNotification}
                className="flex-1 rounded-lg py-2 text-sm font-semibold transition-colors"
                style={{ backgroundColor: "var(--accent)" + "20", color: "var(--accent)" }}
              >
                Send Test
              </button>
              <button
                onClick={unsubscribe}
                disabled={loading}
                className="rounded-lg bg-[var(--card)] px-4 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--card-hover)]"
              >
                {loading ? "..." : "Disable"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Get daily workout reminders pushed to your notification bar and lock screen — even when the app is closed.
            </p>
            <button
              onClick={subscribe}
              disabled={loading}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition-colors"
              style={{ backgroundColor: "var(--accent)", color: "#000" }}
            >
              {loading ? "Enabling..." : "Enable Notifications"}
            </button>
          </div>
        )}

        <ReminderTime myProfile={myProfile} onReminderSaved={onReminderSaved} />
        <ActivityNotifyToggle myProfile={myProfile} onSaved={onReminderSaved} />
      </div>
    </div>
  );
}

// --- Progress Hook ---

function useSyncedProgress(programId: string, profileId: string | null, unlocked: boolean) {
  const key = profileId ? `thor3-progress-${profileId}-${programId}` : `thor3-progress-${programId}`;
  const legacyKey = `thor3-progress-${programId}`;
  const [done, setDone] = useState<Set<string>>(new Set());
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Local-first: instant paint from this device (profile-scoped, falling back to
  // any pre-multiuser progress the person already had).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key) ?? localStorage.getItem(legacyKey);
      setDone(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch {
      setDone(new Set());
    }
  }, [key, legacyKey]);

  // Pull the shared snapshot; union my server progress into local so nothing is
  // lost across devices, then push the union back up if it added anything.
  const hydrate = useCallback(async () => {
    const pc = getPasscode();
    const pid = getProfileId();
    if (!pc || !pid) return;
    const r = await pullAll(pc);
    if (!r.ok || !r.snapshot) return;
    setSnapshot(r.snapshot);
    const mine = r.snapshot.progress.find((p) => p.profile === pid && p.program === programId);
    if (mine) {
      setDone((prev) => {
        const union = new Set(prev);
        mine.days.forEach((d) => union.add(d));
        const arr = [...union];
        localStorage.setItem(key, JSON.stringify(arr));
        if (arr.length !== mine.days.length) queuePush({ days: arr });
        return union;
      });
    }
  }, [key, programId]);

  useEffect(() => {
    if (unlocked) hydrate();
  }, [unlocked, hydrate]);

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
        localStorage.setItem(key, JSON.stringify(arr));
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

// --- UI Components ---

function TypeBadge({ type }: { type: WorkoutType }) {
  const meta = TYPE_META[type];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider"
      style={{ backgroundColor: meta.color + "22", color: meta.color }}
    >
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function DayCard({
  workout,
  weekNum,
  isDone,
  isToday = false,
  durationSec,
  onToggle,
  onOpenStrength,
  onOpenLogger,
}: {
  workout: DayWorkout;
  weekNum: number;
  isDone: boolean;
  isToday?: boolean;
  durationSec?: number;
  onToggle: () => void;
  onOpenStrength: (week: number) => void;
  onOpenLogger: (week: number, day: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[workout.type];
  const isRest = workout.type === "rest";

  return (
    <div
      className="rounded-lg border transition-all"
      style={{
        borderColor: isDone
          ? "#22c55e44"
          : isToday
          ? "var(--accent)"
          : expanded
          ? meta.color + "44"
          : "var(--border)",
        borderWidth: isToday ? 2 : 1,
        backgroundColor: isDone
          ? "#22c55e08"
          : expanded
          ? meta.color + "08"
          : "var(--card)",
      }}
    >
      <button
        onClick={() => !isRest && setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ backgroundColor: meta.color + "20" }}
        >
          {isDone ? (
            <span className="text-[var(--success)]">&#10003;</span>
          ) : (
            meta.icon
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--muted)]">
              {DAY_LABELS[workout.day - 1]}
            </span>
            <TypeBadge type={workout.type} />
            {isToday && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: "var(--accent)", color: "#000" }}
              >
                Today
              </span>
            )}
            {durationSec != null && (
              <span className="ml-auto shrink-0 font-mono text-[11px] font-semibold text-[var(--muted)]">
                {fmtDuration(durationSec)}
              </span>
            )}
          </div>
          {!isRest && (
            <p className="mt-0.5 truncate text-sm text-[var(--foreground)]">
              {workout.sessions[0].description[0]}
            </p>
          )}
        </div>
        {!isRest && (
          <svg
            className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "none" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </button>

      {expanded && (
        <div className="border-t px-4 pb-3 pt-2" style={{ borderColor: "var(--border)" }}>
          {workout.sessions.map((session, si) => (
            <div key={si} className={si > 0 ? "mt-3 border-t border-[var(--border)] pt-3" : ""}>
              {session.label && (
                <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: meta.color }}>
                  {session.label}
                </p>
              )}
              {session.description.map((line, li) => {
                if (line === "") return <div key={li} className="h-2" />;
                if (/strength training/i.test(line)) {
                  return (
                    <button
                      key={li}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStrength(weekNum);
                      }}
                      className="mt-1 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
                      style={{ backgroundColor: "var(--accent)" + "20", color: "var(--accent)" }}
                    >
                      <span>{TYPE_META.strength.icon}</span>
                      <span>View Strength Workout</span>
                      <span aria-hidden>&#8594;</span>
                    </button>
                  );
                }
                return (
                  <p key={li} className="text-sm leading-relaxed text-[var(--foreground)]">
                    {line}
                  </p>
                );
              })}
            </div>
          ))}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenLogger(weekNum, workout.day);
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-colors"
            style={{ backgroundColor: "var(--accent)", color: "#000" }}
          >
            {isDone ? "Log / review workout" : "Log workout"}
            <span aria-hidden>&#8594;</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-colors"
            style={{
              backgroundColor: isDone ? "#22c55e20" : "var(--card-hover)",
              color: isDone ? "#22c55e" : "var(--muted)",
            }}
          >
            {isDone ? "Completed ✓ (tap to undo)" : "Just mark complete"}
          </button>
        </div>
      )}
    </div>
  );
}

function WeekProgress({ total, completed }: { total: number; completed: number }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: "var(--success)" }}
        />
      </div>
      <span className="text-xs font-medium text-[var(--muted)]">
        {completed}/{total}
      </span>
    </div>
  );
}

// --- Bottom tab bar ---

type TabId = "workout" | "metrics" | "together";

function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
}) {
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: "workout",
      label: "Workout",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M4 9v6 M7 6v12 M17 6v12 M20 9v6 M7 12h10" />
        </svg>
      ),
    },
    {
      id: "metrics",
      label: "Metrics",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18 M7 14l4-4 3 3 5-6" />
        </svg>
      ),
    },
    {
      id: "together",
      label: "Together",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
    },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm"
      style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-lg">
        {tabs.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors"
              style={{ color: on ? "var(--accent)" : "var(--muted)" }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// --- Main Page ---

export default function Home() {
  useServiceWorker();
  const { deferredPrompt, isInstalled, isIOS, install } = useInstallPrompt();
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [strengthWeek, setStrengthWeek] = useState<number | null>(null);
  const [loggerDay, setLoggerDay] = useState<{ week: number; day: number } | null>(null);

  // Identity / gate
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("workout");

  // Program selection + start-date anchor (per profile, stored locally).
  const [selectedProgram, setSelectedProgram] = useState<string>("10week");
  const [startDate, setStartDateState] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");

  const program = getProgram(selectedProgram) ?? getProgram("10week")!;

  const [weekIdx, setWeekIdx] = useState(0);
  const week = program.data[Math.min(weekIdx, program.data.length - 1)];
  const position = currentPosition(program, startDate);
  const { isDone, toggle, count, done, snapshot, refresh, refreshing } = useSyncedProgress(
    selectedProgram,
    myProfileId,
    unlocked === true
  );

  const weekCompleted = week.days.filter((d) => isDone(week.week, d.day)).length;
  const totalDays = program.data.reduce((sum, w) => sum + w.days.length, 0);

  const myProfile = snapshot?.profiles.find((p) => p.id === myProfileId);
  const firstName = myProfile?.display_name.split(" ")[0] ?? "";

  // Current profile's server-side recorded values + set completion, for the logger.
  const myRow = snapshot?.progress.find((p) => p.profile === myProfileId && p.program === selectedProgram);
  const serverLogs = myRow?.logs ?? {};
  const serverSets = myRow?.sets ?? [];

  // Resolve identity + per-profile prefs on the client (localStorage only here).
  useEffect(() => {
    const pid = getProfileId();
    setMyProfileId(pid);
    setUnlocked(!!(getPasscode() && pid));
    setSelectedProgram(getProgramPref(pid));
    setStartDateState(getStartDate(pid));
  }, []);

  // Keep the background push queue routed to the program on screen.
  useEffect(() => {
    setActiveProgram(selectedProgram);
  }, [selectedProgram]);

  // Reflect background sync state in the header indicator.
  useEffect(() => onSyncStatus(setSyncStatus), []);

  // Jump the week selector to "today" whenever the anchor (program / profile /
  // start date) changes. Manual week navigation afterward is preserved.
  useEffect(() => {
    const pos = currentPosition(program, startDate);
    setWeekIdx(pos ? pos.weekIndex : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgram, myProfileId, startDate]);

  // Freshen the shared snapshot whenever the Together or Metrics tab is opened.
  useEffect(() => {
    if ((activeTab === "together" || activeTab === "metrics") && unlocked) refresh();
  }, [activeTab, unlocked, refresh]);

  const handleUnlock = useCallback(() => {
    const pid = getProfileId();
    setMyProfileId(pid);
    setSelectedProgram(getProgramPref(pid));
    setStartDateState(getStartDate(pid));
    setUnlocked(true);
    setShowGate(false);
  }, []);

  const changeProgram = useCallback((id: string) => {
    const pid = getProfileId();
    if (pid) setProgramPref(pid, id);
    setSelectedProgram(id);
  }, []);

  const changeStartDate = useCallback((iso: string) => {
    const pid = getProfileId();
    if (pid) setStartDate(pid, iso);
    setStartDateState(iso || null);
  }, []);

  // First run (or a wiped passcode): show the gate full-screen.
  if (unlocked === null) return <div className="min-h-screen bg-[var(--background)]" />;
  if (!unlocked) return <Gate onUnlock={handleUnlock} />;

  return (
    <div className="flex min-h-screen flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Ruk<span style={{ color: "var(--accent)" }}>r</span>
              </h1>
              <button
                onClick={() => snapshot && setShowGate(true)}
                className="mt-0.5 flex items-center gap-1 text-xs text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ backgroundColor: "var(--accent)" + "22", color: "var(--accent)" }}
                >
                  {firstName.slice(0, 1) || "?"}
                </span>
                <span>{firstName || "Set profile"}</span>
                <span aria-hidden>&#8964;</span>
              </button>
            </div>
            <div className="flex items-center gap-3">
              {syncStatus !== "idle" && (
                <span
                  title={syncStatus === "error" ? "Sync failed, will retry" : "Syncing"}
                  className={`h-2 w-2 rounded-full ${syncStatus === "syncing" ? "animate-pulse" : ""}`}
                  style={{ backgroundColor: syncStatus === "error" ? "#ef4444" : "var(--accent)" }}
                  aria-label={syncStatus === "error" ? "Sync failed" : "Syncing"}
                />
              )}
              <button
                onClick={() => setStrengthWeek(week.week)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--card)] text-[var(--muted)] transition-colors hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]"
                aria-label="Strength sheet"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M4 9v6 M7 6v12 M17 6v12 M20 9v6 M7 12h10" />
                </svg>
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--card)] text-[var(--muted)] transition-colors hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]"
                aria-label="Notification settings"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              <div className="text-right">
                <p className="text-lg font-bold" style={{ color: "var(--accent)" }}>
                  {count}<span className="text-xs text-[var(--muted)]">/{totalDays}</span>
                </p>
                <p className="text-xs text-[var(--muted)]">workouts</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {activeTab === "workout" ? (
        <>
          {/* Install banner */}
          {showInstallBanner && !isInstalled && (
            <div className="border-b border-[var(--border)] bg-[var(--background)] py-2">
              <InstallBanner
                isIOS={isIOS}
                deferredPrompt={deferredPrompt}
                onInstall={install}
                onDismiss={() => setShowInstallBanner(false)}
              />
            </div>
          )}

          {/* Week selector */}
          <div className="border-b border-[var(--border)] bg-[var(--background)]">
            <div className="mx-auto max-w-lg px-4 py-3">
              <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
                {program.data.map((w, i) => {
                  const wDone = w.days.filter((d) => isDone(w.week, d.day)).length;
                  const allDone = wDone === w.days.length;
                  return (
                    <button
                      key={w.week}
                      onClick={() => setWeekIdx(i)}
                      className="relative flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                      style={{
                        backgroundColor:
                          weekIdx === i
                            ? "var(--accent)" + "30"
                            : allDone
                            ? "#22c55e15"
                            : "var(--card)",
                        color:
                          weekIdx === i
                            ? "var(--accent)"
                            : allDone
                            ? "#22c55e"
                            : "var(--muted)",
                        borderWidth: 1,
                        borderColor:
                          weekIdx === i ? "var(--accent)" + "50" : "transparent",
                      }}
                    >
                      <span>W{w.week}</span>
                      {wDone > 0 && (
                        <span className="mt-0.5 text-[10px]">
                          {wDone}/{w.days.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Week content */}
          <main className="flex-1 pb-24">
            <div className="mx-auto max-w-lg px-4 py-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Week {week.week}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setWeekIdx(Math.max(0, weekIdx - 1))}
                    disabled={weekIdx === 0}
                    className="rounded-lg bg-[var(--card)] px-3 py-1 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--card-hover)] disabled:opacity-30"
                  >
                    &#8592;
                  </button>
                  <button
                    onClick={() =>
                      setWeekIdx(Math.min(program.data.length - 1, weekIdx + 1))
                    }
                    disabled={weekIdx === program.data.length - 1}
                    className="rounded-lg bg-[var(--card)] px-3 py-1 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--card-hover)] disabled:opacity-30"
                  >
                    &#8594;
                  </button>
                </div>
              </div>

              <WeekProgress total={week.days.length} completed={weekCompleted} />

              <div className="mt-4 flex flex-col gap-2">
                {week.days.map((day) => {
                  const durV = serverLogs[`session-dur-${week.week}-${day.day}`]?.v;
                  return (
                    <DayCard
                      key={day.day}
                      workout={day}
                      weekNum={week.week}
                      isDone={isDone(week.week, day.day)}
                      isToday={position?.todayId === `${week.week}-${day.day}`}
                      durationSec={durV ? parseInt(durV, 10) : undefined}
                      onToggle={() => toggle(week.week, day.day, workoutLabel(day))}
                      onOpenStrength={setStrengthWeek}
                      onOpenLogger={(w, d) => setLoggerDay({ week: w, day: d })}
                    />
                  );
                })}
              </div>
            </div>
          </main>
        </>
      ) : activeTab === "metrics" ? (
        <main className="flex-1 pb-24">
          <Metrics serverLogs={serverLogs} profileId={myProfileId} programId={selectedProgram} />
        </main>
      ) : (
        <main className="flex-1 pb-24">
          {snapshot ? (
            <Together
              snapshot={snapshot}
              myProfileId={myProfileId}
              myDays={[...done]}
              programId={selectedProgram}
              onRefresh={refresh}
              refreshing={refreshing}
            />
          ) : (
            <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-[var(--muted)]">
              Loading progress...
            </div>
          )}
        </main>
      )}

      {/* Bottom tabs */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Notification Settings */}
      {showSettings && (
        <NotificationSettings
          myProfile={myProfile}
          programId={selectedProgram}
          startDate={startDate}
          onProgramChange={changeProgram}
          onStartDateChange={changeStartDate}
          onReminderSaved={refresh}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Switch profile */}
      {showGate && snapshot && (
        <Gate
          initialStep="pick"
          knownProfiles={snapshot.profiles}
          onUnlock={handleUnlock}
          onClose={() => setShowGate(false)}
        />
      )}

      {/* Day logger */}
      {loggerDay &&
        (() => {
          const w = program.data.find((x) => x.week === loggerDay.week);
          const d = w?.days.find((x) => x.day === loggerDay.day);
          if (!d) return null;
          // Map this weekday to a strength block day: the Nth strength session of
          // the week (counting strength on plain + "mixed" days) -> block Day N.
          const hasStrength = (dw: DayWorkout) =>
            dw.sessions.some((s) =>
              s.description.some((l) => /strength training/i.test(l) && /strength sheet/i.test(l))
            );
          const strengthDayIndex = w ? w.days.filter((x) => x.day < d.day && hasStrength(x)).length : 0;
          return (
            <DayLogger
              day={d}
              week={loggerDay.week}
              programId={selectedProgram}
              strengthDayIndex={strengthDayIndex}
              typeLabel={TYPE_META[d.type].label}
              dayComplete={isDone(loggerDay.week, loggerDay.day)}
              serverLogs={serverLogs}
              serverSets={serverSets}
              onOpenStrength={() => {
                setStrengthWeek(loggerDay.week);
                setLoggerDay(null);
              }}
              onFinish={() => {
                if (!isDone(loggerDay.week, loggerDay.day)) toggle(loggerDay.week, loggerDay.day, workoutLabel(d));
                setLoggerDay(null);
              }}
              onClose={() => setLoggerDay(null)}
            />
          );
        })()}

      {/* Strength Sheet */}
      {strengthWeek !== null && (
        <StrengthSheet
          initialWeek={strengthWeek}
          programId={selectedProgram}
          onClose={() => setStrengthWeek(null)}
        />
      )}
    </div>
  );
}
