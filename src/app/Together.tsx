"use client";

import { useState } from "react";
import { getProgram } from "@/lib/program-data";
import type { Snapshot } from "@/lib/sync";
import { PersonDetail } from "./PersonDetail";

function timeAgo(iso?: string): string {
  if (!iso) return "no activity yet";
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

// Shared view: both brothers' progress side by side, from the server snapshot.
export function Together({
  snapshot,
  myProfileId,
  myDays,
  programId,
  onRefresh,
  refreshing,
}: {
  snapshot: Snapshot;
  myProfileId: string | null;
  myDays: string[];
  programId: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const program = getProgram(programId) ?? getProgram("10week")!;
  const weeks = program.data;
  const total = weeks.reduce((s, w) => s + w.days.length, 0);

  // Which member's read-only workout details are open (null = the list).
  const [detailId, setDetailId] = useState<string | null>(null);

  const progById = Object.fromEntries(
    snapshot.progress.filter((p) => p.program === programId).map((p) => [p.profile, p])
  );

  const detailProfile = detailId ? snapshot.profiles.find((p) => p.id === detailId) : null;
  const detailRow = detailId ? progById[detailId] : undefined;

  const cards = snapshot.profiles.map((pr) => {
    const row = progById[pr.id];
    // My own card reflects live local state; others come from the snapshot.
    const days = new Set(pr.id === myProfileId ? myDays : row?.days ?? []);
    const perWeek = weeks.map((w) => ({
      week: w.week,
      total: w.days.length,
      done: w.days.filter((d) => days.has(`${w.week}-${d.day}`)).length,
    }));
    const doneCount = perWeek.reduce((s, w) => s + w.done, 0);
    const weeksComplete = perWeek.filter((w) => w.total > 0 && w.done === w.total).length;
    return { pr, doneCount, perWeek, weeksComplete, updated: row?.updated_at };
  });

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Together</h2>
          <p className="text-xs text-[var(--muted)]">Everyone&apos;s progress, side by side</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--card)] text-[var(--muted)] transition-colors hover:bg-[var(--card-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
          aria-label="Refresh"
        >
          <svg
            className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 4v5h5 M20 20v-5h-5 M20 9a8 8 0 00-14.9-2 M4 15a8 8 0 0014.9 2" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {cards.map(({ pr, doneCount, perWeek, weeksComplete, updated }) => {
          const pct = total > 0 ? (doneCount / total) * 100 : 0;
          const isMe = pr.id === myProfileId;
          return (
            <button
              key={pr.id}
              onClick={() => setDetailId(pr.id)}
              className="w-full rounded-xl border p-4 text-left transition-colors hover:bg-[var(--card-hover)]"
              style={{
                borderColor: isMe ? "var(--accent)" + "50" : "var(--border)",
                backgroundColor: isMe ? "var(--accent)" + "08" : "var(--card)",
              }}
              aria-label={`View ${pr.display_name}'s workout details`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold"
                  style={{ backgroundColor: "var(--accent)" + "22", color: "var(--accent)" }}
                >
                  {pr.display_name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base font-semibold text-[var(--foreground)]">
                      {pr.display_name}
                    </p>
                    {isMe && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: "var(--accent)" + "22", color: "var(--accent)" }}
                      >
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)]">Active {timeAgo(updated)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold" style={{ color: "var(--accent)" }}>
                    {doneCount}
                    <span className="text-xs text-[var(--muted)]">/{total}</span>
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">workouts</p>
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: "var(--success)" }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--muted)]">
                <span>{Math.round(pct)}% complete</span>
                <span>
                  {weeksComplete}/{weeks.length} weeks done
                </span>
              </div>

              <div className="mt-3 flex gap-1">
                {perWeek.map((w) => {
                  const r = w.total > 0 ? w.done / w.total : 0;
                  return (
                    <div key={w.week} className="flex-1 text-center">
                      <div
                        className="h-6 rounded"
                        style={{
                          backgroundColor:
                            r === 0
                              ? "var(--border)"
                              : r >= 1
                              ? "var(--success)"
                              : `rgba(34,197,94,${0.25 + r * 0.5})`,
                        }}
                        title={`Week ${w.week}: ${w.done}/${w.total}`}
                      />
                      <span className="mt-0.5 block text-[9px] text-[var(--muted)]">{w.week}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-end gap-1 text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
                <span>View workout details</span>
                <span aria-hidden>&#8594;</span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[11px] text-[var(--muted)]">
        Week grid, left to right = weeks 1&ndash;{weeks.length}. Green means done. Tap a card to see the details.
      </p>

      {detailProfile && (
        <PersonDetail
          profile={detailProfile}
          days={detailProfile.id === myProfileId ? myDays : detailRow?.days ?? []}
          sets={detailRow?.sets ?? []}
          logs={detailRow?.logs ?? {}}
          programId={programId}
          isMe={detailProfile.id === myProfileId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
