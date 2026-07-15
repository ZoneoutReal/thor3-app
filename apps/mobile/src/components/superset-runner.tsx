import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { beep, unlockAudio, vibrate } from '@/lib/feedback';
import { parseStrengthSets, prescriptionForWeek, type StrengthDay, type StrengthRow } from '@/lib/program-data';
import type { SupersetStyle } from '@/lib/program-prefs';
import type { LoggedValue } from '@/lib/sync';
import { colors } from '@/lib/theme';
import { mergeServerLogs, mergeServerSets, writeLog, writeSetDone } from '@/lib/workout-log';

// --- small helpers (kept local so the runner is self-contained) --------------
function defaultReps(label: string): string {
  const t = label.trim().replace(/\bea\b/gi, '').replace(/\+/g, '').trim();
  return /^\d+$/.test(t) ? t : '';
}
function restSeconds(rest?: string): number | undefined {
  if (!rest) return undefined;
  const m = rest.match(/(\d+):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : undefined;
}
function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;
}

// Group consecutive same-letter rows into supersets. A row with no group (or a
// group letter that doesn't continue the previous one) starts its own group.
function toGroups(rows: StrengthRow[]): StrengthRow[][] {
  const groups: StrengthRow[][] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && row.group && last[0].group === row.group) last.push(row);
    else groups.push([row]);
  }
  return groups;
}

type Step = {
  gi: number; // group index
  round: number; // 0-based SET index of this exercise (drives the persisted set id)
  rounds: number; // total sets, for the headline
  posInGroup: number; // 1-based exercise position in the pair
  groupSize: number; // exercises in the pair (active this round, superset mode)
  isSuperset: boolean;
  style: SupersetStyle;
  groupLabel?: string; // the pairing letter, e.g. "B"
  row: StrengthRow;
  target: string; // the set's prescribed label, e.g. "15", "12 ea", "MAX"
  timedSec?: number; // present for a timed set (plank etc.)
  restAfter?: number; // seconds to rest after logging this set
  headline: string; // "Round 2 of 3" (superset) | "Set 2 of 3" (straight)
};

// Flatten the day into an ordered list of "log this set" steps. The pairing is
// kept either way; only the ORDER differs:
//  - 'superset': each round does one set of every exercise in the group, then rests.
//  - 'straight': finish every set of one exercise (resting between) before the next
//    in the pair — for a crowded gym where you can't hold two stations.
// The set id (`week|day|name|setIndex`) is identical in both, so progress carries
// over if the style is switched mid-workout.
function buildSteps(day: StrengthDay, weekIndex: number, restPrefSec: number, style: SupersetStyle): Step[] {
  const steps: Step[] = [];
  for (const [gi, group] of toGroups(day.rows ?? []).entries()) {
    const setsByRow = group.map((row) => parseStrengthSets(prescriptionForWeek(row, weekIndex)));
    const rounds = Math.max(1, ...setsByRow.map((s) => s.length));
    const isSuperset = group.length > 1;
    const groupLabel = group[0].group;
    const groupRest = restPrefSec > 0 ? restPrefSec : restSeconds(group[group.length - 1].rest);

    if (style === 'straight') {
      group.forEach((row, ri) => {
        setsByRow[ri].forEach((set, setIdx) => {
          steps.push({
            gi,
            round: setIdx,
            rounds: setsByRow[ri].length,
            posInGroup: ri + 1,
            groupSize: group.length,
            isSuperset,
            style,
            groupLabel,
            row,
            target: set.label,
            timedSec: set.seconds,
            restAfter: groupRest, // rest after every straight set
            headline: `Set ${setIdx + 1} of ${setsByRow[ri].length}`,
          });
        });
      });
    } else {
      for (let round = 0; round < rounds; round++) {
        const active = group.map((row, i) => ({ row, set: setsByRow[i][round] })).filter((x) => x.set);
        active.forEach(({ row, set }, j) => {
          steps.push({
            gi,
            round,
            rounds,
            posInGroup: j + 1,
            groupSize: active.length,
            isSuperset,
            style,
            groupLabel,
            row,
            target: set.label,
            timedSec: set.seconds,
            restAfter: j === active.length - 1 ? groupRest : undefined,
            headline: `Round ${round + 1} of ${rounds}`,
          });
        });
      }
    }
  }
  return steps;
}

export function SupersetRunner({
  day,
  week,
  weekIndex,
  programId,
  restPrefSec,
  supersetStyle,
  serverLogs,
  serverSets,
  onClose,
}: {
  day: StrengthDay;
  week: number;
  weekIndex: number;
  programId: string;
  restPrefSec: number;
  supersetStyle: SupersetStyle;
  serverLogs?: Record<string, LoggedValue>;
  serverSets?: string[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const steps = useMemo(
    () => buildSteps(day, weekIndex, restPrefSec, supersetStyle),
    [day, weekIndex, restPrefSec, supersetStyle]
  );

  const [done, setDone] = useState<Set<string>>(() => new Set(mergeServerSets(programId, serverSets ?? [])));
  const [logs, setLogs] = useState<Record<string, LoggedValue>>(() => mergeServerLogs(programId, serverLogs ?? {}));
  const getVal = (k: string) => logs[k]?.v ?? '';
  const setLog = (k: string, v: string) => setLogs(writeLog(programId, k, v, { week }));
  const markDone = (id: string, v: boolean) => setDone(new Set(writeSetDone(programId, id, v)));

  const [cursor, setCursor] = useState(() => {
    // Resume at the first not-yet-done set.
    const built = buildSteps(day, weekIndex, restPrefSec, supersetStyle);
    const doneSet = new Set(mergeServerSets(programId, serverSets ?? []));
    const idx = built.findIndex((s) => !doneSet.has(`${week}|${day.label}|${s.row.name}|${s.round}`));
    return idx < 0 ? 0 : idx;
  });
  const [rest, setRest] = useState<{ total: number } | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const endAtRef = useRef(0);

  // Rest countdown, wall-clock derived (via the ref) so a locked phone stays
  // correct; the completion cue + advance fire from the interval, not render.
  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setRestLeft(left);
      if (left <= 0) {
        beep();
        vibrate(300);
        setRest(null);
        setCursor((c) => Math.min(c + 1, steps.length - 1));
      }
    }, 400);
    return () => clearInterval(id);
  }, [rest, steps.length]);

  const step = steps[cursor];
  if (!step) {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
          <Text style={styles.doneBig}>All sets logged ✓</Text>
          <Pressable onPress={onClose} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Done</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  const sid = `${week}|${day.label}|${step.row.name}|${step.round}`;
  const wtKey = `${sid}|w`;
  const def = defaultReps(step.target);
  const loggedReps = getVal(sid);
  const loggedWt = getVal(wtKey);
  // Carry the last weight this exercise used in an earlier round.
  let carryWt = '';
  for (let r = step.round - 1; r >= 0; r--) {
    const w = getVal(`${week}|${day.label}|${step.row.name}|${r}|w`);
    if (w) {
      carryWt = w;
      break;
    }
  }
  const isLastStep = cursor === steps.length - 1;
  const btnLabel = isLastStep
    ? 'Log & Finish'
    : step.restAfter && step.restAfter > 0
      ? 'Log & Rest'
      : step.style === 'straight'
        ? 'Log & Next Set'
        : 'Log & Next Exercise';

  const advance = () => {
    if (isLastStep) {
      onClose();
    } else if (step.restAfter && step.restAfter > 0) {
      endAtRef.current = Date.now() + step.restAfter * 1000;
      setRestLeft(step.restAfter);
      setRest({ total: step.restAfter });
    } else {
      setCursor((c) => Math.min(c + 1, steps.length - 1));
    }
  };
  const logAndAdvance = () => {
    if (!loggedReps && def) setLog(sid, def);
    if (!loggedWt && carryWt) setLog(wtKey, carryWt);
    if (!done.has(sid)) markDone(sid, true);
    unlockAudio();
    advance();
  };

  const skipRest = () => {
    setRest(null);
    setCursor((c) => Math.min(c + 1, steps.length - 1));
  };
  const nextStep = steps[Math.min(cursor + 1, steps.length - 1)];

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Text style={styles.closeX}>✕</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headTitle} numberOfLines={1}>
              {day.title ?? day.label}
            </Text>
            <Text style={styles.headSub}>
              Set {cursor + 1} of {steps.length}
            </Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(cursor / steps.length) * 100}%` }]} />
        </View>

        {rest ? (
          <View style={[styles.center, { flex: 1, gap: 10 }]}>
            <Text style={styles.restLabel}>REST</Text>
            <Text style={styles.restClock}>{mmss(restLeft)}</Text>
            {nextStep ? (
              <Text style={styles.nextUp}>
                Next: {nextStep.row.name} · {nextStep.headline}
              </Text>
            ) : null}
            <Pressable onPress={skipRest} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip rest</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: 'center', gap: 18 }}>
            {step.isSuperset ? (
              <View style={styles.supersetTag}>
                <Text style={styles.supersetTagText}>
                  {step.style === 'straight' ? 'PAIR' : 'SUPERSET'}
                  {step.groupLabel ? ` ${step.groupLabel}` : ''} · EXERCISE {step.posInGroup} OF {step.groupSize}
                  {step.style === 'straight' ? ' · STRAIGHT' : ''}
                </Text>
              </View>
            ) : null}
            <Text style={styles.roundText}>{step.headline}</Text>
            <Text style={styles.exName}>{step.row.name}</Text>
            <Text style={styles.targetText}>Target: {step.target}</Text>

            {step.timedSec != null ? (
              <Text style={styles.timedTarget}>Timed hold · {mmss(step.timedSec)}</Text>
            ) : (
              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <TextInput
                    value={loggedReps || def}
                    onChangeText={(v) => setLog(sid, v)}
                    keyboardType="number-pad"
                    placeholder={def || step.target}
                    placeholderTextColor={colors.muted}
                    style={[styles.bigInput, { color: !loggedReps && def ? colors.muted : colors.foreground }]}
                  />
                  <Text style={styles.inputLabel}>{/\bea\b/i.test(step.target) ? 'reps ea' : 'reps'}</Text>
                </View>
                <Text style={styles.times}>×</Text>
                <View style={styles.inputCol}>
                  <TextInput
                    value={loggedWt || carryWt}
                    onChangeText={(v) => setLog(wtKey, v)}
                    keyboardType="decimal-pad"
                    placeholder="–"
                    placeholderTextColor={colors.muted}
                    style={[styles.bigInput, { color: !loggedWt && carryWt ? colors.muted : colors.foreground }]}
                  />
                  <Text style={styles.inputLabel}>lb</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {!rest ? (
          <View style={[styles.footer, { paddingBottom: Math.max(14, insets.bottom) }]}>
            <Pressable onPress={logAndAdvance} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>{btnLabel}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn: { height: 36, width: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  closeX: { color: colors.foreground, fontSize: 16 },
  headTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  headSub: { color: colors.muted, fontSize: 12 },
  progressTrack: { height: 3, backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: colors.accent, borderRadius: 2 },
  supersetTag: { alignSelf: 'flex-start', backgroundColor: colors.accent + '22', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  supersetTagText: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  roundText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  exName: { color: colors.foreground, fontSize: 30, fontWeight: '800' },
  targetText: { color: colors.muted, fontSize: 16 },
  timedTarget: { color: colors.accent, fontSize: 28, fontWeight: '800' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 8 },
  inputCol: { alignItems: 'center', gap: 4 },
  bigInput: {
    minWidth: 96,
    textAlign: 'center',
    fontSize: 40,
    fontWeight: '800',
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    paddingVertical: 4,
  },
  inputLabel: { color: colors.muted, fontSize: 13 },
  times: { color: colors.muted, fontSize: 26, paddingBottom: 18 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#000', fontSize: 16, fontWeight: '800' },
  restLabel: { color: colors.muted, fontSize: 15, fontWeight: '700', letterSpacing: 2 },
  restClock: { color: colors.accent, fontSize: 64, fontWeight: '800' },
  nextUp: { color: colors.muted, fontSize: 14 },
  skipBtn: { marginTop: 10, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.card },
  skipText: { color: colors.foreground, fontSize: 15, fontWeight: '600' },
  doneBig: { color: colors.success, fontSize: 24, fontWeight: '800', marginBottom: 20 },
});
