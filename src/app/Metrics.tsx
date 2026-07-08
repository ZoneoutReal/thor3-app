"use client";

import { useEffect, useMemo, useState } from "react";
import type { LoggedValue } from "@/lib/sync";
import { fmtClock, fmtDuration } from "@/lib/day-steps";

// One data point in a metric's history: the week it was logged and the value.
type Point = { week: number; n: number; raw: string };
type Series = {
  metric: string;
  label: string;
  isTime: boolean; // times are lower-is-better (pace); reps are higher-is-better
  points: Point[];
};

// Parse a logged value for plotting. Clock strings (mm:ss / h:mm:ss) become
// seconds and are treated as times; a plain number is read as-is. null = skip.
function toNumber(v: string): { n: number; isTime: boolean } | null {
  const t = v.trim();
  const clock = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (clock) {
    const h = clock[1] ? parseInt(clock[1], 10) : 0;
    return { n: h * 3600 + parseInt(clock[2], 10) * 60 + parseInt(clock[3], 10), isTime: true };
  }
  const num = parseFloat(t);
  return Number.isNaN(num) ? null : { n: num, isTime: false };
}

// Metrics that aren't a trend worth charting.
const HIDDEN = new Set(["note", "rpe", "session-start", "session-duration"]);

function humanize(metric: string): string {
  const run = metric.match(/^run-(\d+(?:\.\d+)?)(mi|km|m)$/);
  if (run) return `${run[1]} ${run[2]} run`;
  return metric.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSeries(logs: Record<string, LoggedValue>): Series[] {
  const byMetric = new Map<string, { pts: Point[]; isTime: boolean }>();
  for (const val of Object.values(logs)) {
    if (!val || !val.m || typeof val.w !== "number") continue;
    if (HIDDEN.has(val.m)) continue;
    if (/-\d+$/.test(val.m)) continue; // per-interval sub-metrics are noisy; skip
    const parsed = toNumber(val.v);
    if (!parsed) continue;
    const g = byMetric.get(val.m) ?? { pts: [], isTime: parsed.isTime };
    g.pts.push({ week: val.w, n: parsed.n, raw: val.v.trim() });
    byMetric.set(val.m, g);
  }

  const series: Series[] = [];
  for (const [metric, g] of byMetric) {
    // Collapse to one point per week (latest logged wins), then order by week.
    const perWeek = new Map<number, Point>();
    for (const p of g.pts) perWeek.set(p.week, p);
    const points = [...perWeek.values()].sort((a, b) => a.week - b.week);
    if (points.length < 2) continue; // need at least two points for a trend
    series.push({ metric, label: humanize(metric), isTime: g.isTime, points });
  }
  // Pace/time trends first, then reps; more history first within each group.
  return series.sort(
    (a, b) => Number(b.isTime) - Number(a.isTime) || b.points.length - a.points.length
  );
}

function fmtValue(n: number, isTime: boolean): string {
  if (!isTime) return Number.isInteger(n) ? String(n) : n.toFixed(1);
  return n >= 3600 ? fmtDuration(n) : fmtClock(n);
}

function fmtDelta(absSec: number, isTime: boolean): string {
  if (!isTime) return String(absSec);
  return absSec >= 60 ? fmtClock(absSec) : `${absSec}s`;
}

// --- Minimal SVG line chart -------------------------------------------------

function LineChart({ series }: { series: Series }) {
  const W = 320;
  const H = 96;
  const padX = 10;
  const padTop = 14;
  const padBot = 16;
  const { points, isTime } = series;

  const ys = points.map((p) => p.n);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || 1;
  const x = (i: number) => padX + (i * (W - 2 * padX)) / (points.length - 1);
  const y = (n: number) => padTop + (1 - (n - min) / range) * (H - padTop - padBot);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.n).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`${series.label} trend`}>
      {/* baseline */}
      <line x1={padX} y1={H - padBot} x2={W - padX} y2={H - padBot} stroke="var(--border)" strokeWidth="1" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(p.n)}
          r={i === points.length - 1 ? 3.5 : 2.5}
          fill={i === points.length - 1 ? "var(--accent)" : "var(--background)"}
          stroke="var(--accent)"
          strokeWidth="1.5"
        />
      ))}
      {/* week labels */}
      {points.map((p, i) => (
        <text key={i} x={x(i)} y={H - 4} textAnchor="middle" className="fill-[var(--muted)]" style={{ fontSize: 8 }}>
          W{p.week}
        </text>
      ))}
      {/* latest value label */}
      <text
        x={x(points.length - 1)}
        y={Math.max(9, y(last.n) - 6)}
        textAnchor="end"
        className="fill-[var(--foreground)]"
        style={{ fontSize: 9, fontWeight: 700 }}
      >
        {fmtValue(last.n, isTime)}
      </text>
    </svg>
  );
}

function MetricCard({ series }: { series: Series }) {
  const { points, isTime } = series;
  const last = points[points.length - 1].n;
  const prev = points[points.length - 2].n;
  const delta = last - prev; // change vs the previous session
  const improved = isTime ? delta < 0 : delta > 0;
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "–";
  const word = isTime
    ? delta < 0
      ? "faster"
      : delta > 0
      ? "slower"
      : "no change"
    : delta > 0
    ? "more"
    : delta < 0
    ? "fewer"
    : "no change";
  const color = delta === 0 ? "var(--muted)" : improved ? "var(--success)" : "#ef4444";
  const best = isTime ? Math.min(...points.map((p) => p.n)) : Math.max(...points.map((p) => p.n));

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--foreground)]">{series.label}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {isTime ? "Best" : "Peak"} {fmtValue(best, isTime)} &middot; {points.length} sessions
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-lg font-bold tabular-nums text-[var(--foreground)]">
            {fmtValue(last, isTime)}
          </p>
          <p className="text-xs font-semibold" style={{ color }}>
            {arrow} {delta === 0 ? word : `${fmtDelta(Math.abs(delta), isTime)} ${word}`}
          </p>
        </div>
      </div>
      <LineChart series={series} />
    </div>
  );
}

export function Metrics({
  serverLogs,
  profileId,
  programId,
}: {
  serverLogs: Record<string, LoggedValue>;
  profileId: string | null;
  programId: string;
}) {
  // Merge the synced snapshot with this device's local log (local wins), so a
  // just-logged value shows up before the next sync round-trip.
  const [logs, setLogs] = useState<Record<string, LoggedValue>>(serverLogs);
  useEffect(() => {
    let local: Record<string, LoggedValue> = {};
    try {
      const key = profileId ? `thor3-logs-${profileId}-${programId}` : `thor3-logs-${programId}`;
      local = JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      /* ignore */
    }
    setLogs({ ...serverLogs, ...local });
  }, [serverLogs, profileId, programId]);

  const series = useMemo(() => buildSeries(logs), [logs]);
  const paceCount = series.filter((s) => s.isTime).length;

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold">Metrics</h2>
        <p className="text-xs text-[var(--muted)]">
          {series.length > 0
            ? `Your times and reps over the weeks${paceCount ? " · pace trends first" : ""}`
            : "Trends across the weeks"}
        </p>
      </div>

      {series.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-12 text-center">
          <p className="text-sm font-semibold text-[var(--foreground)]">No trends yet</p>
          <p className="mx-auto mt-1.5 max-w-xs text-xs text-[var(--muted)]">
            Log the same workout (like a timed run) in a couple of different weeks and its pace
            trend shows up here, with how many seconds you gained or lost.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {series.map((s) => (
            <MetricCard key={s.metric} series={s} />
          ))}
        </div>
      )}
    </div>
  );
}
