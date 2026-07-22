import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtDuration, pacePerMile, parseDay } from '@/lib/day-steps';
import { DAY_LABELS, getProgram, TYPE_META, type DayWorkout } from '@/lib/program-data';
import type { Profile } from '@/lib/profiles';
import type { LoggedValue } from '@/lib/sync';
import { colors } from '@/lib/theme';

// Read-only mirror of the day logger: shows one member's recorded workout without
// inputs, timers, or toggles. Everything comes from the shared snapshot.
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
  const insets = useSafeAreaInsets();
  const program = getProgram(programId) ?? getProgram('10week')!;
  const weeks = program.data;
  const doneDays = new Set(days);
  const doneSets = new Set(sets);

  const hasActivity = (week: number, day: DayWorkout) => {
    if (day.type === 'rest') return false;
    const prefix = `${week}-${day.day}`;
    if (doneDays.has(prefix)) return true;
    const meta = new Set([`note-${prefix}`, `rpe-${prefix}`, `session-dur-${prefix}`, `session-start-${prefix}`]);
    if (Object.keys(logs).some((k) => meta.has(k) || k.startsWith(`${prefix}-`))) return true;
    return sets.some((s) => s.startsWith(`${prefix}-`));
  };

  const [open, setOpen] = useState<string | null>(null);
  const totalLogged = weeks.reduce((sum, w) => sum + w.days.filter((d) => hasActivity(w.week, d)).length, 0);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Text style={styles.closeX}>✕</Text>
          </Pressable>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.display_name.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.hName} numberOfLines={1}>
              {profile.display_name}
              {isMe ? ' (You)' : ''}
            </Text>
            <Text style={styles.hSub}>
              {totalLogged} workout{totalLogged === 1 ? '' : 's'} logged · read-only
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
          {totalLogged === 0 ? (
            <Text style={styles.emptyText}>No workouts logged yet.</Text>
          ) : (
            weeks.map((w) => {
              const active = w.days.filter((d) => hasActivity(w.week, d));
              if (active.length === 0) return null;
              return (
                <View key={w.week} style={{ gap: 8 }}>
                  <Text style={styles.weekLabel}>Week {w.week}</Text>
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
                </View>
              );
            })
          )}
          <Text style={styles.footNote}>
            Viewing {isMe ? 'your' : `${profile.display_name.split(' ')[0]}'s`} recorded workouts. Nothing here can be edited.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

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
    <View
      style={[
        styles.dayCard,
        {
          borderColor: complete ? colors.success + '44' : expanded ? meta.color + '44' : colors.border,
          backgroundColor: complete ? colors.success + '08' : expanded ? meta.color + '08' : colors.card,
        },
      ]}>
      <Pressable onPress={onToggle} style={styles.dayHead}>
        <View style={[styles.dayIcon, { backgroundColor: meta.color + '20' }]}>
          <Text style={styles.dayIconText}>{complete ? '✓' : meta.icon}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.dayHeadRow}>
            <Text style={styles.dayLabel}>{DAY_LABELS[day.day - 1]}</Text>
            <View style={[styles.badge, { backgroundColor: meta.color + '22' }]}>
              <Text style={[styles.badgeText, { color: meta.color }]}>
                {meta.icon} {meta.label}
              </Text>
            </View>
            {durationSec != null ? <Text style={styles.dur}>{fmtDuration(durationSec)}</Text> : null}
          </View>
          <Text numberOfLines={1} style={styles.daySummary}>
            {day.sessions[0]?.description[0] ?? ''}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.dayBody}>
          {durationSec != null ? (
            <View style={styles.durRow}>
              <Text style={styles.durRowLabel}>WORKOUT TIME</Text>
              <Text style={styles.durRowVal}>{fmtDuration(durationSec)}</Text>
            </View>
          ) : null}
          {sessions.map((session, si) => (
            <View key={si} style={si > 0 ? styles.sessionDivider : undefined}>
              {session.label ? <Text style={[styles.sessionLabel, { color: meta.color }]}>{session.label}</Text> : null}
              {session.steps.map((step) => {
                if (step.kind === 'info') {
                  return (
                    <Text key={step.id} style={styles.infoLine}>
                      {step.label}
                    </Text>
                  );
                }
                if (step.kind === 'strength') {
                  return (
                    <Text key={step.id} style={styles.strengthLine}>
                      🏋️ Strength training
                    </Text>
                  );
                }
                const stepDone = doneSets.has(`${prefix}-${step.id}`);
                const val = logs[`${prefix}-${step.id}`]?.v;
                const pace = val ? pacePerMile(step, val) : null;
                return (
                  <View key={step.id} style={styles.stepRow}>
                    <View style={[styles.stepCheck, { backgroundColor: stepDone ? colors.success : 'transparent', borderWidth: stepDone ? 0 : 1 }]}>
                      <Text style={styles.stepCheckText}>{stepDone ? '✓' : ''}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.stepLabel}>{step.label}</Text>
                      {val ? (
                        <Text style={styles.stepVal}>
                          {val}
                          {step.input === 'reps' ? ' reps' : ''}
                          {pace ? <Text style={styles.stepPace}> · {pace}</Text> : null}
                        </Text>
                      ) : (
                        <Text style={styles.stepMuted}>not logged</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
          {rpe || note ? (
            <View style={styles.subjective}>
              {rpe ? (
                <Text style={styles.rpeLine}>
                  Effort: <Text style={styles.rpeVal}>{rpe}/10</Text>
                </Text>
              ) : null}
              {note ? <Text style={styles.noteLine}>{note}</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  closeBtn: { height: 36, width: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  closeX: { color: colors.muted, fontSize: 16 },
  avatar: { height: 36, width: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent + '22' },
  avatarText: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  hName: { color: colors.foreground, fontSize: 16, fontWeight: '800' },
  hSub: { color: colors.muted, fontSize: 12, marginTop: 1 },
  body: { padding: 16, gap: 20 },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center', paddingVertical: 48 },
  weekLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  footNote: { color: colors.muted, fontSize: 11, textAlign: 'center', paddingTop: 4 },

  dayCard: { borderRadius: 10, borderWidth: 1 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  dayIcon: { height: 36, width: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dayIconText: { fontSize: 18, color: colors.success },
  dayHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dayLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  dur: { marginLeft: 'auto', color: colors.muted, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  daySummary: { color: colors.foreground, fontSize: 14, marginTop: 2 },
  chevron: { color: colors.muted, fontSize: 14 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  dayBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 8 },
  durRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  durRowLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  durRowVal: { color: colors.success, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sessionDivider: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 },
  sessionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' },
  infoLine: { color: colors.muted, fontSize: 12, paddingHorizontal: 4, paddingVertical: 2 },
  strengthLine: { color: colors.accent, fontSize: 14, fontWeight: '700', paddingVertical: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  stepCheck: { marginTop: 1, height: 20, width: 20, borderRadius: 6, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepCheckText: { color: '#000', fontSize: 11, fontWeight: '800' },
  stepLabel: { color: colors.foreground, fontSize: 14 },
  stepVal: { color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 1 },
  stepPace: { color: colors.muted, fontWeight: '400' },
  stepMuted: { color: colors.muted, fontSize: 12, marginTop: 1 },
  subjective: { marginTop: 12, borderRadius: 10, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 8 },
  rpeLine: { color: colors.muted, fontSize: 12 },
  rpeVal: { color: colors.foreground, fontWeight: '700' },
  noteLine: { color: colors.foreground, fontSize: 14, marginTop: 4 },
});
