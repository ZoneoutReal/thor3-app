"use client";

import { useState } from "react";
import { parseDay, fmtDuration, pacePerMile } from "@/lib/day-steps";
import { getProgram, DAY_LABELS, TYPE_META, type DayWorkout } from "@/lib/program-data";
import type { LoggedValue } from "@/lib/sync";
import type { Profile } from "@/lib/profiles";

// Read-only mirror of the day logger: shows one member's recorded workout so
// anyone on the Together tab can look at what they actually did, without any
// inputs, timers, or toggles. Everything comes from the shared snapshot, so no
// writes ever happen here.
export function PersonDetail({
  profile,
  days,
  sets,
  logs,
  programId,
  isMe,
  onClose,
}: {
  profile: Profile;
  days: string[];
  sets: string[];
  logs: Record<string, LoggedValue>;
  programId: string;
  isMe: boolean;
  onClose: () => void;
}) {
  const program = getProgram(programId) ?? getProgram("10week")!;
  const weeks = program.data;
  const doneDays = new Set(days);
  const doneSets = new Set(sets);

  // A day is worth listing if it was marked complete or carries any logged
  // value (step reps/times, duration, RPE, or a note). Keys are day-scoped as
  // `${week}-${day}-...`; the trailing dash keeps day 1-1 from matching 1-10.
  const hasActivity = (week: number, day: DayWorkout) => {
    if (day.type === "rest") return false;
    const prefix = `${week}-${day.day}`;
    if (doneDays.has(prefix)) return true;
    const meta = new Set([`note-${prefix}`, `rpe-${prefix}`, `session-dur-${prefix}`, `session-start-${prefix}`]);
    if (Object.keys(logs).some((k) => meta.has(k) || k.startsWith(`${prefix}-`))) return true;
    return sets.some((s) => s.startsWith(`${prefix}-`));
  };

  const [open, setOpen] = useState<string | null>(null);

  const totalLogged = weeks.reduce(
    (sum, w) => sum + w.days.filter((d) => hasActivity(w.week, d)).length,
    0
  );

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--card)] text-[var(--muted)]"
            aria-label="Close"
          >
            ✕
          </button>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold"
            style={{ backgroundColor: "var(--accent)" + "22", color: "var(--accent)" }}
          >
            {profile.display_name.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold">
              {profile.display_name}
              {isMe ? " (You)" : ""}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              {totalLogged} workout{totalLogged === 1 ? "" : "s"} logged · read-only
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-4">
          {totalLogged === 0 ? (
            <p className="py-16 text-center text-sm text-[var(--muted)]">No workouts logged yet.</p>
          ) : (
            weeks.map((w) => {
              const active = w.days.filter((d) => hasActivity(w.week, d));
              if (active.length === 0) return null;
              return (
                <div key={w.week} className="flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Week {w.week}
                  </p>
                  {active.map((day) => {
                    const key = `${w.week}-${day.day}`;
                    return (
                      <ReadOnlyDay
                        key={key}
                        day={day}
                        week={w.week}
                        complete={doneDays.has(key)}
                        logs={logs}
                        doneSets={doneSets}
                        expanded={open === key}
                        onToggle={() => setOpen((cur) => (cur === key ? null : key))}
                      />
                    );
                  })}
                </div>
              );
            })
          )}

          <p className="pt-2 text-center text-[11px] text-[var(--muted)]">
            Viewing {isMe ? "your" : `${profile.display_name.split(" ")[0]}'s`} recorded workouts. Nothing here can be edited.
          </p>
        </div>
      </main>
    </div>
  );
}

// One collapsed/expanded day, mirroring the logger's read-out values.
function ReadOnlyDay({
  day,
  week,
  complete,
  logs,
  doneSets,
  expanded,
  onToggle,
}: {
  day: DayWorkout;
  week: number;
  complete: boolean;
  logs: Record<string, LoggedValue>;
  doneSets: Set<string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = TYPE_META[day.type];
  const prefix = `${week}-${day.day}`;
  const durV = logs[`session-dur-${prefix}`]?.v;
  const durationSec = durV ? parseInt(durV, 10) : null;
  const rpe = logs[`rpe-${prefix}`]?.v;
  const note = logs[`note-${prefix}`]?.v;
  const sessions = parseDay(day);

  return (
    <div
      className="rounded-lg border transition-all"
      style={{
        borderColor: complete ? "#22c55e44" : expanded ? meta.color + "44" : "var(--border)",
        backgroundColor: complete ? "#22c55e08" : expanded ? meta.color + "08" : "var(--card)",
      }}
    >
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
          style={{ backgroundColor: meta.color + "20" }}
        >
          {complete ? <span className="text-[var(--success)]">&#10003;</span> : meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--muted)]">{DAY_LABELS[day.day - 1]}</span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider"
              style={{ backgroundColor: meta.color + "22", color: meta.color }}
            >
              <span>{meta.icon}</span>
              {meta.label}
            </span>
            {durationSec != null && (
              <span className="ml-auto shrink-0 font-mono text-[11px] font-semibold text-[var(--muted)]">
                {fmtDuration(durationSec)}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-[var(--foreground)]">
            {day.sessions[0]?.description[0] ?? ""}
          </p>
        </div>
        <svg
          className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-3 pt-2" style={{ borderColor: "var(--border)" }}>
          {durationSec != null && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-[var(--background)] px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Workout time
              </span>
              <span className="font-mono text-lg font-bold" style={{ color: "var(--success)" }}>
                {fmtDuration(durationSec)}
              </span>
            </div>
          )}

          {sessions.map((session, si) => (
            <div key={si} className={si > 0 ? "mt-3 border-t border-[var(--border)] pt-3" : ""}>
              {session.label && (
                <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: meta.color }}>
                  {session.label}
                </p>
              )}
              {session.steps.map((step) => {
                if (step.kind === "info") {
                  return (
                    <p key={step.id} className="px-1 py-0.5 text-xs text-[var(--muted)]">
                      {step.label}
                    </p>
                  );
                }
                if (step.kind === "strength") {
                  return (
                    <p key={step.id} className="py-1 text-sm font-semibold" style={{ color: "var(--accent)" }}>
                      🏋️ Strength training
                    </p>
                  );
                }
                const stepDone = doneSets.has(`${prefix}-${step.id}`);
                const val = logs[`${prefix}-${step.id}`]?.v;
                const pace = val ? pacePerMile(step, val) : null;
                return (
                  <div key={step.id} className="flex items-start gap-2 py-1">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs"
                      style={{
                        backgroundColor: stepDone ? "var(--success)" : "transparent",
                        borderWidth: stepDone ? 0 : 1,
                        borderColor: "var(--border)",
                        color: stepDone ? "#000" : "var(--muted)",
                      }}
                    >
                      {stepDone ? "✓" : ""}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--foreground)]">{step.label}</p>
                      {val ? (
                        <p className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                          {val}
                          {step.input === "reps" ? " reps" : ""}
                          {pace ? <span className="text-[var(--muted)]"> · {pace}</span> : null}
                        </p>
                      ) : (
                        <p className="text-xs text-[var(--muted)]">not logged</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {(rpe || note) && (
            <div className="mt-3 rounded-lg bg-[var(--background)] px-3 py-2">
              {rpe && (
                <p className="text-xs text-[var(--muted)]">
                  Effort: <span className="font-semibold text-[var(--foreground)]">{rpe}/10</span>
                </p>
              )}
              {note && <p className="mt-1 text-sm text-[var(--foreground)]">{note}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
