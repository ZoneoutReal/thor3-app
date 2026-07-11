import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PersonDetail } from '@/components/person-detail';
import { getProgram } from '@/lib/program-data';
import type { Snapshot } from '@/lib/sync';
import { colors } from '@/lib/theme';
import { readLogs, readSets } from '@/lib/workout-log';

function timeAgo(iso: string | undefined, now: number): string {
  if (!iso) return 'no activity yet';
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((now - then) / 60000));
  if (mins < 1) return 'just now';
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
  const program = getProgram(programId) ?? getProgram('10week')!;
  const weeks = program.data;
  // Rest days can't be completed, so they must not inflate the denominator or
  // "100% / weeks done" and the green heat cells become unreachable.
  const total = weeks.reduce((s, w) => s + w.days.filter((d) => d.type !== 'rest').length, 0);
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now(); // "active X ago" is cosmetic; recomputed each render

  const [detailId, setDetailId] = useState<string | null>(null);

  const progById = Object.fromEntries(snapshot.progress.filter((p) => p.program === programId).map((p) => [p.profile, p]));
  const detailProfile = detailId ? snapshot.profiles.find((p) => p.id === detailId) : null;
  const detailRow = detailId ? progById[detailId] : undefined;

  const cards = snapshot.profiles.map((pr) => {
    const row = progById[pr.id];
    const days = new Set(pr.id === myProfileId ? myDays : (row?.days ?? []));
    const perWeek = weeks.map((w) => ({
      week: w.week,
      total: w.days.filter((d) => d.type !== 'rest').length,
      done: w.days.filter((d) => days.has(`${w.week}-${d.day}`)).length,
    }));
    const doneCount = perWeek.reduce((s, w) => s + w.done, 0);
    const weeksComplete = perWeek.filter((w) => w.total > 0 && w.done === w.total).length;
    return { pr, doneCount, perWeek, weeksComplete, updated: row?.updated_at };
  });

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.h2}>Together</Text>
          <Text style={styles.h2sub}>Everyone&apos;s progress, side by side</Text>
        </View>
        <Pressable onPress={onRefresh} disabled={refreshing} style={[styles.refreshBtn, refreshing && { opacity: 0.5 }]}>
          <Text style={styles.refreshText}>↻</Text>
        </Pressable>
      </View>

      <View style={{ gap: 12 }}>
        {cards.map(({ pr, doneCount, perWeek, weeksComplete, updated }) => {
          const pct = total > 0 ? (doneCount / total) * 100 : 0;
          const isMe = pr.id === myProfileId;
          return (
            <Pressable
              key={pr.id}
              onPress={() => setDetailId(pr.id)}
              style={[styles.card, { borderColor: isMe ? colors.accent + '50' : colors.border, backgroundColor: isMe ? colors.accent + '08' : colors.card }]}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{pr.display_name.slice(0, 1)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {pr.display_name}
                    </Text>
                    {isMe ? (
                      <View style={styles.youBadge}>
                        <Text style={styles.youText}>You</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.active}>Active {timeAgo(updated, now)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.count}>
                    {doneCount}
                    <Text style={styles.countTotal}>/{total}</Text>
                  </Text>
                  <Text style={styles.countLabel}>WORKOUTS</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
              <View style={styles.pctRow}>
                <Text style={styles.pctText}>{Math.round(pct)}% complete</Text>
                <Text style={styles.pctText}>
                  {weeksComplete}/{weeks.length} weeks done
                </Text>
              </View>

              <View style={styles.heatRow}>
                {perWeek.map((w) => {
                  const r = w.total > 0 ? w.done / w.total : 0;
                  const bg = r === 0 ? colors.border : r >= 1 ? colors.success : `rgba(34,197,94,${0.25 + r * 0.5})`;
                  return (
                    <View key={w.week} style={styles.heatCol}>
                      <View style={[styles.heatCell, { backgroundColor: bg }]} />
                      <Text style={styles.heatNum}>{w.week}</Text>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.viewDetails}>View workout details →</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.footNote}>
        Week grid, left to right = weeks 1-{weeks.length}. Green means done. Tap a card to see the details.
      </Text>

      {detailProfile ? (
        <PersonDetail
          profile={detailProfile}
          days={detailProfile.id === myProfileId ? myDays : (detailRow?.days ?? [])}
          sets={detailProfile.id === myProfileId ? readSets(programId) : (detailRow?.sets ?? [])}
          logs={detailProfile.id === myProfileId ? readLogs(programId) : (detailRow?.logs ?? {})}
          programId={programId}
          isMe={detailProfile.id === myProfileId}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 96 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  h2: { color: colors.foreground, fontSize: 18, fontWeight: '800' },
  h2sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  refreshBtn: { height: 36, width: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  refreshText: { color: colors.muted, fontSize: 18 },

  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { height: 40, width: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent + '22' },
  avatarText: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  youBadge: { backgroundColor: colors.accent + '22', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  youText: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  active: { color: colors.muted, fontSize: 12 },
  count: { color: colors.accent, fontSize: 20, fontWeight: '800' },
  countTotal: { color: colors.muted, fontSize: 12, fontWeight: '400' },
  countLabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5 },

  progressTrack: { marginTop: 12, height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.success },
  pctRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  pctText: { color: colors.muted, fontSize: 11 },

  heatRow: { flexDirection: 'row', gap: 3, marginTop: 12 },
  heatCol: { flex: 1, alignItems: 'center' },
  heatCell: { height: 24, alignSelf: 'stretch', borderRadius: 4 },
  heatNum: { color: colors.muted, fontSize: 9, marginTop: 2 },

  viewDetails: { color: colors.accent, fontSize: 11, fontWeight: '700', textAlign: 'right', marginTop: 12 },
  footNote: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 16 },
});
