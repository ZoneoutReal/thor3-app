"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { parseDay, fmtClock, type DayStep } from "@/lib/day-steps";
import { queuePush, type LoggedValue } from "@/lib/sync";
import { getProfileId } from "@/lib/profiles";
import type { DayWorkout } from "@/lib/program-data";

function vibrate(ms: number) {
  try {
    (navigator as unknown as { vibrate?: (p: number) => void }).vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

// --- Synced log values + step completion for the current profile -------------

function useWorkoutLog(
  programId: string,
  profileId: string | null,
  serverLogs: Record<string, LoggedValue>,
  serverSets: string[]
) {
  const logsKey = profileId ? `thor3-logs-${profileId}-${programId}` : `thor3-logs-${programId}`;
  const setsKey = profileId ? `thor3-sets-${profileId}-${programId}` : `thor3-sets-${programId}`;
  const [logs, setLogs] = useState<Record<string, LoggedValue>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  // Local-first load, then merge the server snapshot in (local wins on conflict).
  useEffect(() => {
    let localLogs: Record<string, LoggedValue> = {};
    let localSets: string[] = [];
    try {
      localLogs = JSON.parse(localStorage.getItem(logsKey) || "{}");
    } catch {
      /* ignore */
    }
    try {
      localSets = JSON.parse(localStorage.getItem(setsKey) || localStorage.getItem(`thor3-sets-${programId}`) || "[]");
    } catch {
      /* ignore */
    }
    const mergedLogs = { ...serverLogs, ...localLogs };
    const mergedSets = new Set<string>([...serverSets, ...localSets]);
    setLogs(mergedLogs);
    setDone(mergedSets);
    localStorage.setItem(logsKey, JSON.stringify(mergedLogs));
    localStorage.setItem(setsKey, JSON.stringify([...mergedSets]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logsKey, setsKey]);

  const setLog = useCallback(
    (key: string, value: string, metric?: string, week?: number) => {
      setLogs((prev) => {
        const next = { ...prev };
        if (value.trim() === "") delete next[key];
        else next[key] = { v: value.trim(), m: metric, w: week };
        localStorage.setItem(logsKey, JSON.stringify(next));
        queuePush({ logs: next });
        return next;
      });
    },
    [logsKey]
  );

  const toggleDone = useCallback(
    (id: string, val?: boolean) => {
      setDone((prev) => {
        const want = val === undefined ? !prev.has(id) : val;
        if (prev.has(id) === want) return prev;
        const next = new Set(prev);
        if (want) next.add(id);
        else next.delete(id);
        localStorage.setItem(setsKey, JSON.stringify([...next]));
        queuePush({ sets: [...next] });
        return next;
      });
    },
    [setsKey]
  );

  // Most recent value for a metric from an earlier week (Fitbod "last time").
  const lastValue = useCallback(
    (metric: string | undefined, beforeWeek: number): LoggedValue | null => {
      if (!metric) return null;
      let best: LoggedValue | null = null;
      for (const v of Object.values(logs)) {
        if (v.m === metric && typeof v.w === "number" && v.w < beforeWeek) {
          if (!best || (best.w ?? 0) < v.w) best = v;
        }
      }
      return best;
    },
    [logs]
  );

  return { logs, done, setLog, toggleDone, lastValue };
}

// --- Timers ------------------------------------------------------------------

function CountdownTimer({ seconds, done, onExpire }: { seconds: number; done: boolean; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      setRunning(false);
      vibrate(400);
      expireRef.current();
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [running, remaining]);

  const pct = seconds > 0 ? (remaining / seconds) * 100 : 0;
  return (
    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2">
      <div className="flex items-center gap-3">
        <span className="w-14 text-center font-mono text-lg font-bold" style={{ color: done ? "var(--success)" : "var(--accent)" }}>
          {fmtClock(Math.max(0, remaining))}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: "var(--accent)" }} />
        </div>
        <button
          onClick={() => setRunning((r) => !r)}
          className="rounded-md px-2.5 py-1 text-xs font-semibold"
          style={{ backgroundColor: "var(--accent)" + "22", color: "var(--accent)" }}
        >
          {running ? "Pause" : remaining <= 0 ? "Done" : "Start"}
        </button>
        <button
          onClick={() => { setRunning(false); setRemaining(seconds); }}
          className="rounded-md bg-[var(--card)] px-2 py-1 text-xs text-[var(--muted)]"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Stopwatch({ onStop }: { onStop: (elapsedSec: number) => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setElapsed((e) => e + 1), 1000);
    return () => clearTimeout(id);
  }, [running, elapsed]);

  return (
    <div className="mt-2 flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-2">
      <span className="w-16 text-center font-mono text-lg font-bold text-[var(--accent)]">{fmtClock(elapsed)}</span>
      <button
        onClick={() => {
          if (running) {
            setRunning(false);
            onStop(elapsed);
          } else setRunning(true);
        }}
        className="rounded-md px-3 py-1 text-xs font-semibold"
        style={{ backgroundColor: "var(--accent)" + "22", color: "var(--accent)" }}
      >
        {running ? "Stop & log" : elapsed > 0 ? "Resume" : "Start"}
      </button>
      <button
        onClick={() => { setRunning(false); setElapsed(0); }}
        className="rounded-md bg-[var(--card)] px-2 py-1 text-xs text-[var(--muted)]"
      >
        Reset
      </button>
    </div>
  );
}

// --- One loggable step -------------------------------------------------------

function StepRow({
  step,
  value,
  done,
  last,
  onValue,
  onToggle,
}: {
  step: DayStep;
  value: string;
  done: boolean;
  last: LoggedValue | null;
  onValue: (v: string) => void;
  onToggle: (v?: boolean) => void;
}) {
  return (
    <div
      className="rounded-lg border p-3 transition-colors"
      style={{
        borderColor: done ? "#22c55e44" : "var(--border)",
        backgroundColor: done ? "#22c55e08" : "var(--card)",
      }}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle()}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm"
          style={{
            borderColor: done ? "var(--success)" : "var(--border)",
            backgroundColor: done ? "var(--success)" : "transparent",
            color: done ? "#000" : "var(--muted)",
          }}
          aria-label="Mark step done"
        >
          {done ? "✓" : ""}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">{step.label}</p>
          {step.instruction && <p className="mt-0.5 text-xs text-[var(--muted)]">{step.instruction}</p>}
          {last && (
            <p className="mt-0.5 text-xs" style={{ color: "var(--accent)" }}>
              Last time (W{last.w}): {last.v}
            </p>
          )}
        </div>
      </div>

      {step.timer?.mode === "countdown" && (
        <CountdownTimer seconds={step.timer.seconds} done={done} onExpire={() => onToggle(true)} />
      )}
      {step.timer?.mode === "stopwatch" && (
        <Stopwatch onStop={(sec) => { onValue(fmtClock(sec)); onToggle(true); }} />
      )}

      {step.input !== "none" && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => onValue(e.target.value)}
            inputMode={step.input === "reps" ? "numeric" : "text"}
            placeholder={step.input === "reps" ? "reps" : step.unit === "mm:ss" ? "mm:ss" : step.unit || "value"}
            className="w-24 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-center text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          />
          <span className="text-xs text-[var(--muted)]">
            {step.input === "reps" ? "reps" : step.unit === "mm:ss" ? "your time" : step.unit}
          </span>
        </div>
      )}

      {step.rest ? (
        <p className="mt-2 text-[11px] uppercase tracking-wider text-[var(--muted)]">Then rest {fmtClock(step.rest)}</p>
      ) : null}
    </div>
  );
}

// --- Full-screen day logger --------------------------------------------------

export function DayLogger({
  day,
  week,
  programId,
  typeLabel,
  dayComplete,
  serverLogs,
  serverSets,
  onOpenStrength,
  onFinish,
  onClose,
}: {
  day: DayWorkout;
  week: number;
  programId: string;
  typeLabel: string;
  dayComplete: boolean;
  serverLogs: Record<string, LoggedValue>;
  serverSets: string[];
  onOpenStrength: () => void;
  onFinish: () => void;
  onClose: () => void;
}) {
  const profileId = getProfileId();
  const { logs, done, setLog, toggleDone, lastValue } = useWorkoutLog(programId, profileId, serverLogs, serverSets);
  const sessions = parseDay(day);

  // Per-day subjective log, stored alongside step values in the same synced map.
  const noteKey = `note-${week}-${day.day}`;
  const rpeKey = `rpe-${week}-${day.day}`;
  const rpe = logs[rpeKey]?.v ?? "";

  const loggable = sessions.flatMap((s) => s.steps).filter((s) => s.kind === "log");
  const completed = loggable.filter((s) => done.has(`${week}-${day.day}-${s.id}`)).length;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--card)] text-[var(--muted)]" aria-label="Close">
            ✕
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold">Week {week} · {typeLabel}</h2>
            <p className="text-xs text-[var(--muted)]">{completed}/{loggable.length} logged</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-4">
          {sessions.map((session, si) => (
            <div key={si} className="flex flex-col gap-2">
              {session.label && (
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>{session.label}</p>
              )}
              {session.steps.map((step) => {
                if (step.kind === "info") {
                  return (
                    <p key={step.id} className="px-1 text-xs text-[var(--muted)]">{step.label}</p>
                  );
                }
                if (step.kind === "strength") {
                  return (
                    <button
                      key={step.id}
                      onClick={onOpenStrength}
                      className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold"
                      style={{ backgroundColor: "var(--accent)" + "20", color: "var(--accent)" }}
                    >
                      🏋️ Open strength sheet →
                    </button>
                  );
                }
                const logKey = `${week}-${day.day}-${step.id}`;
                return (
                  <StepRow
                    key={step.id}
                    step={step}
                    value={logs[logKey]?.v ?? ""}
                    done={done.has(logKey)}
                    last={lastValue(step.metric, week)}
                    onValue={(v) => setLog(logKey, v, step.metric, week)}
                    onToggle={(val) => toggleDone(logKey, val)}
                  />
                );
              })}
            </div>
          ))}

          {/* Subjective log: effort + free-text notes, synced with the rest. */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">How it went</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Effort (RPE 1&ndash;10)</p>
            <div className="mt-2 grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const on = rpe === String(n);
                return (
                  <button
                    key={n}
                    onClick={() => setLog(rpeKey, on ? "" : String(n), "rpe", week)}
                    className="rounded-md py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: on ? "var(--accent)" : "var(--background)",
                      color: on ? "#000" : "var(--muted)",
                      borderWidth: 1,
                      borderColor: on ? "var(--accent)" : "var(--border)",
                    }}
                    aria-label={`Effort ${n} of 10`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <textarea
              value={logs[noteKey]?.v ?? ""}
              onChange={(e) => setLog(noteKey, e.target.value, "note", week)}
              placeholder="Notes: how you felt, injuries, weather, anything to remember."
              rows={2}
              className="mt-3 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <p className="pt-2 text-center text-[11px] text-[var(--muted)]">
            Your reps and times are saved and synced. {typeLabel === "APFT" ? "Track your scores week to week." : "Tap a step or let a timer check it off."}
          </p>
        </div>
      </main>

      <footer className="sticky bottom-0 border-t border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur-sm" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-lg">
          <button
            onClick={onFinish}
            className="w-full rounded-lg py-3 text-sm font-bold transition-colors"
            style={{
              backgroundColor: dayComplete ? "#22c55e20" : "var(--accent)",
              color: dayComplete ? "#22c55e" : "#000",
            }}
          >
            {dayComplete ? "Completed ✓ · Close" : "Finish & mark day complete"}
          </button>
        </div>
      </footer>
    </div>
  );
}
