import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { fmtClock, fmtDuration, timeToSeconds } from '@/lib/day-steps';
import { getItem } from '@/lib/store';
import type { LoggedValue } from '@/lib/sync';
import { colors } from '@/lib/theme';

type Point = { week: number; n: number; raw: string };
type Series = { metric: string; label: string; isTime: boolean; points: Point[] };

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

const HIDDEN = new Set(['note', 'rpe', 'session-start', 'session-duration']);

function humanize(metric: string): string {
  const run = metric.match(/^run-(\d+(?:\.\d+)?)(mi|km|m)$/);
  if (run) return `${run[1]} ${run[2]} run`;
  return metric.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function metricMiles(metric: string): number | null {
  const m = metric.match(/^run-(\d+(?:\.\d+)?)(mi|km|m)$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return m[2] === 'mi' ? v : m[2] === 'km' ? v * 0.621371 : v / 1609.344;
}
function paceStr(sec: number, miles: number): string {
  return `${fmtClock(Math.round(sec / miles))} /mi`;
}

function buildSeries(logs: Record<string, LoggedValue>): Series[] {
  const byMetric = new Map<string, { pts: Point[]; isTime: boolean }>();
  for (const val of Object.values(logs)) {
    if (!val || !val.m || typeof val.w !== 'number') continue;
    if (HIDDEN.has(val.m)) continue;
    if (/-\d+$/.test(val.m)) continue;
    const isRun = metricMiles(val.m) != null;
    const parsed = isRun
      ? (() => {
          const s = timeToSeconds(val.v);
          return s == null ? null : { n: s, isTime: true };
        })()
      : toNumber(val.v);
    if (!parsed) continue;
    const g = byMetric.get(val.m) ?? { pts: [], isTime: parsed.isTime };
    g.pts.push({ week: val.w, n: parsed.n, raw: val.v.trim() });
    byMetric.set(val.m, g);
  }
  const series: Series[] = [];
  for (const [metric, g] of byMetric) {
    const perWeek = new Map<number, Point>();
    for (const p of g.pts) perWeek.set(p.week, p);
    const points = [...perWeek.values()].sort((a, b) => a.week - b.week);
    if (points.length < 2) continue;
    series.push({ metric, label: humanize(metric), isTime: g.isTime, points });
  }
  return series.sort((a, b) => Number(b.isTime) - Number(a.isTime) || b.points.length - a.points.length);
}

function fmtValue(n: number, isTime: boolean): string {
  if (!isTime) return Number.isInteger(n) ? String(n) : n.toFixed(1);
  return n >= 3600 ? fmtDuration(n) : fmtClock(n);
}
function fmtDelta(absSec: number, isTime: boolean): string {
  if (!isTime) return String(absSec);
  return absSec >= 60 ? fmtClock(absSec) : `${absSec}s`;
}

// --- react-native-svg line chart --------------------------------------------

function LineChart({ series }: { series: Series }) {
  const W = 320;
  const H = 100;
  const padX = 10;
  const padTop = 14;
  const padBot = 18;
  const { points, isTime } = series;
  const ys = points.map((p) => p.n);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || 1;
  const flat = max === min; // a flat series would otherwise draw right on the x-axis
  const x = (i: number) => padX + (i * (W - 2 * padX)) / (points.length - 1);
  const y = (n: number) =>
    flat ? padTop + (H - padTop - padBot) / 2 : padTop + (1 - (n - min) / range) * (H - padTop - padBot);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.n).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 12 }}>
      <Line x1={padX} y1={H - padBot} x2={W - padX} y2={H - padBot} stroke={colors.border} strokeWidth={1} />
      <Path d={path} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <Circle
          key={i}
          cx={x(i)}
          cy={y(p.n)}
          r={i === points.length - 1 ? 3.5 : 2.5}
          fill={i === points.length - 1 ? colors.accent : colors.background}
          stroke={colors.accent}
          strokeWidth={1.5}
        />
      ))}
      {points.map((p, i) => (
        <SvgText key={i} x={x(i)} y={H - 5} textAnchor="middle" fontSize={8} fill={colors.muted}>
          W{p.week}
        </SvgText>
      ))}
      <SvgText x={x(points.length - 1)} y={Math.max(9, y(last.n) - 6)} textAnchor="end" fontSize={9} fontWeight="700" fill={colors.foreground}>
        {fmtValue(last.n, isTime)}
      </SvgText>
    </Svg>
  );
}

function MetricCard({ series }: { series: Series }) {
  const { points, isTime } = series;
  const last = points[points.length - 1].n;
  const prev = points[points.length - 2].n;
  const delta = last - prev;
  const improved = isTime ? delta < 0 : delta > 0;
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '–';
  const word = isTime
    ? delta < 0
      ? 'faster'
      : delta > 0
        ? 'slower'
        : 'no change'
    : delta > 0
      ? 'more'
      : delta < 0
        ? 'fewer'
        : 'no change';
  const color = delta === 0 ? colors.muted : improved ? colors.success : colors.danger;
  const best = isTime ? Math.min(...points.map((p) => p.n)) : Math.max(...points.map((p) => p.n));
  const miles = isTime ? metricMiles(series.metric) : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.metricLabel} numberOfLines={1}>
            {series.label}
          </Text>
          <Text style={styles.metricSub}>
            {isTime ? 'Best' : 'Peak'} {fmtValue(best, isTime)}
            {miles ? ` (${paceStr(best, miles)})` : ''} · {points.length} sessions
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.metricNow}>{fmtValue(last, isTime)}</Text>
          {miles ? <Text style={styles.metricPace}>{paceStr(last, miles)}</Text> : null}
          <Text style={[styles.metricDelta, { color }]}>
            {arrow} {delta === 0 ? word : `${fmtDelta(Math.abs(delta), isTime)} ${word}`}
          </Text>
        </View>
      </View>
      <LineChart series={series} />
    </View>
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
  // Merge the synced snapshot with this device's local log (local wins), computed
  // during render from the synchronous store — no effect needed.
  const logs = useMemo(() => {
    let local: Record<string, LoggedValue> = {};
    try {
      const key = profileId ? `thor3-logs-${profileId}-${programId}` : `thor3-logs-${programId}`;
      local = JSON.parse(getItem(key) || '{}');
    } catch {
      /* ignore */
    }
    return { ...serverLogs, ...local };
  }, [serverLogs, profileId, programId]);

  const series = useMemo(() => buildSeries(logs), [logs]);
  const paceCount = series.filter((s) => s.isTime).length;

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.h2}>Metrics</Text>
        <Text style={styles.h2sub}>
          {series.length > 0
            ? `Your times and reps over the weeks${paceCount ? ' · pace trends first' : ''}`
            : 'Trends across the weeks'}
        </Text>
      </View>

      {series.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No trends yet</Text>
          <Text style={styles.emptyBody}>
            Log the same workout (like a timed run) in a couple of different weeks and its pace trend shows up here, with how
            many seconds you gained or lost.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {series.map((s) => (
            <MetricCard key={s.metric} series={s} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 96 },
  h2: { color: colors.foreground, fontSize: 18, fontWeight: '800' },
  h2sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  metricLabel: { color: colors.foreground, fontSize: 14, fontWeight: '800' },
  metricSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  metricNow: { color: colors.foreground, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricPace: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  metricDelta: { fontSize: 12, fontWeight: '700' },
  empty: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  emptyBody: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6, maxWidth: 280, lineHeight: 17 },
});
