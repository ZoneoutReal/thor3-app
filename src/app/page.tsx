"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getProgram,
  DAY_LABELS,
  TYPE_META,
  type DayWorkout,
  type WorkoutType,
} from "@/lib/program-data";
import { subscribeUser, unsubscribeUser, sendTestNotification } from "@/lib/push";
import { StrengthSheet } from "./StrengthSheet";

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
            <p className="font-semibold text-[var(--accent)]">Install THOR3</p>
            <p className="mt-0.5 text-[var(--muted)]">
              Tap <strong>Share</strong> then <strong>Add to Home Screen</strong> for
              the full app experience with offline access.
            </p>
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
            <p className="text-sm font-semibold text-[var(--accent)]">Install THOR3</p>
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

function NotificationSettings({
  onClose,
}: {
  onClose: () => void;
}) {
  const { permission, subscription, loading, subscribe, unsubscribe, testNotification } =
    useNotifications();
  const supported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl border border-[var(--border)] bg-[var(--background)] px-5 pb-8 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border)]" />
        <h3 className="text-base font-bold">Notifications</h3>

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
      </div>
    </div>
  );
}

// --- Progress Hook ---

function useProgress(programId: string) {
  const key = `thor3-progress-${programId}`;
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setDone(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, [key]);

  const toggle = useCallback(
    (week: number, day: number) => {
      setDone((prev) => {
        const id = `${week}-${day}`;
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        localStorage.setItem(key, JSON.stringify([...next]));
        return next;
      });
    },
    [key]
  );

  const isDone = useCallback(
    (week: number, day: number) => done.has(`${week}-${day}`),
    [done]
  );

  return { isDone, toggle, count: done.size };
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
  onToggle,
  onOpenStrength,
}: {
  workout: DayWorkout;
  weekNum: number;
  isDone: boolean;
  onToggle: () => void;
  onOpenStrength: (week: number) => void;
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
          : expanded
          ? meta.color + "44"
          : "var(--border)",
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
              onToggle();
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: isDone ? "#22c55e20" : "var(--accent)" + "20",
              color: isDone ? "#22c55e" : "var(--accent)",
            }}
          >
            {isDone ? "Completed ✓" : "Mark Complete"}
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

// --- Main Page ---

export default function Home() {
  useServiceWorker();
  const { deferredPrompt, isInstalled, isIOS, install } = useInstallPrompt();
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [strengthWeek, setStrengthWeek] = useState<number | null>(null);

  const [weekIdx, setWeekIdx] = useState(0);
  const program = getProgram("10week")!;
  const week = program.data[weekIdx];
  const { isDone, toggle, count } = useProgress("10week");

  const weekCompleted = week.days.filter((d) => isDone(week.week, d.day)).length;
  const totalDays = program.data.reduce((sum, w) => sum + w.days.length, 0);

  return (
    <div className="flex min-h-screen flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                THOR<span style={{ color: "var(--accent)" }}>3</span>
              </h1>
              <p className="text-xs text-[var(--muted)]">SFAS Conditioning</p>
            </div>
            <div className="flex items-center gap-3">
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
                      weekIdx === i
                        ? "var(--accent)" + "50"
                        : "transparent",
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
      <main className="flex-1">
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
            {week.days.map((day) => (
              <DayCard
                key={day.day}
                workout={day}
                weekNum={week.week}
                isDone={isDone(week.week, day.day)}
                onToggle={() => toggle(week.week, day.day)}
                onOpenStrength={setStrengthWeek}
              />
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--muted)]">
        THOR3 SFAS Conditioning Program
      </footer>

      {/* Notification Settings */}
      {showSettings && <NotificationSettings onClose={() => setShowSettings(false)} />}

      {/* Strength Sheet */}
      {strengthWeek !== null && (
        <StrengthSheet initialWeek={strengthWeek} onClose={() => setStrengthWeek(null)} />
      )}
    </div>
  );
}
