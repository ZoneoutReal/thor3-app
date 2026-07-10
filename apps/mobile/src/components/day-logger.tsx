import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtClock, fmtDuration, pacePerMile, parseDay, type DayStep } from '@/lib/day-steps';
import { beep, unlockAudio, vibrate } from '@/lib/feedback';
import type { DayWorkout } from '@/lib/program-data';
import type { LoggedValue } from '@/lib/sync';
import { colors } from '@/lib/theme';
import { mergeServerLogs, mergeServerSets, writeLog, writeSetDone } from '@/lib/workout-log';

// Parse a duration typed on the finish screen: a bare number is minutes
// ("45" -> 45:00), or a clock ("45:30", "1:02:05"). Returns seconds, or null.
function parseDurationInput(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  if (/^\d+$/.test(t)) return parseInt(t, 10) * 60;
  const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const min = parseInt(m[2], 10);
  const sec = parseInt(m[3], 10);
  if (sec >= 60) return null;
  if (m[1] && min >= 60) return null;
  return h * 3600 + min * 60 + sec;
}

// --- Synced log values + step completion for the current profile -------------

function useWorkoutLog(programId: string, serverLogs: Record<string, LoggedValue>, serverSets: string[]) {
  // Local-first merge of the server snapshot happens once at mount via lazy init
  // (the store is synchronous; local wins on conflict). Writes go through the
  // shared read-modify-write helpers so a co-mounted strength view never clobbers
  // these keys. Refs mirror state so a write's durable side effects run
  // synchronously — finishing unmounts this logger in the same batch, which would
  // otherwise discard a pending updater and lose the final duration.
  const [logs, setLogs] = useState<Record<string, LoggedValue>>(() => mergeServerLogs(programId, serverLogs));
  const [done, setDone] = useState<Set<string>>(() => new Set<string>(mergeServerSets(programId, serverSets)));
  const logsRef = useRef<Record<string, LoggedValue>>(logs);
  const setsRef = useRef<Set<string>>(done);

  const setLog = (key: string, value: string, metric?: string, week?: number) => {
    const next = writeLog(programId, key, value, { metric, week });
    logsRef.current = next;
    setLogs(next);
  };

  const toggleDone = (id: string, val?: boolean) => {
    const prev = setsRef.current;
    const want = val === undefined ? !prev.has(id) : val;
    if (prev.has(id) === want) return;
    const next = new Set(writeSetDone(programId, id, want));
    setsRef.current = next;
    setDone(next);
  };

  // Most recent value for a metric from an earlier week ("last time").
  const lastValue = (metric: string | undefined, beforeWeek: number): LoggedValue | null => {
    if (!metric) return null;
    let best: LoggedValue | null = null;
    for (const v of Object.values(logs)) {
      if (v.m === metric && typeof v.w === 'number' && v.w < beforeWeek) {
        if (!best || (best.w ?? 0) < v.w) best = v;
      }
    }
    return best;
  };

  return { logs, done, setLog, toggleDone, lastValue };
}

// --- Timers ------------------------------------------------------------------

function CountdownTimer({ seconds, done, onExpire }: { seconds: number; done: boolean; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const expireRef = useRef(onExpire);
  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      // Terminal transition of a countdown: stop, cue, check the step off.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRunning(false);
      beep();
      vibrate(400);
      expireRef.current();
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [running, remaining]);

  const pct = seconds > 0 ? (remaining / seconds) * 100 : 0;
  return (
    <View style={styles.timerBox}>
      <Text style={[styles.timerClock, { color: done ? colors.success : colors.accent }]}>
        {fmtClock(Math.max(0, remaining))}
      </Text>
      <View style={styles.timerTrack}>
        <View style={[styles.timerFill, { width: `${pct}%` }]} />
      </View>
      <Pressable
        onPress={() => {
          unlockAudio();
          setRunning((r) => !r);
        }}
        style={styles.timerBtn}>
        <Text style={styles.timerBtnText}>{running ? 'Pause' : remaining <= 0 ? 'Done' : 'Start'}</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setRunning(false);
          setRemaining(seconds);
        }}
        style={styles.timerResetBtn}>
        <Text style={styles.timerResetText}>Reset</Text>
      </Pressable>
    </View>
  );
}

function Stopwatch({ onStop }: { onStop: (elapsedSec: number) => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setElapsed((e) => e + 1), 1000);
    return () => clearTimeout(id);
  }, [running, elapsed]);

  return (
    <View style={styles.timerBox}>
      <Text style={[styles.timerClock, { color: colors.accent, width: 68 }]}>{fmtClock(elapsed)}</Text>
      <Pressable
        onPress={() => {
          if (running) {
            setRunning(false);
            onStop(elapsed);
          } else setRunning(true);
        }}
        style={[styles.timerBtn, { flex: 1 }]}>
        <Text style={styles.timerBtnText}>{running ? 'Stop & log' : elapsed > 0 ? 'Resume' : 'Start'}</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setRunning(false);
          setElapsed(0);
        }}
        style={styles.timerResetBtn}>
        <Text style={styles.timerResetText}>Reset</Text>
      </Pressable>
    </View>
  );
}

// --- One loggable step -------------------------------------------------------

function StepRow({
  step,
  value,
  done,
  last,
  onValue,
  onToggle,
}: {
  step: DayStep;
  value: string;
  done: boolean;
  last: LoggedValue | null;
  onValue: (v: string) => void;
  onToggle: (v?: boolean) => void;
}) {
  const needsValue = step.input !== 'none';
  const hasValue = value.trim() !== '';
  const canComplete = !needsValue || hasValue;
  const complete = (v?: boolean) => {
    const next = v === undefined ? !done : v;
    if (next && !canComplete) return;
    onToggle(next);
  };
  const pace = pacePerMile(step, value);

  return (
    <View style={[styles.step, { borderColor: done ? colors.success + '44' : colors.border, backgroundColor: done ? colors.success + '08' : colors.card }]}>
      <View style={styles.stepTop}>
        <Pressable
          onPress={() => complete()}
          disabled={!done && !canComplete}
          style={[
            styles.check,
            {
              borderColor: done ? colors.success : colors.border,
              backgroundColor: done ? colors.success : 'transparent',
              opacity: !done && !canComplete ? 0.4 : 1,
            },
          ]}>
          <Text style={styles.checkMark}>{done ? '✓' : ''}</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.stepLabel}>{step.label}</Text>
          {step.instruction ? <Text style={styles.stepInstruction}>{step.instruction}</Text> : null}
          {last ? (
            <Text style={styles.stepLast}>
              Last time (W{last.w}): {last.v}
            </Text>
          ) : null}
        </View>
      </View>

      {step.timer?.mode === 'countdown' ? (
        <CountdownTimer seconds={step.timer.seconds} done={done} onExpire={() => complete(true)} />
      ) : null}
      {step.timer?.mode === 'stopwatch' ? (
        <Stopwatch
          onStop={(sec) => {
            onValue(fmtClock(sec));
            onToggle(true);
          }}
        />
      ) : null}

      {step.input !== 'none' ? (
        <View style={styles.inputRow}>
          <TextInput
            value={value}
            onChangeText={onValue}
            keyboardType={step.input === 'reps' ? 'number-pad' : 'default'}
            placeholder={step.input === 'reps' ? 'reps' : step.unit === 'mm:ss' ? 'mm:ss' : step.unit || 'value'}
            placeholderTextColor={colors.muted}
            style={styles.valueInput}
          />
          <Text style={styles.inputUnit}>
            {step.input === 'reps' ? 'reps' : step.unit === 'mm:ss' ? 'your time' : step.unit}
          </Text>
          {pace ? <Text style={styles.pace}>{pace}</Text> : null}
        </View>
      ) : null}

      {needsValue && !hasValue && !done ? (
        <Text style={styles.stepHint}>
          Log your {step.input === 'reps' ? 'reps' : step.input === 'distance' ? 'distance' : 'time'} to check this off.
        </Text>
      ) : null}

      {step.rest ? <Text style={styles.restHint}>Then rest {fmtClock(step.rest)}</Text> : null}
    </View>
  );
}

// --- Full-screen day logger --------------------------------------------------

export function DayLogger({
  day,
  week,
  programId,
  typeLabel,
  dayComplete,
  serverLogs,
  serverSets,
  onOpenStrength,
  onFinish,
  onClose,
}: {
  day: DayWorkout;
  week: number;
  programId: string;
  strengthDayIndex: number;
  typeLabel: string;
  dayComplete: boolean;
  serverLogs: Record<string, LoggedValue>;
  serverSets: string[];
  onOpenStrength: () => void;
  onFinish: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { logs, done, setLog, toggleDone, lastValue } = useWorkoutLog(programId, serverLogs, serverSets);
  const sessions = parseDay(day);

  const noteKey = `note-${week}-${day.day}`;
  const rpeKey = `rpe-${week}-${day.day}`;
  const rpe = logs[rpeKey]?.v ?? '';

  // Whole-workout timer. We store the wall-clock START timestamp (synced), not a
  // running counter, so elapsed = now - start stays correct through a phone lock,
  // an app close, or a device switch. On finish we store the final seconds.
  const startKey = `session-start-${week}-${day.day}`;
  const durKey = `session-dur-${week}-${day.day}`;
  const startedAt = logs[startKey]?.v ?? null;
  const durationSec = logs[durKey]?.v ? parseInt(logs[durKey].v, 10) : null;
  const running = !!startedAt && durationSec == null;

  // Re-render once a second while running; the value is derived from the
  // timestamp so a backgrounded app loses nothing.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const [preCount, setPreCount] = useState<number | null>(null);
  // Wall-clock derive: the forceTick interval re-renders each second and this
  // recomputes elapsed from the stored start timestamp. Date.now() in render is
  // intentional here — it is exactly how the lock-screen-safe timer stays correct.
  // eslint-disable-next-line react-hooks/purity
  const elapsedSec = startedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000)) : 0;

  const startSession = () => setLog(startKey, new Date().toISOString(), 'session-start', week);
  const discardSession = () => setLog(startKey, '', 'session-start', week);
  const restartSession = () => {
    setLog(durKey, '', 'session-duration', week);
    setLog(startKey, new Date().toISOString(), 'session-start', week);
  };
  const beginCountdown = () => {
    if (preCount == null) {
      unlockAudio();
      setPreCount(3);
    }
  };
  useEffect(() => {
    if (preCount == null) return;
    if (preCount > 0) {
      const id = setTimeout(() => setPreCount((c) => (c == null ? null : c - 1)), 1000);
      return () => clearTimeout(id);
    }
    // preCount === 0 -> GO: stamp the start, then clear after a brief flash.
    beep();
    startSession();
    const id = setTimeout(() => setPreCount(null), 650);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preCount]);

  const [confirming, setConfirming] = useState(false);
  const [durInput, setDurInput] = useState('');
  const parsedInput = parseDurationInput(durInput);
  const openFinish = () => {
    setDurInput(running ? fmtDuration(elapsedSec) : durationSec != null ? fmtDuration(durationSec) : '');
    setConfirming(true);
  };
  const confirmFinish = () => {
    const t = durInput.trim();
    if (t === '') {
      if (startedAt) setLog(startKey, '', 'session-start', week);
    } else {
      if (parsedInput == null) return;
      setLog(durKey, String(parsedInput), 'session-duration', week);
    }
    setConfirming(false);
    onFinish();
  };

  const loggable = sessions.flatMap((s) => s.steps).filter((s) => s.kind === 'log');
  const completed = loggable.filter((s) => done.has(`${week}-${day.day}-${s.id}`)).length;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Text style={styles.closeX}>✕</Text>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Week {week} · {typeLabel}
            </Text>
            <Text style={styles.headerSub}>
              {completed}/{loggable.length} logged
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {/* Whole-workout timer (wall-clock; keeps counting while locked). */}
            <View style={[styles.timerCard, { borderColor: running ? colors.accent : colors.border, borderWidth: running ? 2 : 1 }]}>
              {durationSec != null ? (
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.timerCardLabel}>Workout time</Text>
                    <Text style={[styles.timerBig, { color: colors.success }]}>{fmtDuration(durationSec)}</Text>
                  </View>
                  <Pressable onPress={restartSession} style={styles.subtleBtn}>
                    <Text style={styles.subtleBtnText}>Restart</Text>
                  </Pressable>
                </View>
              ) : running ? (
                <View style={styles.rowBetween}>
                  <View style={{ minWidth: 0 }}>
                    <Text style={[styles.timerCardLabel, { color: colors.accent }]}>In progress</Text>
                    <Text style={[styles.timerBig, { color: colors.accent, fontSize: 34 }]}>{fmtDuration(elapsedSec)}</Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    <Pressable onPress={openFinish} style={styles.accentBtn}>
                      <Text style={styles.accentBtnText}>Finish workout</Text>
                    </Pressable>
                    <Pressable onPress={discardSession}>
                      <Text style={styles.discardText}>Discard</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                    <Text style={styles.timerIdleTitle}>Time this workout</Text>
                    <Text style={styles.timerIdleSub}>Keeps counting while your phone is locked.</Text>
                  </View>
                  <Pressable onPress={beginCountdown} style={styles.accentBtnLg}>
                    <Text style={styles.accentBtnText}>Start</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {sessions.map((session, si) => (
              <View key={si} style={{ gap: 8 }}>
                {session.label ? <Text style={styles.sessionLabel}>{session.label}</Text> : null}
                {session.steps.map((step) => {
                  if (step.kind === 'info') {
                    return (
                      <Text key={step.id} style={styles.infoLine}>
                        {step.label}
                      </Text>
                    );
                  }
                  if (step.kind === 'strength') {
                    // Phase 3 embeds the loggable strength sets here; for now, jump
                    // to the full sheet.
                    return (
                      <Pressable key={step.id} onPress={onOpenStrength} style={styles.strengthBtn}>
                        <Text style={styles.strengthBtnText}>🏋️ Open strength sheet →</Text>
                      </Pressable>
                    );
                  }
                  const logKey = `${week}-${day.day}-${step.id}`;
                  return (
                    <StepRow
                      key={step.id}
                      step={step}
                      value={logs[logKey]?.v ?? ''}
                      done={done.has(logKey)}
                      last={lastValue(step.metric, week)}
                      onValue={(v) => setLog(logKey, v, step.metric, week)}
                      onToggle={(val) => toggleDone(logKey, val)}
                    />
                  );
                })}
              </View>
            ))}

            {/* Subjective log: effort + free-text notes, synced with the rest. */}
            <View style={styles.rpeCard}>
              <Text style={styles.rpeTitle}>How it went</Text>
              <Text style={styles.rpeSub}>Effort (RPE 1-10)</Text>
              <View style={styles.rpeGrid}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                  const on = rpe === String(n);
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setLog(rpeKey, on ? '' : String(n), 'rpe', week)}
                      style={[styles.rpeCell, { backgroundColor: on ? colors.accent : colors.background, borderColor: on ? colors.accent : colors.border }]}>
                      <Text style={[styles.rpeCellText, { color: on ? '#000' : colors.muted }]}>{n}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={logs[noteKey]?.v ?? ''}
                onChangeText={(v) => setLog(noteKey, v, 'note', week)}
                placeholder="Notes: how you felt, injuries, weather, anything to remember."
                placeholderTextColor={colors.muted}
                multiline
                style={styles.notes}
              />
            </View>

            <Text style={styles.footerHint}>
              Your reps and times are saved and synced.{' '}
              {typeLabel === 'APFT' ? 'Track your scores week to week.' : 'Tap a step or let a timer check it off.'}
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
          <Pressable
            onPress={dayComplete ? onClose : openFinish}
            style={[styles.footerBtn, { backgroundColor: dayComplete ? colors.success + '20' : colors.accent }]}>
            <Text style={[styles.footerBtnText, { color: dayComplete ? colors.success : '#000' }]}>
              {dayComplete ? 'Completed ✓ · Close' : 'Finish & mark day complete'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Finish confirmation: review/edit the counted time (or type it in). */}
      {confirming ? (
        <Pressable style={styles.sheetScrim} onPress={() => setConfirming(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetGrip} />
            <Text style={styles.sheetTitle}>Finish workout</Text>
            <Text style={styles.sheetSub}>
              {running ? 'Confirm the time or edit it, then finish.' : 'Enter how long this workout took.'}
            </Text>
            <Text style={styles.sheetLabel}>Total time</Text>
            <TextInput
              value={durInput}
              onChangeText={setDurInput}
              placeholder="45  or  45:30"
              placeholderTextColor={colors.muted}
              autoFocus
              style={[styles.durInput, { borderColor: durInput.trim() && parsedInput == null ? colors.danger : colors.border }]}
            />
            <Text style={styles.durHint}>
              {durInput.trim() === ''
                ? 'Minutes (e.g. 45) or mm:ss. Leave blank to finish without a time.'
                : parsedInput == null
                  ? 'Enter minutes (45) or a clock (45:30 or 1:02:05).'
                  : `= ${fmtDuration(parsedInput)}${parsedInput >= 60 ? `  ·  ${Math.round(parsedInput / 60)} min` : ''}`}
            </Text>
            <View style={styles.sheetBtns}>
              <Pressable onPress={() => setConfirming(false)} style={styles.sheetCancel}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmFinish}
                disabled={durInput.trim() !== '' && parsedInput == null}
                style={[styles.sheetConfirm, { opacity: durInput.trim() !== '' && parsedInput == null ? 0.4 : 1 }]}>
                <Text style={styles.sheetConfirmText}>Confirm & finish</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      ) : null}

      {/* 3-2-1-GO pre-roll. Tap to cancel before GO. */}
      {preCount != null ? (
        <Pressable
          style={styles.goOverlay}
          onPress={() => {
            if (preCount > 0) setPreCount(null);
          }}>
          <Text style={styles.goNumber}>{preCount > 0 ? String(preCount) : 'GO'}</Text>
          <Text style={styles.goCaption}>{preCount > 0 ? 'GET READY' : 'TIMER RUNNING'}</Text>
        </Pressable>
      ) : null}
    </Modal>
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
  headerTitle: { color: colors.foreground, fontSize: 16, fontWeight: '800' },
  headerSub: { color: colors.muted, fontSize: 12, marginTop: 1 },

  body: { padding: 16, gap: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },

  timerCard: { borderRadius: 14, padding: 16 },
  timerCardLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  timerBig: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },
  timerIdleTitle: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  timerIdleSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  accentBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, alignItems: 'center' },
  accentBtnLg: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 11, alignItems: 'center' },
  accentBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },
  discardText: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  subtleBtn: { backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  subtleBtnText: { color: colors.muted, fontSize: 12, fontWeight: '700' },

  sessionLabel: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  infoLine: { color: colors.muted, fontSize: 12, paddingHorizontal: 4 },
  strengthBtn: { backgroundColor: colors.accent + '20', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  strengthBtnText: { color: colors.accent, fontSize: 14, fontWeight: '700' },

  step: { borderRadius: 10, borderWidth: 1, padding: 12 },
  stepTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  check: { marginTop: 1, height: 24, width: 24, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#000', fontSize: 14, fontWeight: '800' },
  stepLabel: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  stepInstruction: { color: colors.muted, fontSize: 12, marginTop: 2 },
  stepLast: { color: colors.accent, fontSize: 12, marginTop: 2 },
  stepHint: { color: colors.muted, fontSize: 11, marginTop: 6 },
  restHint: { color: colors.muted, fontSize: 11, marginTop: 8, letterSpacing: 0.5, textTransform: 'uppercase' },

  timerBox: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 8,
  },
  timerClock: { width: 56, textAlign: 'center', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerTrack: { height: 6, flex: 1, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  timerFill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  timerBtn: { backgroundColor: colors.accent + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  timerBtnText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  timerResetBtn: { backgroundColor: colors.card, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  timerResetText: { color: colors.muted, fontSize: 12 },

  inputRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  valueInput: {
    width: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 14,
    color: colors.foreground,
  },
  inputUnit: { color: colors.muted, fontSize: 12 },
  pace: { marginLeft: 'auto', color: colors.accent, fontSize: 12, fontWeight: '700' },

  rpeCard: { borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 12 },
  rpeTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  rpeSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rpeGrid: { flexDirection: 'row', gap: 4, marginTop: 8 },
  rpeCell: { flex: 1, borderRadius: 7, borderWidth: 1, paddingVertical: 7, alignItems: 'center' },
  rpeCellText: { fontSize: 12, fontWeight: '700' },
  notes: {
    marginTop: 12,
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.foreground,
    textAlignVertical: 'top',
  },
  footerHint: { color: colors.muted, fontSize: 11, textAlign: 'center', paddingTop: 4 },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  footerBtnText: { fontSize: 14, fontWeight: '800' },

  sheetScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingTop: 16 },
  sheetGrip: { alignSelf: 'center', height: 4, width: 40, borderRadius: 2, backgroundColor: colors.border, marginBottom: 16 },
  sheetTitle: { color: colors.foreground, fontSize: 16, fontWeight: '800' },
  sheetSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sheetLabel: { color: colors.foreground, fontSize: 14, fontWeight: '700', marginTop: 16 },
  durInput: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: colors.foreground,
  },
  durHint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6 },
  sheetBtns: { flexDirection: 'row', gap: 8, marginTop: 20 },
  sheetCancel: { backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
  sheetCancelText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  sheetConfirm: { flex: 1, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  sheetConfirmText: { color: '#000', fontSize: 14, fontWeight: '800' },

  goOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  goNumber: { color: colors.accent, fontSize: 96, fontWeight: '900', fontVariant: ['tabular-nums'] },
  goCaption: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 6, marginTop: 20 },
});
