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
import type { LoggedValue } from "@/lib/sync";
import { getProfileId } from "@/lib/profiles";
import { getRestPref } from "@/lib/program-prefs";
import { beep, unlockAudio } from "@/lib/beep";
import {
  writeLog,
  writeSetDone,
  mergeServerLogs,
  mergeServerSets,
} from "@/lib/workout-log";

// The prescribed rep count to pre-fill a set's box, or "" when there's no number
// to seed (e.g. "MAX"). Strips the "+" (a floor, not a cap) and per-side "ea".
function defaultReps(label: string): string {
  const t = label.trim().replace(/\bea\b/gi, "").replace(/\+/g, "").trim();
  return /^\d+$/.test(t) ? t : "";
}

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

// --- Per-set completion + logged reps/weights, persisted & synced per program ---

function useSetProgress(programId: string, serverSets?: string[], serverLogs?: Record<string, LoggedValue>) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<Record<string, LoggedValue>>({});

  // Hydrate: pull server completion + logged values down into local (local wins).
  useEffect(() => {
    setDone(new Set(mergeServerSets(programId, serverSets ?? [])));
    setLogs(mergeServerLogs(programId, serverLogs ?? {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  // Every durable write is a read-modify-write on localStorage (see workout-log.ts)
  // so the co-mounted day logger and this view never clobber each other's keys.
  const set = useCallback(
    (id: string, val: boolean) => setDone(new Set(writeSetDone(programId, id, val))),
    [programId]
  );
  const toggle = useCallback(
    (id: string) => setDone((prev) => new Set(writeSetDone(programId, id, !prev.has(id)))),
    [programId]
  );
  const setLog = useCallback(
    (key: string, value: string, week?: number) => setLogs(writeLog(programId, key, value, { week })),
    [programId]
  );

  const isDone = useCallback((id: string) => done.has(id), [done]);
  const getVal = useCallback((key: string) => logs[key]?.v ?? "", [logs]);
  return { isDone, toggle, set, setLog, getVal };
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
      beep();
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
        onClick={() => {
          unlockAudio();
          setRunning((r) => !r);
        }}
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

// --- Rep set: editable reps + weight, then a done check ---

function RepSetRow({
  index,
  target,
  reps,
  weight,
  isDone,
  onReps,
  onWeight,
  onToggle,
}: {
  index: number;
  target: string; // the prescription label, e.g. "20+", "12 ea", "MAX"
  reps: string; // current value shown in the reps box (defaults to the target)
  weight: string;
  isDone: boolean;
  onReps: (v: string) => void;
  onWeight: (v: string) => void;
  onToggle: () => void;
}) {
  const perSide = /\bea\b/i.test(target); // "12 ea" -> reps are per side
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors"
      style={{ backgroundColor: isDone ? "var(--success)" + "12" : "var(--card)" }}
    >
      <span className="w-10 shrink-0 text-xs font-medium text-[var(--muted)]">Set {index}</span>

      <input
        value={reps}
        onChange={(e) => onReps(e.target.value)}
        inputMode="numeric"
        placeholder={defaultReps(target) || target}
        aria-label={`Set ${index} reps`}
        className="w-12 rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-1.5 text-center text-sm font-semibold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
      />
      <span className="shrink-0 text-[11px] text-[var(--muted)]">{perSide ? "reps ea" : "reps"}</span>

      <span className="shrink-0 text-[var(--muted)]">&times;</span>
      <input
        value={weight}
        onChange={(e) => onWeight(e.target.value)}
        inputMode="decimal"
        placeholder="–"
        aria-label={`Set ${index} weight`}
        className="w-14 rounded-md border border-[var(--border)] bg-[var(--background)] px-1.5 py-1.5 text-center text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
      />
      <span className="shrink-0 text-[11px] text-[var(--muted)]">lb</span>

      <button
        onClick={onToggle}
        aria-label={isDone ? "Mark set not done" : "Mark set done"}
        className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm transition-colors"
        style={{
          borderColor: isDone ? "var(--success)" : "var(--border)",
          backgroundColor: isDone ? "var(--success)" : "transparent",
          color: isDone ? "#000" : "var(--muted)",
        }}
      >
        &#10003;
      </button>
    </div>
  );
}

// --- One exercise: header + its set rows ---

function ExerciseCard({
  row,
  sets,
  week,
  restPrefSec,
  idFor,
  isDone,
  toggle,
  setSet,
  getVal,
  setLog,
  onStartRest,
}: {
  row: StrengthRow;
  sets: ParsedSet[];
  week: number;
  restPrefSec: number;
  idFor: (setIndex: number) => string;
  isDone: (id: string) => boolean;
  toggle: (id: string) => void;
  setSet: (id: string, val: boolean) => void;
  getVal: (key: string) => string;
  setLog: (key: string, value: string, week?: number) => void;
  onStartRest: (seconds?: number) => void;
}) {
  const doneCount = sets.filter((_, i) => isDone(idFor(i))).length;
  // A personal preset (when set) is the break after every set; otherwise fall
  // back to the program's prescribed rest, which only some rows carry.
  const rest = restPrefSec > 0 ? restPrefSec : restSeconds(row.rest);

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
          const wtKey = `${id}|w`;
          const def = defaultReps(s.label);
          return (
            <RepSetRow
              key={i}
              index={i + 1}
              target={s.label}
              reps={getVal(id) || def}
              weight={getVal(wtKey)}
              isDone={isDone(id)}
              onReps={(v) => setLog(id, v, week)}
              onWeight={(v) => setLog(wtKey, v, week)}
              onToggle={() => {
                const willComplete = !isDone(id);
                // Persist the pre-filled target reps if the box was left untouched.
                if (willComplete && !getVal(id) && def) setLog(id, def, week);
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
  lockWeek,
  singleDayIndex,
  embedded,
  serverLogs,
  serverSets,
}: {
  block: StrengthBlock;
  programId: string;
  initialWeek?: number;
  lockWeek?: number; // force this logging week and hide the week picker
  singleDayIndex?: number; // show only this day (with a compact Day toggle)
  embedded?: boolean; // trim the standalone bottom padding when inlined
  serverLogs?: Record<string, LoggedValue>; // synced reps/weights to hydrate
  serverSets?: string[]; // synced set completions to hydrate
}) {
  const wantWeek =
    lockWeek != null && block.weeks.includes(lockWeek)
      ? lockWeek
      : initialWeek != null && block.weeks.includes(initialWeek)
      ? initialWeek
      : block.weeks[0];
  const [targetWeek, setTargetWeek] = useState(wantWeek);

  // Keep the target week valid (and pinned to lockWeek) when the block changes.
  useEffect(() => {
    if (targetWeek !== wantWeek && (lockWeek != null || !block.weeks.includes(targetWeek))) {
      setTargetWeek(wantWeek);
    }
  }, [block, targetWeek, wantWeek, lockWeek]);

  const clampDay = (i: number) => Math.min(Math.max(0, i), block.days.length - 1);
  const [selectedDay, setSelectedDay] = useState(singleDayIndex != null ? clampDay(singleDayIndex) : 0);
  useEffect(() => {
    if (singleDayIndex != null) setSelectedDay(clampDay(singleDayIndex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleDayIndex, block.days.length]);

  const daysToShow = singleDayIndex != null ? block.days.filter((_, i) => i === selectedDay) : block.days;
  const weekIndex = Math.max(0, block.weeks.indexOf(targetWeek));
  const { isDone, toggle, set: setSet, setLog, getVal } = useSetProgress(programId, serverSets, serverLogs);

  // The person's own rest-timer preset (0 = use the program's prescribed rests).
  const [restPrefSec, setRestPrefSec] = useState(0);
  useEffect(() => setRestPrefSec(getRestPref(getProfileId())), []);

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
      beep();
      vibrate(300);
      setRest(null);
    }
  }, [rest]);

  const startRest = useCallback((seconds?: number) => {
    if (seconds && seconds > 0) {
      unlockAudio(); // arm the beep on the completing tap (iOS gesture requirement)
      setRest({ total: seconds, remaining: seconds });
    }
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
    <div className={embedded ? "pb-4" : "pb-24"}>
      {/* Week picker for logging */}
      {block.weeks.length > 1 && lockWeek == null && (
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

      {/* Strength-day toggle (single-day / inline mode) */}
      {singleDayIndex != null && block.days.length > 1 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-[var(--muted)]">Strength day</p>
          <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
            {block.days.map((d, i) => (
              <button
                key={d.label}
                onClick={() => setSelectedDay(i)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  backgroundColor: i === selectedDay ? "var(--accent)" + "30" : "var(--card)",
                  color: i === selectedDay ? "var(--accent)" : "var(--muted)",
                  borderWidth: 1,
                  borderColor: i === selectedDay ? "var(--accent)" + "50" : "transparent",
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {daysToShow.map((day) => {
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
                        week={targetWeek}
                        restPrefSec={restPrefSec}
                        idFor={(si) => `${targetWeek}|${day.label}|${row.name}|${si}`}
                        isDone={isDone}
                        toggle={toggle}
                        setSet={setSet}
                        getVal={getVal}
                        setLog={setLog}
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
