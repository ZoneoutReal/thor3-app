import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAY_LABELS, getProgram, TYPE_META, type DayWorkout } from '@/lib/program-data';

// Rukr dark palette (mirrors the PWA's CSS variables in globals.css).
const BG = '#111113';
const CARD = '#1c1c1f';
const BORDER = '#2a2a2e';
const TEXT = '#ededef';
const MUTED = '#9b9ba3';
const ACCENT = '#d97706';

// Phase 0 screen: a read-only weekly-plan browser driven entirely by the shared
// program-data module copied verbatim from the PWA. Proves the toolchain + the
// biggest reusable asset render natively. Logging/gate/sync land in Phase 1.
export default function WeeklyPlan() {
  const insets = useSafeAreaInsets();
  const program = getProgram('10week');
  const [weekIdx, setWeekIdx] = useState(0);

  if (!program) return null;
  const week = program.data[weekIdx];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.brand}>Rukr</Text>
        <Text style={styles.subtitle}>{program.name}</Text>
      </View>

      <View style={styles.weekBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekBar}>
          {program.data.map((w, i) => {
            const active = i === weekIdx;
            return (
              <Pressable
                key={w.week}
                onPress={() => setWeekIdx(i)}
                style={[styles.weekPill, active && styles.weekPillActive]}>
                <Text style={[styles.weekPillText, active && styles.weekPillTextActive]}>
                  W{w.week}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}>
        {week?.days.map((day) => <DayCard key={day.day} day={day} />)}
      </ScrollView>
    </View>
  );
}

function DayCard({ day }: { day: DayWorkout }) {
  const meta = TYPE_META[day.type];
  const dayLabel = DAY_LABELS[(day.day - 1) % 7] ?? `Day ${day.day}`;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.dayLabel}>{dayLabel}</Text>
        <View style={[styles.badge, { backgroundColor: meta.color + '22', borderColor: meta.color }]}>
          <Text style={[styles.badgeText, { color: meta.color }]}>
            {meta.icon} {meta.label}
          </Text>
        </View>
      </View>
      {day.sessions.map((session, si) => (
        <View key={si} style={styles.session}>
          {session.label ? <Text style={styles.sessionLabel}>{session.label}</Text> : null}
          {session.description.map((line, li) => (
            <Text key={li} style={styles.line}>
              {line}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  brand: { color: TEXT, fontSize: 28, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { color: MUTED, fontSize: 14, marginTop: 2 },
  weekBarWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  weekBar: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  weekPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  weekPillActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  weekPillText: { color: MUTED, fontSize: 14, fontWeight: '700' },
  weekPillTextActive: { color: '#1a1204' },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  dayLabel: { color: TEXT, fontSize: 16, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  session: { marginTop: 6 },
  sessionLabel: { color: ACCENT, fontSize: 12, fontWeight: '700', marginBottom: 2, textTransform: 'uppercase' },
  line: { color: MUTED, fontSize: 14, lineHeight: 20 },
});
