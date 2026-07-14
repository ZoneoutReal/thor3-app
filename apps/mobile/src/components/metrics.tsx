import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { fmtClock, fmtDuration, timeToSeconds } from '@/lib/day-steps';
import { getItem } from '@/lib/store';
import type { LoggedValue } from '@/lib/sync';
import { colors } from '@/lib/theme';

type Point = { week: number; n: number; raw: string };
type Series = { metric: string; label: string; isTime: boolean; points: Point[] };

// One parsed sample of a metric, kept with the week it was logged in.
type Sample = { week: number; n: number; raw: string };
type MetricGroup = { metric: string; isTime: boolean; miles: number | null; samples: Sample[] };

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
// "2 mi run" -> "2 mi"; leaves non-run labels untouched.
function distLabel(metric: string): string {
  return humanize(metric).replace(/ run$/, '');
}
function fmtMiles(mi: number): string {
  return Number.isInteger(mi) ? String(mi) : mi.toFixed(1);
}

// Single pass over the logs: parse every loggable metric into grouped samples.
// Unlike the trend view this keeps EVERY sample (no 2-week minimum), so records
// show up after a single workout.
function collectMetrics(logs: Record<string, LoggedValue>): Map<string, MetricGroup> {
  const groups = new Map<string, MetricGroup>();
  for (const val of Object.values(logs)) {
    if (!val || !val.m) continue;
    if (HIDDEN.has(val.m)) continue;
    if (/-\d+$/.test(val.m)) continue; // interval sub-reps ("800-meters-1") — noise here
    const miles = metricMiles(val.m);
    const parsed =
      miles != null
        ? (() => {
            const s = timeToSeconds(val.v);
            return s == null ? null : { n: s, isTime: true };
          })()
        : toNumber(val.v);
    if (!parsed) continue;
    const g = groups.get(val.m) ?? { metric: val.m, isTime: parsed.isTime, miles, samples: [] };
    g.samples.push({ week: typeof val.w === 'number' ? val.w : 0, n: parsed.n, raw: val.v.trim() });
    groups.set(val.m, g);
  }
  return groups;
}

// Week-over-week trend series: one point per week, only metrics with 2+ weeks.
function trendSeries(groups: Map<string, MetricGroup>): Series[] {
  const series: Series[] = [];
  for (const g of groups.values()) {
    const perWeek = new Map<number, Point>();
    for (const s of g.samples) perWeek.set(s.week, { week: s.week, n: s.n, raw: s.raw });
    const points = [...perWeek.values()].sort((a, b) => a.week - b.week);
    if (points.length < 2) continue;
    series.push({ metric: g.metric, label: humanize(g.metric), isTime: g.isTime, points });
  }
  return series.sort((a, b) => Number(b.isTime) - Number(a.isTime) || b.points.length - a.points.length);
}

// --- Records (personal bests) ----------------------------------------------

type Rec = { key: string; label: string; value: string; sub?: string; accent?: boolean };

function bestSample(g: MetricGroup): Sample {
  // Runs & other times: fastest (min). Reps: most (max).
  return g.samples.reduce((a, b) => {
    if (g.isTime) return b.n < a.n ? b : a;
    return b.n > a.n ? b : a;
  });
}

function buildRecords(groups: Map<string, MetricGroup>): Rec[] {
  const runs = [...groups.values()].filter((g) => g.miles != null && g.miles > 0);
  const reps = [...groups.values()].filter((g) => g.miles == null && !g.isTime);
  const otherTimes = [...groups.values()].filter((g) => g.miles == null && g.isTime);
  const recs: Rec[] = [];

  // Best pace — fastest single-mile pace across every run logged.
  let bestPace: { pace: number; metric: string } | null = null;
  for (const g of runs) {
    for (const s of g.samples) {
      const pace = s.n / g.miles!;
      if (!bestPace || pace < bestPace.pace) bestPace = { pace, metric: g.metric };
    }
  }
  if (bestPace) {
    recs.push({
      key: 'best-pace',
      label: 'Best pace',
      value: `${fmtClock(Math.round(bestPace.pace))} /mi`,
      sub: distLabel(bestPace.metric),
      accent: true,
    });
  }

  // Longest run — greatest distance actually logged (with its best time).
  const longest = runs.reduce<MetricGroup | null>((a, g) => (!a || g.miles! > a.miles! ? g : a), null);
  if (longest) {
    recs.push({
      key: 'longest-run',
      label: 'Longest run',
      value: `${fmtMiles(longest.miles!)} mi`,
      sub: `best ${fmtClock(bestSample(longest).n)}`,
    });
  }

  // Fastest time per run distance — "Fastest 2 mi", "Fastest 5 mi", ...
  for (const g of [...runs].sort((a, b) => a.miles! - b.miles!)) {
    const best = bestSample(g);
    recs.push({
      key: `dist-${g.metric}`,
      label: `Fastest ${distLabel(g.metric)}`,
      value: fmtClock(best.n),
      sub: paceStr(best.n, g.miles!),
    });
  }

  // Rep records — push-ups, sit-ups, any AMRAP. "Max push-ups".
  for (const g of reps.sort((a, b) => a.metric.localeCompare(b.metric))) {
    const best = bestSample(g);
    recs.push({
      key: `rep-${g.metric}`,
      label: `Max ${humanize(g.metric).toLowerCase()}`,
      value: Number.isInteger(best.n) ? String(best.n) : best.n.toFixed(1),
      sub: best.week > 0 ? `week ${best.week}` : 'reps',
    });
  }

  // Any other timed metric (e.g. a plank hold): best = fastest, following the
  // trend view's convention. Rare, but never silently dropped.
  for (const g of otherTimes.sort((a, b) => a.metric.localeCompare(b.metric))) {
    const best = bestSample(g);
    recs.push({
      key: `time-${g.metric}`,
      label: `Best ${humanize(g.metric).toLowerCase()}`,
      value: best.n >= 3600 ? fmtDuration(best.n) : fmtClock(best.n),
      sub: best.week > 0 ? `week ${best.week}` : undefined,
    });
  }

  return recs;
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

function StatTile({ rec }: { rec: Rec }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {rec.label}
      </Text>
      <Text style={[styles.tileValue, rec.accent ? { color: colors.accent } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {rec.value}
      </Text>
      {rec.sub ? (
        <Text style={styles.tileSub} numberOfLines={1}>
          {rec.sub}
        </Text>
      ) : null}
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

  const groups = useMemo(() => collectMetrics(logs), [logs]);
  const records = useMemo(() => buildRecords(groups), [groups]);
  const series = useMemo(() => trendSeries(groups), [groups]);

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.h2}>Metrics</Text>
        <Text style={styles.h2sub}>
          {records.length > 0 ? 'Your records and weekly trends' : 'Trends across the weeks'}
        </Text>
      </View>

      {records.length === 0 && series.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No metrics yet</Text>
          <Text style={styles.emptyBody}>
            Log a workout — a run, the fit test, anything with a time or reps — and your personal records show up here.
            Week-over-week trends follow once you repeat a workout.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 24 }}>
          {records.length > 0 ? (
            <View>
              <Text style={styles.sectionH}>Records</Text>
              <Text style={styles.sectionSub}>Personal bests so far</Text>
              <View style={styles.grid}>
                {records.map((r) => (
                  <StatTile key={r.key} rec={r} />
                ))}
              </View>
            </View>
          ) : null}

          <View>
            <Text style={styles.sectionH}>Trends</Text>
            <Text style={styles.sectionSub}>Same workout, week over week</Text>
            {series.length > 0 ? (
              <View style={{ gap: 12, marginTop: 10 }}>
                {series.map((s) => (
                  <MetricCard key={s.metric} series={s} />
                ))}
              </View>
            ) : (
              <View style={[styles.hint, { marginTop: 10 }]}>
                <Text style={styles.hintText}>
                  Repeat a timed workout (like a run) in another week and its trend — how many seconds you gained or lost —
                  appears here.
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 96 },
  h2: { color: colors.foreground, fontSize: 18, fontWeight: '800' },
  h2sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sectionH: { color: colors.foreground, fontSize: 15, fontWeight: '800' },
  sectionSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
  },
  tileLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  tileValue: { color: colors.foreground, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 6 },
  tileSub: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  metricLabel: { color: colors.foreground, fontSize: 14, fontWeight: '800' },
  metricSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  metricNow: { color: colors.foreground, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricPace: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  metricDelta: { fontSize: 12, fontWeight: '700' },
  hint: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 16 },
  hintText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  empty: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  emptyBody: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6, maxWidth: 280, lineHeight: 17 },
});
