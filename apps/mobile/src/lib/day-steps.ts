// Turns a program day's freeform description lines into structured, loggable
// steps for the Fitbod-style day logger: each step carries an expanded
// instruction, the number to record (reps / time / distance), and a timer
// (countdown or stopwatch) whenever a duration is prescribed. Driven by the
// day's authoritative `type`, with light per-line parsing; anything we don't
// recognize degrades to a plain checkable step so nothing is ever un-loggable.

import type { DayWorkout, WorkoutType } from "./program-data";

export type LogInput = "reps" | "time" | "distance" | "none";

export type StepTimer =
  | { mode: "countdown"; seconds: number }
  | { mode: "stopwatch" }
  | null;

export type DayStep = {
  id: string; // stable within a day: "<sessionIdx>-<stepIdx>"
  kind: "log" | "info" | "strength";
  label: string;
  instruction?: string;
  input: LogInput;
  unit?: string; // "reps" | "mm:ss" | "mi" | "km" | "m"
  timer: StepTimer;
  rest?: number; // seconds of rest that follow this step
  metric?: string; // semantic key for week-over-week history (e.g. "pushups")
};

export type LoggableSession = { label?: string; steps: DayStep[] };

// --- line parsing helpers ---------------------------------------------------

// "2 minutes" / "5 min" / "10:00" / "0:30" / "45 seconds" -> seconds
export function durationSeconds(s: string): number | null {
  const clock = s.match(/(\d+):(\d{2})/);
  if (clock) return parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10);
  const min = s.match(/(\d+(?:\.\d+)?)\s*min/i);
  if (min) return Math.round(parseFloat(min[1]) * 60);
  const sec = s.match(/(\d+)\s*sec/i);
  if (sec) return parseInt(sec[1], 10);
  return null;
}

// "4 x 800 meters" / "3 x 10 minutes" / "3 rounds x 10 minutes at threshold pace"
function intervals(s: string): { count: number; distance?: string; seconds?: number } | null {
  const m = s.match(/(\d+)\s*(?:rounds?\s*)?x\s*(.+)/i);
  if (!m) return null;
  const count = parseInt(m[1], 10);
  const rest = m[2];
  const secs = durationSeconds(rest);
  if (secs) return { count, seconds: secs };
  const dist = rest.match(/\d+(?:\.\d+)?\s*(?:meters?|m|miles?|mi|km)\b/i);
  if (dist) return { count, distance: dist[0].trim() };
  return { count };
}

function distanceUnit(s: string): { value: number; unit: string } | null {
  const m = s.match(/(\d+(?:\.\d+)?)\s*(miles?|mi|km|kilometers?|meters?|m)\b/i);
  if (!m) return null;
  const raw = m[2].toLowerCase();
  const unit = raw.startsWith("mile") || raw === "mi" ? "mi" : raw.startsWith("k") ? "km" : "m";
  return { value: parseFloat(m[1]), unit };
}

function restSeconds(s: string): number | null {
  if (!/rest|between/i.test(s)) return null;
  return durationSeconds(s);
}

const isHeaderLine = (s: string) =>
  /^(APFT|RUN|BIKE|RUCK|REST|WALK|SWIM|NON-IMPACT CONDITIONING|STRENGTH TRAINING)\b/i.test(s.trim().replace(/:$/, "")) &&
  !/\d/.test(s.replace(/^[^:]*:/, "")); // header with no prescription after the colon

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);

// --- main entry -------------------------------------------------------------

export function parseDay(day: DayWorkout): LoggableSession[] {
  return day.sessions.map((session, si) => {
    const steps: DayStep[] = [];
    const push = (s: Omit<DayStep, "id">) => steps.push({ ...s, id: `${si}-${steps.length}` });

    session.description.forEach((raw) => {
      const line = raw.trim();
      if (!line) return;

      // Strength: hand off to the dedicated strength sheet.
      if (/strength training/i.test(line) && /strength sheet/i.test(line)) {
        push({ kind: "strength", label: "Strength training", input: "none", timer: null });
        return;
      }
      // Pure headers / parentheticals / plain REST -> context only.
      if (/^rest$/i.test(line)) return;
      if (isHeaderLine(line) || /^\(.*\)$/.test(line)) {
        push({ kind: "info", label: line.replace(/:$/, ""), input: "none", timer: null });
        return;
      }
      // Metadata rows on a ruck (Load / Pace / bare Distance) -> context.
      if (/^(load|pace)\s*:/i.test(line)) {
        push({ kind: "info", label: line, input: "none", timer: null });
        return;
      }

      // Rest specifiers attach to the previous loggable step.
      const rest = restSeconds(line);
      if (rest && /rest/i.test(line) && !intervals(line)) {
        const prev = [...steps].reverse().find((s) => s.kind === "log");
        if (prev) prev.rest = rest;
        else push({ kind: "info", label: line, input: "none", timer: null });
        return;
      }

      // Interval sets: expand into one loggable rep per interval.
      const iv = intervals(line);
      if (iv) {
        for (let i = 1; i <= iv.count; i++) {
          if (iv.distance) {
            push({
              kind: "log",
              label: `Interval ${i}/${iv.count} - ${iv.distance}`,
              instruction: i === 1 ? `${iv.count} x ${iv.distance}, hard effort. Record each rep's time.` : undefined,
              input: "time",
              unit: "mm:ss",
              timer: { mode: "stopwatch" },
              metric: `${slug(iv.distance)}-${i}`,
            });
          } else if (iv.seconds) {
            push({
              kind: "log",
              label: `Interval ${i}/${iv.count} - ${Math.round(iv.seconds / 60)} min`,
              instruction: i === 1 ? `${iv.count} intervals at the prescribed pace.` : undefined,
              input: "none",
              timer: { mode: "countdown", seconds: iv.seconds },
              metric: `int-${i}`,
            });
          } else {
            push({ kind: "log", label: `Round ${i}/${iv.count}`, input: "none", timer: null });
          }
        }
        return;
      }

      // AMRAP: reps for a fixed time window.
      if (/amrap|as many/i.test(line)) {
        const secs = durationSeconds(line);
        const name = line.split(":")[0].trim();
        push({
          kind: "log",
          label: name,
          instruction: `As many reps as possible${secs ? ` in ${fmtClock(secs)}` : ""}. Strict form.`,
          input: "reps",
          unit: "reps",
          timer: secs ? { mode: "countdown", seconds: secs } : null,
          metric: slug(name),
        });
        return;
      }

      // "for time" / "time trial" / "as fast as possible" -> record your time.
      if (/for time|time trial|as fast/i.test(line)) {
        const d = distanceUnit(line);
        const name = line.replace(/for time.*/i, "").replace(/:$/, "").trim() || "Effort";
        push({
          kind: "log",
          label: name,
          instruction: "Max sustainable effort. Record your finish time.",
          input: "time",
          unit: "mm:ss",
          timer: { mode: "stopwatch" },
          metric: d ? `run-${d.value}${d.unit}` : slug(name),
        });
        return;
      }

      // A distance run/ruck/walk header-with-distance, or "tempo"/"easy" run.
      const dist = distanceUnit(line);
      const secs = durationSeconds(line);
      if (dist || /tempo|easy|threshold|moderate|fast/i.test(line) || secs) {
        const tempo = /tempo/i.test(line);
        const easy = /easy/i.test(line);
        const label = line.replace(/^(run|ruck|walk|bike):\s*/i, "").replace(/:$/, "") || line;
        push({
          kind: "log",
          label,
          instruction: tempo
            ? "Comfortably hard, sustainable pace. Record your time."
            : easy
            ? "Conversational, easy pace."
            : "Record your time.",
          input: dist ? "time" : secs ? "none" : "time",
          unit: dist ? "mm:ss" : undefined,
          timer: secs ? { mode: "countdown", seconds: secs } : { mode: "stopwatch" },
          metric: dist ? `run-${dist.value}${dist.unit}` : undefined,
        });
        return;
      }

      // Fallback: a plain checkable step carrying the original text.
      push({ kind: "log", label: line, input: "none", timer: null });
    });

    return { label: session.label, steps };
  });
}

export function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Like fmtClock but grows an hours field for long sessions: 90 -> "1:30",
// 3725 -> "1:02:05". Used for the whole-workout timer.
export function fmtDuration(totalSec: number): string {
  const t = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Miles covered by a run/ruck step, pulled from its text (label or metric).
// Returns null when there's no distance to read.
export function distanceMiles(text: string): number | null {
  const d = distanceUnit(text);
  if (!d) return null;
  if (d.unit === "mi") return d.value;
  if (d.unit === "km") return d.value * 0.621371;
  return d.value / 1609.344; // meters
}

// A logged run time to seconds. Accepts a clock ("19:07", "1:02:05") and a
// plain/decimal number, which is read as MINUTES ("18.25" -> 18¼ min = 1095s).
// Nobody logs a multi-mile run in seconds, so a bare number on a distance set
// is unambiguously minutes — this is what lets pace show for "18.25"-style
// entries where the user typed a period instead of a colon. Returns null for
// anything unparseable (empty, text) so pace simply doesn't render.
export function timeToSeconds(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const clock = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/);
  if (clock) {
    const h = clock[1] ? parseInt(clock[1], 10) : 0;
    const min = parseInt(clock[2], 10);
    const sec = parseInt(clock[3], 10);
    if (sec >= 60) return null;
    return h * 3600 + min * 60 + sec;
  }
  if (/^\d+(?:\.\d+)?$/.test(t)) return Math.round(parseFloat(t) * 60); // minutes
  return null;
}

// Pace per mile for a timed running set, e.g. "9:34 /mi". Null when the step
// isn't a timed distance or the value isn't a readable time.
export function pacePerMile(step: DayStep, value: string): string | null {
  if (step.input !== "time") return null;
  const miles = distanceMiles(step.label) ?? distanceMiles(step.metric ?? "");
  if (!miles || miles <= 0) return null;
  const secs = timeToSeconds(value);
  if (secs == null || secs <= 0) return null;
  return `${fmtClock(Math.round(secs / miles))} /mi`;
}

// Does this day have anything worth logging (i.e. not a pure rest day)?
export function isLoggable(type: WorkoutType): boolean {
  return type !== "rest";
}
