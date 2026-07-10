import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayLogger } from '@/components/day-logger';
import { Gate } from '@/components/gate';
import { Metrics } from '@/components/metrics';
import { StrengthSheet } from '@/components/strength-sheet';
import { Together } from '@/components/together';
import { useSyncedProgress } from '@/hooks/use-synced-progress';
import { fmtDuration } from '@/lib/day-steps';
import {
  DAY_LABELS,
  getProgram,
  TYPE_META,
  workoutLabel,
  type DayWorkout,
  type WorkoutType,
} from '@/lib/program-data';
import { getPasscode, getProfileId } from '@/lib/profiles';
import { currentPosition, getProgramPref, getStartDate } from '@/lib/program-prefs';
import { onSyncStatus, setActiveProgram, type SyncStatus } from '@/lib/sync';
import { colors } from '@/lib/theme';

type TabId = 'workout' | 'metrics' | 'together';

export default function Home() {
  const insets = useSafeAreaInsets();

  // Identity / gate. The store is hydrated before this screen mounts (see the
  // root layout), so identity + prefs resolve synchronously via lazy init.
  const [unlocked, setUnlocked] = useState<boolean>(() => !!(getPasscode() && getProfileId()));
  const [myProfileId, setMyProfileId] = useState<string | null>(() => getProfileId());
  const [showGate, setShowGate] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('workout');

  // Program selection + start-date anchor (per profile, stored locally).
  const [selectedProgram, setSelectedProgram] = useState<string>(() => getProgramPref(getProfileId()));
  const [startDate, setStartDateState] = useState<string | null>(() => getStartDate(getProfileId()));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [loggerDay, setLoggerDay] = useState<{ week: number; day: number } | null>(null);
  const [strengthWeek, setStrengthWeek] = useState<number | null>(null);

  const program = getProgram(selectedProgram) ?? getProgram('10week')!;

  // Week selector starts on "today" and jumps back to it whenever the anchor
  // (program / profile / start date) changes, while preserving manual navigation
  // in between — the render-time "reset state on dependency change" pattern.
  const [weekIdx, setWeekIdx] = useState<number>(() => currentPosition(program, startDate)?.weekIndex ?? 0);
  const anchorKey = `${selectedProgram}|${myProfileId ?? ''}|${startDate ?? ''}`;
  const [prevAnchor, setPrevAnchor] = useState(anchorKey);
  if (anchorKey !== prevAnchor) {
    setPrevAnchor(anchorKey);
    setWeekIdx(currentPosition(program, startDate)?.weekIndex ?? 0);
  }

  const week = program.data[Math.min(weekIdx, program.data.length - 1)];
  const position = currentPosition(program, startDate);
  const { isDone, toggle, count, done, snapshot, refresh, refreshing } = useSyncedProgress(
    selectedProgram,
    myProfileId,
    unlocked === true
  );

  const weekCompleted = week.days.filter((d) => isDone(week.week, d.day)).length;
  const totalDays = program.data.reduce((sum, w) => sum + w.days.length, 0);

  const myProfile = snapshot?.profiles.find((p) => p.id === myProfileId);
  const firstName = myProfile?.display_name.split(' ')[0] ?? '';

  const myRow = snapshot?.progress.find((p) => p.profile === myProfileId && p.program === selectedProgram);
  const serverLogs = myRow?.logs ?? {};
  const serverSets = myRow?.sets ?? [];

  // Keep the background push queue routed to the program on screen.
  useEffect(() => {
    setActiveProgram(selectedProgram);
  }, [selectedProgram]);

  useEffect(() => onSyncStatus(setSyncStatus), []);

  useEffect(() => {
    if ((activeTab === 'together' || activeTab === 'metrics') && unlocked) refresh();
  }, [activeTab, unlocked, refresh]);

  const handleUnlock = useCallback(() => {
    const pid = getProfileId();
    setMyProfileId(pid);
    setSelectedProgram(getProgramPref(pid));
    setStartDateState(getStartDate(pid));
    setUnlocked(true);
    setShowGate(false);
  }, []);

  if (!unlocked) return <Gate onUnlock={handleUnlock} />;

  const loggerWorkout = loggerDay
    ? program.data.find((x) => x.week === loggerDay.week)?.days.find((x) => x.day === loggerDay.day)
    : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>
            Ruk<Text style={{ color: colors.accent }}>r</Text>
          </Text>
          <Pressable onPress={() => snapshot && setShowGate(true)} style={styles.profileChip}>
            <View style={styles.chipAvatar}>
              <Text style={styles.chipAvatarText}>{firstName.slice(0, 1) || '?'}</Text>
            </View>
            <Text style={styles.chipName}>{firstName || 'Set profile'}</Text>
            <Text style={styles.chipCaret}>⌄</Text>
          </Pressable>
        </View>
        <View style={styles.headerRight}>
          {syncStatus !== 'idle' ? (
            <View
              style={[
                styles.syncDot,
                { backgroundColor: syncStatus === 'error' ? colors.danger : colors.accent },
              ]}
            />
          ) : null}
          <Pressable onPress={() => setStrengthWeek(week.week)} style={styles.iconBtn} hitSlop={6}>
            <Text style={styles.iconBtnText}>🏋️</Text>
          </Pressable>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.count}>
              {count}
              <Text style={styles.countTotal}>/{totalDays}</Text>
            </Text>
            <Text style={styles.countLabel}>workouts</Text>
          </View>
        </View>
      </View>

      {activeTab === 'workout' ? (
        <>
          {/* Week selector */}
          <View style={styles.weekBarWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekBar}>
              {program.data.map((w, i) => {
                const wDone = w.days.filter((d) => isDone(w.week, d.day)).length;
                const allDone = wDone === w.days.length;
                const active = weekIdx === i;
                return (
                  <Pressable
                    key={w.week}
                    onPress={() => setWeekIdx(i)}
                    style={[
                      styles.weekPill,
                      {
                        backgroundColor: active
                          ? colors.accent + '30'
                          : allDone
                            ? colors.success + '15'
                            : colors.card,
                        borderColor: active ? colors.accent + '50' : 'transparent',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.weekPillText,
                        { color: active ? colors.accent : allDone ? colors.success : colors.muted },
                      ]}>
                      W{w.week}
                    </Text>
                    {wDone > 0 ? (
                      <Text style={[styles.weekPillCount, { color: active ? colors.accent : allDone ? colors.success : colors.muted }]}>
                        {wDone}/{w.days.length}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Week content */}
          <ScrollView style={styles.list} contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}>
            <View style={styles.weekHeadRow}>
              <Text style={styles.weekTitle}>Week {week.week}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setWeekIdx(Math.max(0, weekIdx - 1))}
                  disabled={weekIdx === 0}
                  style={[styles.navBtn, weekIdx === 0 && styles.navDisabled]}>
                  <Text style={styles.navText}>←</Text>
                </Pressable>
                <Pressable
                  onPress={() => setWeekIdx(Math.min(program.data.length - 1, weekIdx + 1))}
                  disabled={weekIdx === program.data.length - 1}
                  style={[styles.navBtn, weekIdx === program.data.length - 1 && styles.navDisabled]}>
                  <Text style={styles.navText}>→</Text>
                </Pressable>
              </View>
            </View>

            <WeekProgress total={week.days.length} completed={weekCompleted} />

            <View style={{ marginTop: 16, gap: 8 }}>
              {week.days.map((day) => {
                const durV = serverLogs[`session-dur-${week.week}-${day.day}`]?.v;
                return (
                  <DayCard
                    key={day.day}
                    workout={day}
                    isDone={isDone(week.week, day.day)}
                    isToday={position?.todayId === `${week.week}-${day.day}`}
                    durationSec={durV ? parseInt(durV, 10) : undefined}
                    onToggle={() => toggle(week.week, day.day, workoutLabel(day))}
                    onOpenLogger={() => setLoggerDay({ week: week.week, day: day.day })}
                    onOpenStrength={() => setStrengthWeek(week.week)}
                  />
                );
              })}
            </View>
          </ScrollView>
        </>
      ) : activeTab === 'metrics' ? (
        <View style={{ flex: 1 }}>
          <Metrics serverLogs={serverLogs} profileId={myProfileId} programId={selectedProgram} />
        </View>
      ) : snapshot ? (
        <View style={{ flex: 1 }}>
          <Together
            snapshot={snapshot}
            myProfileId={myProfileId}
            myDays={[...done]}
            programId={selectedProgram}
            onRefresh={refresh}
            refreshing={refreshing}
          />
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Loading progress...</Text>
        </View>
      )}

      {/* Bottom tabs */}
      <TabBar active={activeTab} onChange={setActiveTab} bottomInset={insets.bottom} />

      {/* Switch profile */}
      <Modal visible={showGate && !!snapshot} animationType="slide" onRequestClose={() => setShowGate(false)}>
        {snapshot ? (
          <Gate
            initialStep="pick"
            knownProfiles={snapshot.profiles}
            onUnlock={handleUnlock}
            onClose={() => setShowGate(false)}
          />
        ) : null}
      </Modal>

      {/* Day logger */}
      {loggerDay && loggerWorkout ? (
        <DayLogger
          day={loggerWorkout}
          week={loggerDay.week}
          programId={selectedProgram}
          strengthDayIndex={0}
          typeLabel={TYPE_META[loggerWorkout.type].label}
          dayComplete={isDone(loggerDay.week, loggerDay.day)}
          serverLogs={serverLogs}
          serverSets={serverSets}
          onOpenStrength={() => {
            const wk = loggerDay.week;
            setLoggerDay(null);
            setStrengthWeek(wk);
          }}
          onFinish={() => {
            if (!isDone(loggerDay.week, loggerDay.day)) toggle(loggerDay.week, loggerDay.day, workoutLabel(loggerWorkout));
            setLoggerDay(null);
          }}
          onClose={() => setLoggerDay(null)}
        />
      ) : null}

      {/* Strength sheet */}
      {strengthWeek !== null ? (
        <StrengthSheet
          initialWeek={strengthWeek}
          programId={selectedProgram}
          serverLogs={serverLogs}
          serverSets={serverSets}
          onClose={() => setStrengthWeek(null)}
        />
      ) : null}
    </View>
  );
}

// --- Sub-components (mirrors the PWA's single-file layout) ---

function TypeBadge({ type }: { type: WorkoutType }) {
  const meta = TYPE_META[type];
  return (
    <View style={[styles.badge, { backgroundColor: meta.color + '22' }]}>
      <Text style={[styles.badgeText, { color: meta.color }]}>
        {meta.icon} {meta.label}
      </Text>
    </View>
  );
}

function WeekProgress({ total, completed }: { total: number; completed: number }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        {completed}/{total}
      </Text>
    </View>
  );
}

function DayCard({
  workout,
  isDone,
  isToday = false,
  durationSec,
  onToggle,
  onOpenLogger,
  onOpenStrength,
}: {
  workout: DayWorkout;
  isDone: boolean;
  isToday?: boolean;
  durationSec?: number;
  onToggle: () => void;
  onOpenLogger: () => void;
  onOpenStrength: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[workout.type];
  const isRest = workout.type === 'rest';

  const borderColor = isDone
    ? colors.success + '44'
    : isToday
      ? colors.accent
      : expanded
        ? meta.color + '44'
        : colors.border;
  const backgroundColor = isDone ? colors.success + '08' : expanded ? meta.color + '08' : colors.card;

  return (
    <View style={[styles.card, { borderColor, backgroundColor, borderWidth: isToday ? 2 : 1 }]}>
      <Pressable onPress={() => !isRest && setExpanded(!expanded)} style={styles.cardHead}>
        <View style={[styles.cardIcon, { backgroundColor: meta.color + '20' }]}>
          <Text style={styles.cardIconText}>{isDone ? '✓' : meta.icon}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.cardHeadRow}>
            <Text style={styles.dayLabel}>{DAY_LABELS[workout.day - 1]}</Text>
            <TypeBadge type={workout.type} />
            {isToday ? (
              <View style={styles.todayBadge}>
                <Text style={styles.todayText}>Today</Text>
              </View>
            ) : null}
            {durationSec != null ? <Text style={styles.duration}>{fmtDuration(durationSec)}</Text> : null}
          </View>
          {!isRest ? (
            <Text numberOfLines={1} style={styles.cardSummary}>
              {workout.sessions[0].description[0]}
            </Text>
          ) : null}
        </View>
        {!isRest ? <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text> : null}
      </Pressable>

      {expanded ? (
        <View style={styles.cardBody}>
          {workout.sessions.map((session, si) => (
            <View key={si} style={si > 0 ? styles.sessionDivider : undefined}>
              {session.label ? (
                <Text style={[styles.sessionLabel, { color: meta.color }]}>{session.label}</Text>
              ) : null}
              {session.description.map((line, li) => {
                if (line === '') return <View key={li} style={{ height: 8 }} />;
                if (/strength training/i.test(line)) {
                  return (
                    <Pressable key={li} onPress={onOpenStrength} style={styles.strengthLineBtn}>
                      <Text style={styles.strengthLineText}>💪 View Strength Workout →</Text>
                    </Pressable>
                  );
                }
                return (
                  <Text key={li} style={styles.bodyLine}>
                    {line}
                  </Text>
                );
              })}
            </View>
          ))}
          <Pressable onPress={onOpenLogger} style={styles.logBtn}>
            <Text style={styles.logBtnText}>{isDone ? 'Log / review workout  →' : 'Log workout  →'}</Text>
          </Pressable>
          <Pressable
            onPress={onToggle}
            style={[styles.markBtn, { backgroundColor: isDone ? colors.success + '20' : colors.cardHover }]}>
            <Text style={[styles.markText, { color: isDone ? colors.success : colors.muted }]}>
              {isDone ? 'Completed ✓ (tap to undo)' : 'Just mark complete'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function TabBar({
  active,
  onChange,
  bottomInset,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  bottomInset: number;
}) {
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'workout', label: 'Workout', icon: '🏋️' },
    { id: 'metrics', label: 'Metrics', icon: '📈' },
    { id: 'together', label: 'Together', icon: '👥' },
  ];
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(6, bottomInset) }]}>
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <Pressable key={t.id} onPress={() => onChange(t.id)} style={styles.tab}>
            <Text style={[styles.tabIcon, { opacity: on ? 1 : 0.55 }]}>{t.icon}</Text>
            <Text style={[styles.tabLabel, { color: on ? colors.accent : colors.muted }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  brand: { color: colors.foreground, fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  profileChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  chipAvatar: {
    height: 16,
    width: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '22',
  },
  chipAvatarText: { color: colors.accent, fontSize: 9, fontWeight: '700' },
  chipName: { color: colors.muted, fontSize: 12 },
  chipCaret: { color: colors.muted, fontSize: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  syncDot: { height: 8, width: 8, borderRadius: 4 },
  iconBtn: { height: 34, width: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  iconBtnText: { fontSize: 16 },
  count: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  countTotal: { color: colors.muted, fontSize: 12, fontWeight: '400' },
  countLabel: { color: colors.muted, fontSize: 11 },

  weekBarWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  weekBar: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  weekPill: {
    minWidth: 46,
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  weekPillText: { fontSize: 13, fontWeight: '700' },
  weekPillCount: { fontSize: 10, marginTop: 1 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 16 },
  weekHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  weekTitle: { color: colors.foreground, fontSize: 18, fontWeight: '800' },
  navBtn: { backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  navDisabled: { opacity: 0.3 },
  navText: { color: colors.muted, fontSize: 16 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: { height: 8, flex: 1, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.success },
  progressLabel: { color: colors.muted, fontSize: 12, fontWeight: '500' },

  card: { borderRadius: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  cardIcon: { height: 36, width: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardIconText: { fontSize: 18, color: colors.success },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dayLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  duration: { marginLeft: 'auto', color: colors.muted, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  cardSummary: { color: colors.foreground, fontSize: 14, marginTop: 2 },
  chevron: { color: colors.muted, fontSize: 14 },
  todayBadge: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  todayText: { color: '#000', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  cardBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 8 },
  sessionDivider: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 },
  sessionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' },
  bodyLine: { color: colors.foreground, fontSize: 14, lineHeight: 21 },
  strengthLineBtn: { marginTop: 4, alignSelf: 'flex-start', backgroundColor: colors.accent + '20', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  strengthLineText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  logBtn: { marginTop: 12, borderRadius: 10, backgroundColor: colors.accent, paddingVertical: 11, alignItems: 'center' },
  logBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },
  markBtn: { marginTop: 8, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  markText: { fontSize: 12, fontWeight: '600' },

  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  placeholderText: { color: colors.muted, fontSize: 14 },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 18 },
  tabLabel: { fontSize: 11, fontWeight: '700' },
});
