"use client";

import { useState } from "react";
import {
  strengthBlocks,
  DYNAMIC_WARMUP,
  getStrengthBlockForWeek,
  type StrengthDay,
  type StrengthBlock,
} from "@/lib/program-data";
import { WorkoutMode } from "./WorkoutMode";

function DayHeader({ day }: { day: StrengthDay }) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <span
        className="rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider"
        style={{ backgroundColor: "var(--accent)" + "22", color: "var(--accent)" }}
      >
        {day.label}
      </span>
      {day.title && (
        <span className="text-sm font-semibold text-[var(--foreground)]">{day.title}</span>
      )}
    </div>
  );
}

function TableDay({
  day,
  block,
  highlightWeek,
}: {
  day: StrengthDay;
  block: StrengthBlock;
  highlightWeek?: number;
}) {
  const rows = day.rows ?? [];
  return (
    <div className="hide-scrollbar overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-[var(--card)] text-[var(--muted)]">
            <th className="sticky left-0 z-10 bg-[var(--card)] px-3 py-2 text-left font-semibold">
              Exercise
            </th>
            {block.weekLabels.map((wl, i) => {
              const isHi = highlightWeek != null && block.weeks[i] === highlightWeek;
              return (
                <th
                  key={wl}
                  className="min-w-[68px] px-2 py-2 text-center font-semibold"
                  style={isHi ? { color: "var(--accent)" } : undefined}
                >
                  {wl}
                </th>
              );
            })}
            <th className="min-w-[52px] px-2 py-2 text-center font-semibold">Rest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const prevGroup = ri > 0 ? rows[ri - 1].group : undefined;
            const newGroup = row.group !== prevGroup;
            const uniform = typeof row.prescription === "string";
            return (
              <tr
                key={row.name}
                className="align-top"
                style={{
                  borderTop: newGroup ? "2px solid var(--border)" : "1px solid var(--border)",
                }}
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[var(--background)] px-3 py-2 text-left font-medium text-[var(--foreground)]"
                >
                  <span className="flex items-start gap-1.5">
                    {row.group && (
                      <span className="mt-0.5 text-[10px] font-bold text-[var(--muted)]">
                        {row.group}
                      </span>
                    )}
                    <span>{row.name}</span>
                  </span>
                </th>
                {uniform ? (
                  <td
                    colSpan={block.weekLabels.length}
                    className="px-2 py-2 text-center text-[var(--foreground)]"
                  >
                    {row.prescription as string}
                  </td>
                ) : (
                  (row.prescription as string[]).map((val, i) => {
                    const isHi = highlightWeek != null && block.weeks[i] === highlightWeek;
                    return (
                      <td
                        key={block.weekLabels[i]}
                        className="px-2 py-2 text-center"
                        style={{
                          color: isHi ? "var(--accent)" : "var(--foreground)",
                          fontWeight: isHi ? 700 : 400,
                          backgroundColor: isHi ? "var(--accent)" + "12" : undefined,
                        }}
                      >
                        {val}
                      </td>
                    );
                  })
                )}
                <td className="px-2 py-2 text-center text-[var(--muted)]">{row.rest ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LadderDay({
  day,
  block,
  highlightWeek,
}: {
  day: StrengthDay;
  block: StrengthBlock;
  highlightWeek?: number;
}) {
  const steps = day.ladder ?? [];
  return (
    <div>
      {day.note && <p className="mb-2 text-xs text-[var(--muted)]">{day.note}</p>}
      <div className="hide-scrollbar overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--card)] text-[var(--muted)]">
              <th className="sticky left-0 z-10 bg-[var(--card)] px-3 py-2 text-left font-semibold">
                Set
              </th>
              {block.weekLabels.map((wl, i) => {
                const isHi = highlightWeek != null && block.weeks[i] === highlightWeek;
                return (
                  <th
                    key={wl}
                    className="min-w-[104px] px-2 py-2 text-center font-semibold"
                    style={isHi ? { color: "var(--accent)" } : undefined}
                  >
                    {wl}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {steps.map((step, si) => (
              <tr key={si} className="border-t border-[var(--border)]">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[var(--background)] px-3 py-2 text-left font-medium text-[var(--muted)]"
                >
                  {si + 1}
                </th>
                {step.map((val, i) => {
                  const isHi = highlightWeek != null && block.weeks[i] === highlightWeek;
                  return (
                    <td
                      key={block.weekLabels[i]}
                      className="whitespace-nowrap px-2 py-2 text-center"
                      style={{
                        color: isHi ? "var(--accent)" : "var(--foreground)",
                        fontWeight: isHi ? 700 : 400,
                        backgroundColor: isHi ? "var(--accent)" + "12" : undefined,
                      }}
                    >
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CircuitDay({ day }: { day: StrengthDay }) {
  const rows = day.rows ?? [];
  return (
    <div className="rounded-lg border border-[var(--border)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2">
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
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((row, ri) => {
            const prevGroup = ri > 0 ? rows[ri - 1].group : undefined;
            const newGroup = row.group !== prevGroup;
            return (
              <tr
                key={row.name}
                style={{
                  borderTop: newGroup ? "2px solid var(--border)" : "1px solid var(--border)",
                }}
              >
                <td className="px-3 py-2 text-left font-medium text-[var(--foreground)]">
                  {row.name}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-[var(--foreground)]">
                  {row.prescription as string}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WarmUp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-[var(--foreground)]">
          Dynamic Warm-Up
          <span className="ml-2 text-xs font-normal text-[var(--muted)]">before every session</span>
        </span>
        <svg
          className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] px-4 pb-3 pt-2">
          <p className="mb-2 text-xs text-[var(--muted)]">Perform each movement over 10-15 yards.</p>
          <ul className="grid gap-x-4 gap-y-1 text-sm text-[var(--foreground)] sm:grid-cols-2">
            {DYNAMIC_WARMUP.map((m) => (
              <li key={m} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function StrengthSheet({
  onClose,
  initialWeek,
  programId = "10week",
}: {
  onClose: () => void;
  initialWeek?: number;
  programId?: string;
}) {
  const initialBlock = initialWeek != null ? getStrengthBlockForWeek(initialWeek) : undefined;
  const [activeTitle, setActiveTitle] = useState(
    initialBlock?.title ?? strengthBlocks[0].title
  );
  const [mode, setMode] = useState<"workout" | "reference">("workout");
  const block = strengthBlocks.find((b) => b.title === activeTitle) ?? strengthBlocks[0];
  const highlightWeek = block.weeks.includes(initialWeek ?? -1) ? initialWeek : undefined;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Strength Sheet</h2>
            <p className="text-xs text-[var(--muted)]">SFAS 10 Week Program</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--card)] text-[var(--muted)] transition-colors hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]"
            aria-label="Close strength sheet"
          >
            &#x2715;
          </button>
        </div>
        {/* Block selector */}
        <div className="mx-auto max-w-lg px-4 pb-3">
          <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
            {strengthBlocks.map((b) => (
              <button
                key={b.title}
                onClick={() => setActiveTitle(b.title)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  backgroundColor:
                    b.title === activeTitle ? "var(--accent)" + "30" : "var(--card)",
                  color: b.title === activeTitle ? "var(--accent)" : "var(--muted)",
                  borderWidth: 1,
                  borderColor:
                    b.title === activeTitle ? "var(--accent)" + "50" : "transparent",
                }}
              >
                {b.title}
              </button>
            ))}
          </div>
        </div>
        {/* Mode toggle */}
        <div className="mx-auto max-w-lg px-4 pb-3">
          <div className="flex gap-1 rounded-lg bg-[var(--card)] p-1">
            {(["workout", "reference"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 rounded-md py-1.5 text-xs font-semibold capitalize transition-colors"
                style={{
                  backgroundColor: mode === m ? "var(--accent)" : "transparent",
                  color: mode === m ? "#000" : "var(--muted)",
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg space-y-5 px-4 py-4">
          <WarmUp />
          {mode === "workout" ? (
            <WorkoutMode block={block} programId={programId} initialWeek={initialWeek} />
          ) : (
            <>
              {block.days.map((day) => (
                <section key={day.label}>
                  <DayHeader day={day} />
                  {day.kind === "table" && (
                    <TableDay day={day} block={block} highlightWeek={highlightWeek} />
                  )}
                  {day.kind === "ladder" && (
                    <LadderDay day={day} block={block} highlightWeek={highlightWeek} />
                  )}
                  {day.kind === "circuit" && <CircuitDay day={day} />}
                </section>
              ))}
              <p className="pt-1 text-center text-xs text-[var(--muted)]">
                Strength days rotate through the days above. Reps periodize across the block.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
