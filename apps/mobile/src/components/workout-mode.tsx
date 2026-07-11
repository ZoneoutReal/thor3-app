import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SupersetRunner } from '@/components/superset-runner';
import { beep, unlockAudio, vibrate } from '@/lib/feedback';
import {
  parseStrengthSets,
  prescriptionForWeek,
  type ParsedSet,
  type StrengthBlock,
  type StrengthDay,
  type StrengthRow,
} from '@/lib/program-data';
import { getProfileId } from '@/lib/profiles';
import { getRestPref } from '@/lib/program-prefs';
import type { LoggedValue } from '@/lib/sync';
import { colors } from '@/lib/theme';
import { mergeServerLogs, mergeServerSets, writeLog, writeSetDone } from '@/lib/workout-log';

// The prescribed rep count to pre-fill a set's box, or "" when there's no number
// to seed (e.g. "MAX"). Strips the "+" (a floor, not a cap) and per-side "ea".
function defaultReps(label: string): string {
  const t = label.trim().replace(/\bea\b/gi, '').replace(/\+/g, '').trim();
  return /^\d+$/.test(t) ? t : '';
}
function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;
}
function restSeconds(rest?: string): number | undefined {
  if (!rest) return undefined;
  const m = rest.match(/(\d+):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : undefined;
}

// Group consecutive rows that share a letter into supersets (2+ rows), so the
// list can wrap them in an obvious "SUPERSET" container. Singles stand alone.
function groupConsecutive(rows: StrengthRow[]): StrengthRow[][] {
  const out: StrengthRow[][] = [];
  for (const row of rows) {
    const last = out[out.length - 1];
    if (last && row.group && last[0].group === row.group) last.push(row);
    else out.push([row]);
  }
  return out;
}

// --- Per-set completion + logged reps/weights, persisted & synced per program ---

function useSetProgress(programId: string, serverSets?: string[], serverLogs?: Record<string, LoggedValue>) {
  const [done, setDone] = useState<Set<string>>(() => new Set(mergeServerSets(programId, serverSets ?? [])));
  const [logs, setLogs] = useState<Record<string, LoggedValue>>(() => mergeServerLogs(programId, serverLogs ?? {}));
  const [seen, setSeen] = useState(programId);
  if (programId !== seen) {
    setSeen(programId);
    setDone(new Set(mergeServerSets(programId, serverSets ?? [])));
    setLogs(mergeServerLogs(programId, serverLogs ?? {}));
  }

  const set = useCallback((id: string, val: boolean) => setDone(new Set(writeSetDone(programId, id, val))), [programId]);
  const toggle = useCallback(
    (id: string) => setDone((prev) => new Set(writeSetDone(programId, id, !prev.has(id)))),
    [programId]
  );
  const setLog = useCallback(
    (key: string, value: string, week?: number) => setLogs(writeLog(programId, key, value, { week })),
    [programId]
  );
  const isDone = useCallback((id: string) => done.has(id), [done]);
  const getVal = useCallback((key: string) => logs[key]?.v ?? '', [logs]);
  return { isDone, toggle, set, setLog, getVal };
}

// --- Timed set: Go / Pause / Reset countdown that checks itself off at zero ---

function IntervalTimer({
  seconds,
  isDone,
  onComplete,
  onReopen,
}: {
  seconds: number;
  isDone: boolean;
  onComplete: () => void;
  onReopen: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearTimeout(id);
  }, [running, remaining]);

  useEffect(() => {
    if (running && remaining === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRunning(false);
      beep();
      vibrate(200);
      onCompleteRef.current();
    }
  }, [running, remaining]);

  if (isDone) {
    return (
      <View style={styles.rowCenter}>
        <Text style={[styles.timedDone]}>✓ {mmss(seconds)}</Text>
        <Pressable
          onPress={() => {
            setRemaining(seconds);
            onReopen();
          }}
          style={styles.redoBtn}>
          <Text style={styles.redoText}>Redo</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.rowCenter}>
      <Text style={[styles.timedClock, { color: running ? colors.accent : colors.foreground }]}>{mmss(remaining)}</Text>
      <Pressable
        onPress={() => {
          unlockAudio();
          setRunning((r) => !r);
        }}
        style={styles.goBtn}>
        <Text style={styles.goText}>{running ? 'Pause' : remaining === seconds ? 'Go' : 'Resume'}</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setRunning(false);
          setRemaining(seconds);
        }}
        style={styles.smallBtn}>
        <Text style={styles.smallBtnText}>Reset</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setRunning(false);
          onComplete();
        }}
        style={styles.checkCircle}>
        <Text style={styles.checkCircleText}>✓</Text>
      </Pressable>
    </View>
  );
}

// --- Rep set: editable reps + weight, then a done check ---

function RepSetRow({
  index,
  target,
  reps,
  repsGhost,
  weight,
  weightGhost,
  isDone,
  onReps,
  onWeight,
  onToggle,
}: {
  index: number;
  target: string;
  reps: string;
  repsGhost: boolean;
  weight: string;
  weightGhost: boolean;
  isDone: boolean;
  onReps: (v: string) => void;
  onWeight: (v: string) => void;
  onToggle: () => void;
}) {
  const perSide = /\bea\b/i.test(target);
  return (
    <View style={[styles.setRow, { backgroundColor: isDone ? colors.success + '12' : colors.card }]}>
      <Text style={styles.setNum}>Set {index}</Text>
      <TextInput
        value={reps}
        onChangeText={onReps}
        keyboardType="number-pad"
        placeholder={defaultReps(target) || target}
        placeholderTextColor={colors.muted}
        style={[styles.repInput, { color: repsGhost ? colors.muted : colors.foreground }]}
      />
      <Text style={styles.unit}>{perSide ? 'ea' : 'reps'}</Text>
      <Text style={styles.times}>×</Text>
      <TextInput
        value={weight}
        onChangeText={onWeight}
        keyboardType="decimal-pad"
        placeholder="–"
        placeholderTextColor={colors.muted}
        style={[styles.wtInput, { color: weightGhost ? colors.muted : colors.foreground }]}
      />
      <Text style={styles.unit}>lb</Text>
      <Pressable
        onPress={onToggle}
        style={[styles.checkCircle, { borderColor: isDone ? colors.success : colors.border, backgroundColor: isDone ? colors.success : 'transparent' }]}>
        <Text style={[styles.checkCircleText, { color: isDone ? '#000' : colors.muted }]}>✓</Text>
      </Pressable>
    </View>
  );
}

// --- One exercise: header + its set rows ---

function ExerciseCard({
  row,
  sets,
  week,
  restPrefSec,
  idFor,
  isDone,
  toggle,
  setSet,
  getVal,
  setLog,
  onStartRest,
}: {
  row: StrengthRow;
  sets: ParsedSet[];
  week: number;
  restPrefSec: number;
  idFor: (setIndex: number) => string;
  isDone: (id: string) => boolean;
  toggle: (id: string) => void;
  setSet: (id: string, val: boolean) => void;
  getVal: (key: string) => string;
  setLog: (key: string, value: string, week?: number) => void;
  onStartRest: (seconds?: number, exercise?: string) => void;
}) {
  const doneCount = sets.filter((_, i) => isDone(idFor(i))).length;
  const rest = restPrefSec > 0 ? restPrefSec : restSeconds(row.rest);

  return (
    <View style={styles.exCard}>
      <View style={styles.exHead}>
        {row.group ? <Text style={styles.exGroup}>{row.group}</Text> : null}
        <Text style={styles.exName}>{row.name}</Text>
        <Text style={[styles.exCount, { color: doneCount === sets.length ? colors.success : colors.muted }]}>
          {doneCount}/{sets.length}
        </Text>
      </View>
      <View style={{ gap: 6 }}>
        {sets.map((s, i) => {
          const id = idFor(i);
          if (s.seconds != null) {
            return (
              <View key={i} style={[styles.timedRow, { backgroundColor: isDone(id) ? colors.success + '12' : colors.card }]}>
                <Text style={styles.setNum}>Set {i + 1}</Text>
                <IntervalTimer
                  seconds={s.seconds}
                  isDone={isDone(id)}
                  onComplete={() => {
                    setSet(id, true);
                    onStartRest(rest, row.name);
                  }}
                  onReopen={() => setSet(id, false)}
                />
              </View>
            );
          }
          const wtKey = `${id}|w`;
          const def = defaultReps(s.label);
          const loggedReps = getVal(id);
          const loggedWt = getVal(wtKey);
          let carryWt = '';
          for (let j = i - 1; j >= 0; j--) {
            const w = getVal(`${idFor(j)}|w`);
            if (w) {
              carryWt = w;
              break;
            }
          }
          return (
            <RepSetRow
              key={i}
              index={i + 1}
              target={s.label}
              reps={loggedReps || def}
              repsGhost={!loggedReps && !!def}
              weight={loggedWt || carryWt}
              weightGhost={!loggedWt && !!carryWt}
              isDone={isDone(id)}
              onReps={(v) => setLog(id, v, week)}
              onWeight={(v) => setLog(wtKey, v, week)}
              onToggle={() => {
                const willComplete = !isDone(id);
                if (willComplete && !loggedReps && def) setLog(id, def, week);
                if (willComplete && !loggedWt && carryWt) setLog(wtKey, carryWt, week);
                toggle(id);
                if (willComplete) onStartRest(rest);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

// --- Ladder day rendered as a checkable list of steps ---

function LadderList({
  day,
  weekIndex,
  idFor,
  isDone,
  toggle,
}: {
  day: StrengthDay;
  weekIndex: number;
  idFor: (stepIndex: number) => string;
  isDone: (id: string) => boolean;
  toggle: (id: string) => void;
}) {
  const steps = day.ladder ?? [];
  return (
    <View style={{ gap: 6 }}>
      {steps.map((step, si) => {
        const id = idFor(si);
        const done = isDone(id);
        return (
          <Pressable key={si} onPress={() => toggle(id)} style={[styles.ladderRow, { backgroundColor: done ? colors.success + '12' : colors.card }]}>
            <Text style={styles.setNum}>Set {si + 1}</Text>
            <Text style={[styles.ladderVal, { color: done ? colors.muted : colors.foreground }]}>{step[weekIndex]}</Text>
            <View style={[styles.checkCircle, { borderColor: done ? colors.success : colors.border, backgroundColor: done ? colors.success : 'transparent' }]}>
              <Text style={[styles.checkCircleText, { color: done ? '#000' : 'transparent' }]}>✓</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Workout mode: the current week's session, Fitbod-style ---

export function WorkoutMode({
  block,
  programId,
  initialWeek,
  lockWeek,
  singleDayIndex,
  serverLogs,
  serverSets,
  onActivity,
}: {
  block: StrengthBlock;
  programId: string;
  initialWeek?: number;
  lockWeek?: number;
  singleDayIndex?: number;
  serverLogs?: Record<string, LoggedValue>;
  serverSets?: string[];
  // Reports the live workout phase up to the day logger so it can drive the iOS
  // Live Activity (work timer <-> rest countdown, current exercise). Absolute ms.
  onActivity?: (s: { phase: 'active' | 'rest'; exercise: string; phaseStartedAt: number; restEndsAt: number }) => void;
}) {
  const wantWeek =
    lockWeek != null && block.weeks.includes(lockWeek)
      ? lockWeek
      : initialWeek != null && block.weeks.includes(initialWeek)
        ? initialWeek
        : block.weeks[0];
  const [targetWeek, setTargetWeek] = useState(wantWeek);
  // Keep the target week valid (and pinned to lockWeek) when the block changes.
  if (targetWeek !== wantWeek && (lockWeek != null || !block.weeks.includes(targetWeek))) {
    setTargetWeek(wantWeek);
  }

  const clampDay = (i: number) => Math.min(Math.max(0, i), block.days.length - 1);
  const [selectedDay, setSelectedDay] = useState(singleDayIndex != null ? clampDay(singleDayIndex) : 0);

  const daysToShow = singleDayIndex != null ? block.days.filter((_, i) => i === selectedDay) : block.days;
  const weekIndex = Math.max(0, block.weeks.indexOf(targetWeek));
  const { isDone, toggle, set: setSet, setLog, getVal } = useSetProgress(programId, serverSets, serverLogs);

  const [restPrefSec] = useState(() => getRestPref(getProfileId()));
  const [runnerDay, setRunnerDay] = useState<StrengthDay | null>(null);
  const [rest, setRest] = useState<{ total: number; remaining: number; exercise: string; endsAt: number } | null>(null);
  // Keep the latest onActivity in a ref so the timer effects/callbacks below can
  // report phase changes without taking it as a dependency (which would restart
  // the 1s rest tick every render).
  const onActivityRef = useRef(onActivity);
  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);

  useEffect(() => {
    if (!rest || rest.remaining <= 0) return;
    const id = setTimeout(() => setRest((r) => (r ? { ...r, remaining: r.remaining - 1 } : r)), 1000);
    return () => clearTimeout(id);
  }, [rest]);

  useEffect(() => {
    if (rest && rest.remaining === 0) {
      beep();
      vibrate(300);
      // Rest done -> back to the active/working phase; the running timer restarts now.
      onActivityRef.current?.({ phase: 'active', exercise: rest.exercise, phaseStartedAt: Date.now(), restEndsAt: 0 });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRest(null);
    }
  }, [rest]);

  const startRest = useCallback((seconds?: number, exercise?: string) => {
    if (seconds && seconds > 0) {
      unlockAudio();
      const endsAt = Date.now() + seconds * 1000;
      setRest({ total: seconds, remaining: seconds, exercise: exercise ?? '', endsAt });
      onActivityRef.current?.({ phase: 'rest', exercise: exercise ?? '', phaseStartedAt: 0, restEndsAt: endsAt });
    }
  }, []);

  const setIdsForDay = (day: StrengthDay): string[] => {
    const ids: string[] = [];
    if (day.kind === 'ladder') {
      (day.ladder ?? []).forEach((_, si) => ids.push(`${targetWeek}|${day.label}|step|${si}`));
      return ids;
    }
    (day.rows ?? []).forEach((row) => {
      const rounds = day.kind === 'circuit' && !row.group ? day.roundsByWeek?.[weekIndex] : undefined;
      const sets = parseStrengthSets(prescriptionForWeek(row, weekIndex), rounds);
      sets.forEach((_, si) => ids.push(`${targetWeek}|${day.label}|${row.name}|${si}`));
    });
    return ids;
  };

  return (
    <View>
      {/* Logging-week picker */}
      {block.weeks.length > 1 && lockWeek == null ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.pickerLabel}>Logging week</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {block.weeks.map((w) => (
              <Pressable
                key={w}
                onPress={() => setTargetWeek(w)}
                style={[styles.pill, w === targetWeek ? styles.pillActive : styles.pillIdle]}>
                <Text style={[styles.pillText, { color: w === targetWeek ? colors.accent : colors.muted }]}>Week {w}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Strength-day toggle (single-day / inline mode) */}
      {singleDayIndex != null && block.days.length > 1 ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.pickerLabel}>Strength day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {block.days.map((d, i) => (
              <Pressable
                key={d.label}
                onPress={() => setSelectedDay(i)}
                style={[styles.pill, i === selectedDay ? styles.pillActive : styles.pillIdle]}>
                <Text style={[styles.pillText, { color: i === selectedDay ? colors.accent : colors.muted }]}>{d.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ gap: 20 }}>
        {daysToShow.map((day) => {
          const ids = setIdsForDay(day);
          const doneCount = ids.filter(isDone).length;
          return (
            <View key={day.label}>
              <View style={styles.dayHead}>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>{day.label}</Text>
                </View>
                {day.title ? <Text style={styles.dayTitle}>{day.title}</Text> : null}
                <Text style={[styles.dayCount, { color: doneCount === ids.length && ids.length > 0 ? colors.success : colors.muted }]}>
                  {doneCount}/{ids.length}
                </Text>
              </View>

              {day.kind === 'table' && day.rows && day.rows.length ? (
                <Pressable
                  onPress={() => setRunnerDay(day)}
                  style={{ backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ color: '#000', fontWeight: '800', fontSize: 15 }}>▶  Start guided workout</Text>
                </Pressable>
              ) : null}

              {day.rounds || day.note ? (
                <View style={styles.metaRow}>
                  {day.rounds ? (
                    <View style={styles.roundsBadge}>
                      <Text style={styles.roundsText}>{day.rounds}</Text>
                    </View>
                  ) : null}
                  {day.note ? <Text style={styles.noteText}>{day.note}</Text> : null}
                </View>
              ) : null}

              {day.kind === 'ladder' ? (
                <LadderList
                  day={day}
                  weekIndex={weekIndex}
                  idFor={(si) => `${targetWeek}|${day.label}|step|${si}`}
                  isDone={isDone}
                  toggle={toggle}
                />
              ) : (
                <View style={{ gap: 12 }}>
                  {groupConsecutive(day.rows ?? []).map((group, gi) => {
                    const cards = group.map((row, j) => {
                      const rounds = day.kind === 'circuit' && !row.group ? day.roundsByWeek?.[weekIndex] : undefined;
                      const sets = parseStrengthSets(prescriptionForWeek(row, weekIndex), rounds);
                      return (
                        <ExerciseCard
                          key={`${row.name}-${gi}-${j}`}
                          row={row}
                          sets={sets}
                          week={targetWeek}
                          restPrefSec={restPrefSec}
                          idFor={(si) => `${targetWeek}|${day.label}|${row.name}|${si}`}
                          isDone={isDone}
                          toggle={toggle}
                          setSet={setSet}
                          getVal={getVal}
                          setLog={setLog}
                          onStartRest={startRest}
                        />
                      );
                    });
                    if (group.length < 2) {
                      return (
                        <View key={gi} style={{ gap: 8 }}>
                          {cards}
                        </View>
                      );
                    }
                    // A real superset: wrap in a labeled, accent-bordered container.
                    const roundCount = parseStrengthSets(prescriptionForWeek(group[0], weekIndex)).length;
                    return (
                      <View key={gi} style={styles.supersetWrap}>
                        <Text style={styles.supersetHeader}>
                          SUPERSET{group[0].group ? ` ${group[0].group}` : ''} · {roundCount} {roundCount === 1 ? 'ROUND' : 'ROUNDS'}
                        </Text>
                        <Text style={styles.supersetSub}>Do one set of each, back to back, then rest.</Text>
                        <View style={{ gap: 8, marginTop: 8 }}>{cards}</View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Rest timer bar (floats above the sheet via a transparent modal). */}
      <Modal visible={!!rest} transparent animationType="fade" onRequestClose={() => setRest(null)}>
        <View style={styles.restWrap} pointerEvents="box-none">
          {rest ? (
            <View style={styles.restBar}>
              <Text style={styles.restLabel}>REST</Text>
              <View style={styles.restTrack}>
                <View style={[styles.restFill, { width: `${(rest.remaining / rest.total) * 100}%` }]} />
              </View>
              <Text style={styles.restClock}>{mmss(rest.remaining)}</Text>
              <Pressable
                onPress={() => {
                  const endsAt = rest.endsAt + 15000;
                  setRest({ ...rest, total: rest.total + 15, remaining: rest.remaining + 15, endsAt });
                  onActivityRef.current?.({ phase: 'rest', exercise: rest.exercise, phaseStartedAt: 0, restEndsAt: endsAt });
                }}
                style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>+15s</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onActivityRef.current?.({ phase: 'active', exercise: rest.exercise, phaseStartedAt: Date.now(), restEndsAt: 0 });
                  setRest(null);
                }}
                style={styles.smallBtn}>
                <Text style={[styles.smallBtnText, { color: colors.accent }]}>Skip</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>

      {runnerDay ? (
        <SupersetRunner
          day={runnerDay}
          week={targetWeek}
          weekIndex={weekIndex}
          programId={programId}
          restPrefSec={restPrefSec}
          serverLogs={serverLogs}
          serverSets={serverSets}
          onClose={() => setRunnerDay(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  pickerLabel: { color: colors.muted, fontSize: 12, fontWeight: '500', marginBottom: 6 },
  pillRow: { gap: 6, paddingRight: 8 },
  pill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  pillActive: { backgroundColor: colors.accent + '30', borderColor: colors.accent + '50' },
  pillIdle: { backgroundColor: colors.card, borderColor: 'transparent' },
  pillText: { fontSize: 12, fontWeight: '700' },

  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dayBadge: { backgroundColor: colors.accent + '22', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  dayBadgeText: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  dayTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  dayCount: { marginLeft: 'auto', fontSize: 12, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  roundsBadge: { backgroundColor: colors.success + '20', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  roundsText: { color: colors.success, fontSize: 12, fontWeight: '800' },
  noteText: { color: colors.muted, fontSize: 12 },

  supersetWrap: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: colors.accent + '0D',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  supersetHeader: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  supersetSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  exCard: { borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12 },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  exGroup: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  exName: { flex: 1, color: colors.foreground, fontSize: 14, fontWeight: '800' },
  exCount: { fontSize: 12, fontWeight: '700' },

  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  timedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  setNum: { width: 44, color: colors.muted, fontSize: 12, fontWeight: '600' },
  repInput: {
    width: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: 7,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
  wtInput: {
    width: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingVertical: 7,
    textAlign: 'center',
    fontSize: 14,
  },
  unit: { color: colors.muted, fontSize: 11 },
  times: { color: colors.muted, fontSize: 13 },
  checkCircle: {
    marginLeft: 'auto',
    height: 28,
    width: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleText: { color: colors.muted, fontSize: 14, fontWeight: '800' },

  timedClock: { minWidth: 52, textAlign: 'right', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timedDone: { color: colors.success, fontSize: 14, fontWeight: '700' },
  goBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  goText: { color: '#000', fontSize: 12, fontWeight: '800' },
  smallBtn: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  smallBtnText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  redoBtn: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  redoText: { color: colors.muted, fontSize: 12 },

  ladderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  ladderVal: { flex: 1, fontSize: 14, fontWeight: '700' },

  restWrap: { flex: 1, justifyContent: 'flex-end' },
  restBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },
  restLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  restTrack: { height: 8, flex: 1, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  restFill: { height: '100%', borderRadius: 4, backgroundColor: colors.accent },
  restClock: { color: colors.accent, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
