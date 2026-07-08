"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { parseDay, fmtClock, fmtDuration, pacePerMile, type DayStep } from "@/lib/day-steps";
import { queuePush, type LoggedValue } from "@/lib/sync";
import { getProfileId } from "@/lib/profiles";
import { getStrengthBlockForWeek, type DayWorkout } from "@/lib/program-data";
import { WorkoutMode } from "./WorkoutMode";

function vibrate(ms: number) {
  try {
    (navigator as unknown as { vibrate?: (p: number) => void }).vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

// Parse a duration the user typed on the finish screen. Accepts a bare number as
// minutes ("45" -> 45:00), or a clock ("45:30", "1:02:05"). Returns seconds, or
// null if it can't be read.
function parseDurationInput(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  if (/^\d+$/.test(t)) return parseInt(t, 10) * 60;
  const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const min = parseInt(m[2], 10);
  const sec = parseInt(m[3], 10);
  if (sec >= 60) return null;
  if (m[1] && min >= 60) return null;
  return h * 3600 + min * 60 + sec;
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
  // Mirror state in refs so a write's durable side effects (localStorage +
  // queuePush) run synchronously, not inside a setState updater. Finishing the
  // workout unmounts this logger in the same React batch, which would discard a
  // pending updater and lose the final duration.
  const logsRef = useRef<Record<string, LoggedValue>>({});
  const setsRef = useRef<Set<string>>(new Set());

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
    logsRef.current = mergedLogs;
    setsRef.current = mergedSets;
    setLogs(mergedLogs);
    setDone(mergedSets);
    localStorage.setItem(logsKey, JSON.stringify(mergedLogs));
    localStorage.setItem(setsKey, JSON.stringify([...mergedSets]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logsKey, setsKey]);

  const setLog = useCallback(
    (key: string, value: string, metric?: string, week?: number) => {
      const next = { ...logsRef.current };
      if (value.trim() === "") delete next[key];
      else next[key] = { v: value.trim(), m: metric, w: week };
      logsRef.current = next;
      localStorage.setItem(logsKey, JSON.stringify(next));
      queuePush({ logs: next });
      setLogs(next);
    },
    [logsKey]
  );

  const toggleDone = useCallback(
    (id: string, val?: boolean) => {
      const prev = setsRef.current;
      const want = val === undefined ? !prev.has(id) : val;
      if (prev.has(id) === want) return;
      const next = new Set(prev);
      if (want) next.add(id);
      else next.delete(id);
      setsRef.current = next;
      localStorage.setItem(setsKey, JSON.stringify([...next]));
      queuePush({ sets: [...next] });
      setDone(next);
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
  // A step that expects a value (reps / time / distance) can't be checked off
  // until that value is logged. Steps with nothing to record (input === "none",
  // e.g. "Repeat 4x") stay freely checkable.
  const needsValue = step.input !== "none";
  const hasValue = value.trim() !== "";
  const canComplete = !needsValue || hasValue;
  const complete = (v?: boolean) => {
    const next = v === undefined ? !done : v;
    if (next && !canComplete) return; // block completing before the value is logged
    onToggle(next);
  };

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
          onClick={() => complete()}
          disabled={!done && !canComplete}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm transition-colors disabled:opacity-40"
          style={{
            borderColor: done ? "var(--success)" : "var(--border)",
            backgroundColor: done ? "var(--success)" : "transparent",
            color: done ? "#000" : "var(--muted)",
          }}
          aria-label={done ? "Mark step not done" : canComplete ? "Mark step done" : "Log your reps first"}
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
        <CountdownTimer seconds={step.timer.seconds} done={done} onExpire={() => complete(true)} />
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
          {pacePerMile(step, value) && (
            <span className="ml-auto text-xs font-semibold" style={{ color: "var(--accent)" }}>
              {pacePerMile(step, value)}
            </span>
          )}
        </div>
      )}

      {needsValue && !hasValue && !done && (
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">
          Log your {step.input === "reps" ? "reps" : step.input === "distance" ? "distance" : "time"} to check this off.
        </p>
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
  strengthDayIndex = 0,
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
  strengthDayIndex?: number; // which strength block day this weekday maps to
  typeLabel: string;
  dayComplete: boolean;
  serverLogs: Record<string, LoggedValue>;
  serverSets: string[];
  onOpenStrength: () => void;
  onFinish: () => void;
  onClose: () => void;
}) {
  const profileId = getProfileId();
  const strengthBlock = getStrengthBlockForWeek(week);
  const { logs, done, setLog, toggleDone, lastValue } = useWorkoutLog(programId, profileId, serverLogs, serverSets);
  const sessions = parseDay(day);

  // Per-day subjective log, stored alongside step values in the same synced map.
  const noteKey = `note-${week}-${day.day}`;
  const rpeKey = `rpe-${week}-${day.day}`;
  const rpe = logs[rpeKey]?.v ?? "";

  // Whole-workout timer. We store the wall-clock START timestamp (synced to
  // Supabase via the logs map), not a running counter, so elapsed = now - start
  // stays correct through a phone lock, an app close, or a device switch. On
  // finish we compute and store the final duration in seconds.
  const startKey = `session-start-${week}-${day.day}`;
  const durKey = `session-dur-${week}-${day.day}`;
  const startedAt = logs[startKey]?.v ?? null;
  const durationSec = logs[durKey]?.v ? parseInt(logs[durKey].v, 10) : null;
  const running = !!startedAt && durationSec == null;

  // Re-render once a second while running so the elapsed readout ticks up. The
  // value itself is derived from the timestamp, so a suspended tab loses nothing.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Fitbod-style 3-2-1-GO pre-roll. Null = inactive; 3/2/1 count down; 0 = GO,
  // the moment we stamp the start so elapsed counts from "GO", not the tap.
  const [preCount, setPreCount] = useState<number | null>(null);

  const elapsedSec = startedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000)) : 0;

  const startSession = () => setLog(startKey, new Date().toISOString(), "session-start", week);
  const discardSession = () => setLog(startKey, "", "session-start", week); // "" clears the key
  const restartSession = () => {
    setLog(durKey, "", "session-duration", week);
    setLog(startKey, new Date().toISOString(), "session-start", week);
  };
  const beginCountdown = () => {
    if (preCount == null) setPreCount(3);
  };
  useEffect(() => {
    if (preCount == null) return;
    if (preCount > 0) {
      const id = setTimeout(() => setPreCount((c) => (c == null ? null : c - 1)), 1000);
      return () => clearTimeout(id);
    }
    // preCount === 0 -> GO: stamp the start, then clear after a brief flash.
    startSession();
    const id = setTimeout(() => setPreCount(null), 650);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preCount]);
  // Finishing opens a confirm step: the counted time is pre-filled and editable,
  // and can be typed by hand if the timer was never started.
  const [confirming, setConfirming] = useState(false);
  const [durInput, setDurInput] = useState("");
  const parsedInput = parseDurationInput(durInput);
  const openFinish = () => {
    const seed = running ? fmtDuration(elapsedSec) : durationSec != null ? fmtDuration(durationSec) : "";
    setDurInput(seed);
    setConfirming(true);
  };
  const confirmFinish = () => {
    const t = durInput.trim();
    if (t === "") {
      // No time entered: clear any running timer so it isn't left counting.
      if (startedAt) setLog(startKey, "", "session-start", week);
    } else {
      if (parsedInput == null) return; // invalid entry: keep the dialog open
      setLog(durKey, String(parsedInput), "session-duration", week);
    }
    setConfirming(false);
    onFinish();
  };

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
          {/* Whole-workout timer (wall-clock; keeps counting while locked). */}
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: running ? "var(--accent)" : "var(--border)", borderWidth: running ? 2 : 1 }}
          >
            {durationSec != null ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Workout time</p>
                  <p className="font-mono text-2xl font-bold tabular-nums" style={{ color: "var(--success)" }}>
                    {fmtDuration(durationSec)}
                  </p>
                </div>
                <button
                  onClick={restartSession}
                  className="rounded-lg bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--card-hover)]"
                >
                  Restart
                </button>
              </div>
            ) : running ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                    In progress
                  </p>
                  <p className="font-mono text-3xl font-bold tabular-nums" style={{ color: "var(--accent)" }}>
                    {fmtDuration(elapsedSec)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-1.5">
                  <button
                    onClick={openFinish}
                    className="rounded-lg px-4 py-2 text-sm font-bold transition-colors"
                    style={{ backgroundColor: "var(--accent)", color: "#000" }}
                  >
                    Finish workout
                  </button>
                  <button onClick={discardSession} className="rounded-lg py-1 text-xs font-semibold text-[var(--muted)]">
                    Discard
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Time this workout</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">Keeps counting while your phone is locked.</p>
                </div>
                <button
                  onClick={beginCountdown}
                  className="shrink-0 rounded-lg px-6 py-2.5 text-sm font-bold transition-colors"
                  style={{ backgroundColor: "var(--accent)", color: "#000" }}
                >
                  Start
                </button>
              </div>
            )}
          </div>

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
                  // Show this day's actual strength sets inline (loggable), with a
                  // Day toggle in case the weekday->block-day guess is off. Falls
                  // back to opening the full sheet if the block can't be resolved.
                  if (strengthBlock && strengthBlock.days.length > 0) {
                    return (
                      <div key={step.id}>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                            Strength training
                          </p>
                          <button onClick={onOpenStrength} className="text-xs font-semibold text-[var(--accent)]">
                            Full sheet &#8594;
                          </button>
                        </div>
                        <WorkoutMode
                          block={strengthBlock}
                          programId={programId}
                          initialWeek={week}
                          lockWeek={week}
                          singleDayIndex={strengthDayIndex}
                          embedded
                        />
                      </div>
                    );
                  }
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
            onClick={dayComplete ? onClose : openFinish}
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

      {/* Finish confirmation: review/edit the counted time (or type it in). */}
      {confirming && (
        <div
          className="absolute inset-0 z-10 flex items-end justify-center bg-black/60"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl border border-[var(--border)] bg-[var(--background)] px-5 pb-8 pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border)]" />
            <h3 className="text-base font-bold">Finish workout</h3>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {running ? "Confirm the time or edit it, then finish." : "Enter how long this workout took."}
            </p>

            <div className="mt-4">
              <label htmlFor="thor3-dur" className="text-sm font-semibold">
                Total time
              </label>
              <input
                id="thor3-dur"
                value={durInput}
                onChange={(e) => setDurInput(e.target.value)}
                placeholder="45  or  45:30"
                autoFocus
                className="mt-2 w-full rounded-lg border bg-[var(--card)] px-3 py-3 text-center font-mono text-2xl font-bold tabular-nums text-[var(--foreground)] outline-none"
                style={{ borderColor: durInput.trim() && parsedInput == null ? "#ef4444" : "var(--border)" }}
              />
              <p className="mt-1.5 text-center text-xs text-[var(--muted)]">
                {durInput.trim() === ""
                  ? "Minutes (e.g. 45) or mm:ss. Leave blank to finish without a time."
                  : parsedInput == null
                  ? "Enter minutes (45) or a clock (45:30 or 1:02:05)."
                  : `= ${fmtDuration(parsedInput)}${parsedInput >= 60 ? `  ·  ${Math.round(parsedInput / 60)} min` : ""}`}
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg bg-[var(--card)] px-4 py-3 text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--card-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={confirmFinish}
                disabled={durInput.trim() !== "" && parsedInput == null}
                className="flex-1 rounded-lg py-3 text-sm font-bold transition-colors disabled:opacity-40"
                style={{ backgroundColor: "var(--accent)", color: "#000" }}
              >
                Confirm &amp; finish workout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-2-1-GO pre-roll. Tap to cancel before GO. */}
      {preCount != null && (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85"
          onClick={() => {
            if (preCount > 0) setPreCount(null);
          }}
        >
          <span
            key={preCount}
            className="font-mono text-8xl font-black tabular-nums"
            style={{ color: "var(--accent)" }}
          >
            {preCount > 0 ? preCount : "GO"}
          </span>
          <span className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
            {preCount > 0 ? "Get ready" : "Timer running"}
          </span>
        </div>
      )}
    </div>
  );
}
