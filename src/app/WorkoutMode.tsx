"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  parseStrengthSets,
  prescriptionForWeek,
  type StrengthBlock,
  type StrengthDay,
  type StrengthRow,
  type ParsedSet,
} from "@/lib/program-data";

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, "0")}`;
}

function restSeconds(rest?: string): number | undefined {
  if (!rest) return undefined;
  const m = rest.match(/(\d+):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : undefined;
}

function vibrate(ms: number) {
  try {
    (navigator as unknown as { vibrate?: (p: number) => void }).vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

// --- Per-set completion state, persisted per program ---

function useSetProgress(programId: string) {
  const key = `thor3-sets-${programId}`;
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setDone(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, [key]);

  const write = useCallback(
    (next: Set<string>) => {
      localStorage.setItem(key, JSON.stringify([...next]));
      return next;
    },
    [key]
  );

  const set = useCallback(
    (id: string, val: boolean) =>
      setDone((prev) => {
        if (prev.has(id) === val) return prev;
        const next = new Set(prev);
        if (val) next.add(id);
        else next.delete(id);
        return write(next);
      }),
    [write]
  );

  const toggle = useCallback(
    (id: string) =>
      setDone((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return write(next);
      }),
    [write]
  );

  const isDone = useCallback((id: string) => done.has(id), [done]);
  return { isDone, toggle, set };
}

// --- Timed set: Go / Pause / Reset countdown that checks itself off at zero ---

function IntervalTimer({
  seconds,
  isDone,
  onComplete,
  onReopen,
}: {
  seconds: number;
  isDone: boolean;
  onComplete: () => void;
  onReopen: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearTimeout(id);
  }, [running, remaining]);

  useEffect(() => {
    if (running && remaining === 0) {
      setRunning(false);
      vibrate(200);
      onCompleteRef.current();
    }
  }, [running, remaining]);

  if (isDone) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold" style={{ color: "var(--success)" }}>
          &#10003; {mmss(seconds)}
        </span>
        <button
          onClick={() => {
            setRemaining(seconds);
            onReopen();
          }}
          className="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--card-hover)]"
        >
          Redo
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className="min-w-[52px] text-right font-mono text-base font-bold tabular-nums"
        style={{ color: running ? "var(--accent)" : "var(--foreground)" }}
      >
        {mmss(remaining)}
      </span>
      <button
        onClick={() => setRunning((r) => !r)}
        className="rounded-md px-3 py-1.5 text-xs font-bold transition-colors"
        style={{ backgroundColor: "var(--accent)", color: "#000" }}
      >
        {running ? "Pause" : remaining === seconds ? "Go" : "Resume"}
      </button>
      <button
        onClick={() => {
          setRunning(false);
          setRemaining(seconds);
        }}
        className="rounded-md px-2 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--card-hover)]"
        aria-label="Reset timer"
      >
        Reset
      </button>
      <button
        onClick={() => {
          setRunning(false);
          onComplete();
        }}
        className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--success)] hover:text-[var(--success)]"
        aria-label="Mark set complete"
      >
        &#10003;
      </button>
    </div>
  );
}

// --- Rep set: a single checkable row ---

function RepSetRow({
  index,
  target,
  isDone,
  onToggle,
}: {
  index: number;
  target: string;
  isDone: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
      style={{ backgroundColor: isDone ? "var(--success)" + "12" : "var(--card)" }}
    >
      <span className="w-12 shrink-0 text-xs font-medium text-[var(--muted)]">Set {index}</span>
      <span
        className="flex-1 text-sm font-semibold"
        style={{ color: isDone ? "var(--muted)" : "var(--foreground)" }}
      >
        {target}
      </span>
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm transition-colors"
        style={{
          borderColor: isDone ? "var(--success)" : "var(--border)",
          backgroundColor: isDone ? "var(--success)" : "transparent",
          color: isDone ? "#000" : "transparent",
        }}
      >
        &#10003;
      </span>
    </button>
  );
}

// --- One exercise: header + its set rows ---

function ExerciseCard({
  row,
  sets,
  idFor,
  isDone,
  toggle,
  setSet,
  onStartRest,
}: {
  row: StrengthRow;
  sets: ParsedSet[];
  idFor: (setIndex: number) => string;
  isDone: (id: string) => boolean;
  toggle: (id: string) => void;
  setSet: (id: string, val: boolean) => void;
  onStartRest: (seconds?: number) => void;
}) {
  const doneCount = sets.filter((_, i) => isDone(idFor(i))).length;
  const rest = restSeconds(row.rest);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
      <div className="mb-2 flex items-center gap-2">
        {row.group && (
          <span className="text-[10px] font-bold text-[var(--muted)]">{row.group}</span>
        )}
        <span className="flex-1 text-sm font-bold text-[var(--foreground)]">{row.name}</span>
        <span
          className="text-xs font-semibold"
          style={{ color: doneCount === sets.length ? "var(--success)" : "var(--muted)" }}
        >
          {doneCount}/{sets.length}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {sets.map((s, i) => {
          const id = idFor(i);
          if (s.seconds != null) {
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{ backgroundColor: isDone(id) ? "var(--success)" + "12" : "var(--card)" }}
              >
                <span className="w-12 shrink-0 text-xs font-medium text-[var(--muted)]">
                  Set {i + 1}
                </span>
                <IntervalTimer
                  seconds={s.seconds}
                  isDone={isDone(id)}
                  onComplete={() => {
                    setSet(id, true);
                    onStartRest(rest);
                  }}
                  onReopen={() => setSet(id, false)}
                />
              </div>
            );
          }
          return (
            <RepSetRow
              key={i}
              index={i + 1}
              target={s.label}
              isDone={isDone(id)}
              onToggle={() => {
                const willComplete = !isDone(id);
                toggle(id);
                if (willComplete) onStartRest(rest);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// --- Ladder day rendered as a checkable list of steps ---

function LadderList({
  day,
  weekIndex,
  idFor,
  isDone,
  toggle,
}: {
  day: StrengthDay;
  weekIndex: number;
  idFor: (stepIndex: number) => string;
  isDone: (id: string) => boolean;
  toggle: (id: string) => void;
}) {
  const steps = day.ladder ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      {steps.map((step, si) => {
        const id = idFor(si);
        const done = isDone(id);
        return (
          <button
            key={si}
            onClick={() => toggle(id)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
            style={{ backgroundColor: done ? "var(--success)" + "12" : "var(--card)" }}
          >
            <span className="w-12 shrink-0 text-xs font-medium text-[var(--muted)]">
              Set {si + 1}
            </span>
            <span
              className="flex-1 text-sm font-semibold"
              style={{ color: done ? "var(--muted)" : "var(--foreground)" }}
            >
              {step[weekIndex]}
            </span>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm transition-colors"
              style={{
                borderColor: done ? "var(--success)" : "var(--border)",
                backgroundColor: done ? "var(--success)" : "transparent",
                color: done ? "#000" : "transparent",
              }}
            >
              &#10003;
            </span>
          </button>
        );
      })}
    </div>
  );
}

// --- Workout mode: the current week's session, Fitbod-style ---

export function WorkoutMode({
  block,
  programId,
  initialWeek,
}: {
  block: StrengthBlock;
  programId: string;
  initialWeek?: number;
}) {
  const [targetWeek, setTargetWeek] = useState(
    initialWeek != null && block.weeks.includes(initialWeek) ? initialWeek : block.weeks[0]
  );

  // Keep the target week valid when the block changes underneath us.
  useEffect(() => {
    if (!block.weeks.includes(targetWeek)) {
      setTargetWeek(
        initialWeek != null && block.weeks.includes(initialWeek) ? initialWeek : block.weeks[0]
      );
    }
  }, [block, targetWeek, initialWeek]);

  const weekIndex = Math.max(0, block.weeks.indexOf(targetWeek));
  const { isDone, toggle, set: setSet } = useSetProgress(programId);

  const [rest, setRest] = useState<{ total: number; remaining: number } | null>(null);

  useEffect(() => {
    if (!rest || rest.remaining <= 0) return;
    const id = setTimeout(
      () => setRest((r) => (r ? { ...r, remaining: r.remaining - 1 } : r)),
      1000
    );
    return () => clearTimeout(id);
  }, [rest]);

  useEffect(() => {
    if (rest && rest.remaining === 0) {
      vibrate(300);
      setRest(null);
    }
  }, [rest]);

  const startRest = useCallback((seconds?: number) => {
    if (seconds && seconds > 0) setRest({ total: seconds, remaining: seconds });
  }, []);

  const setIdsForDay = useCallback(
    (day: StrengthDay): string[] => {
      const ids: string[] = [];
      if (day.kind === "ladder") {
        (day.ladder ?? []).forEach((_, si) => ids.push(`${targetWeek}|${day.label}|step|${si}`));
        return ids;
      }
      (day.rows ?? []).forEach((row) => {
        const rounds =
          day.kind === "circuit" && !row.group ? day.roundsByWeek?.[weekIndex] : undefined;
        const sets = parseStrengthSets(prescriptionForWeek(row, weekIndex), rounds);
        sets.forEach((_, si) => ids.push(`${targetWeek}|${day.label}|${row.name}|${si}`));
      });
      return ids;
    },
    [targetWeek, weekIndex]
  );

  return (
    <div className="pb-24">
      {/* Week picker for logging */}
      {block.weeks.length > 1 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-[var(--muted)]">Logging week</p>
          <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
            {block.weeks.map((w) => (
              <button
                key={w}
                onClick={() => setTargetWeek(w)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  backgroundColor: w === targetWeek ? "var(--accent)" + "30" : "var(--card)",
                  color: w === targetWeek ? "var(--accent)" : "var(--muted)",
                  borderWidth: 1,
                  borderColor: w === targetWeek ? "var(--accent)" + "50" : "transparent",
                }}
              >
                Week {w}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {block.days.map((day) => {
          const ids = setIdsForDay(day);
          const doneCount = ids.filter(isDone).length;
          return (
            <section key={day.label}>
              <div className="mb-2 flex items-baseline gap-2">
                <span
                  className="rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider"
                  style={{ backgroundColor: "var(--accent)" + "22", color: "var(--accent)" }}
                >
                  {day.label}
                </span>
                {day.title && (
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {day.title}
                  </span>
                )}
                <span
                  className="ml-auto text-xs font-semibold"
                  style={{
                    color: doneCount === ids.length && ids.length > 0
                      ? "var(--success)"
                      : "var(--muted)",
                  }}
                >
                  {doneCount}/{ids.length}
                </span>
              </div>

              {(day.rounds || day.note) && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {day.rounds && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ backgroundColor: "var(--success)" + "20", color: "var(--success)" }}
                    >
                      {day.rounds}
                    </span>
                  )}
                  {day.note && <span className="text-xs text-[var(--muted)]">{day.note}</span>}
                </div>
              )}

              {day.kind === "ladder" ? (
                <LadderList
                  day={day}
                  weekIndex={weekIndex}
                  idFor={(si) => `${targetWeek}|${day.label}|step|${si}`}
                  isDone={isDone}
                  toggle={toggle}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {(day.rows ?? []).map((row) => {
                    const rounds =
                      day.kind === "circuit" && !row.group
                        ? day.roundsByWeek?.[weekIndex]
                        : undefined;
                    const sets = parseStrengthSets(prescriptionForWeek(row, weekIndex), rounds);
                    return (
                      <ExerciseCard
                        key={row.name}
                        row={row}
                        sets={sets}
                        idFor={(si) => `${targetWeek}|${day.label}|${row.name}|${si}`}
                        isDone={isDone}
                        toggle={toggle}
                        setSet={setSet}
                        onStartRest={startRest}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Rest timer bar */}
      {rest && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Rest
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(rest.remaining / rest.total) * 100}%`,
                  backgroundColor: "var(--accent)",
                }}
              />
            </div>
            <span className="font-mono text-sm font-bold tabular-nums" style={{ color: "var(--accent)" }}>
              {mmss(rest.remaining)}
            </span>
            <button
              onClick={() => setRest((r) => (r ? { total: r.total + 15, remaining: r.remaining + 15 } : r))}
              className="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--card-hover)]"
            >
              +15s
            </button>
            <button
              onClick={() => setRest(null)}
              className="rounded-md px-2 py-1 text-xs font-semibold transition-colors"
              style={{ color: "var(--accent)" }}
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
