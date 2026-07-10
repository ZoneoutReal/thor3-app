import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { programs } from '@/lib/program-data';
import type { Profile } from '@/lib/profiles';
import { disableDevicePush, enableDevicePush, hasDevicePush, testDevicePush, type PushState } from '@/lib/push';
import { getProfileId } from '@/lib/profiles';
import { setActivityNotify, setReminder } from '@/lib/sync';
import { colors } from '@/lib/theme';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = [0, 15, 30, 45];
function fmt12(h: number, m: number) {
  const ap = h < 12 ? 'AM' : 'PM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}
const REST_PRESETS: { label: string; sec: number }[] = [
  { label: 'Program', sec: 0 },
  { label: '0:30', sec: 30 },
  { label: '0:45', sec: 45 },
  { label: '1:00', sec: 60 },
  { label: '1:30', sec: 90 },
  { label: '2:00', sec: 120 },
  { label: '3:00', sec: 180 },
];

export function Settings({
  myProfile,
  programId,
  startDate,
  restPref,
  onProgramChange,
  onStartDateChange,
  onRestPrefChange,
  onReminderSaved,
  onClose,
}: {
  myProfile?: Profile;
  programId: string;
  startDate: string | null;
  restPref: number;
  onProgramChange: (id: string) => void;
  onStartDateChange: (iso: string) => void;
  onRestPrefChange: (sec: number) => void;
  onReminderSaved: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  // Reminder + activity seed from the profile snapshot, reseeding if it changes.
  const [hour, setHour] = useState(myProfile?.reminder_hour ?? 6);
  const [min, setMin] = useState(myProfile?.reminder_min ?? 0);
  const [enabled, setEnabled] = useState(myProfile?.reminder_enabled ?? true);
  const [activity, setActivity] = useState(myProfile?.activity_notify ?? true);
  const [seen, setSeen] = useState(myProfile?.id ?? '');
  if (myProfile && myProfile.id !== seen) {
    setSeen(myProfile.id);
    setHour(myProfile.reminder_hour);
    setMin(myProfile.reminder_min);
    setEnabled(myProfile.reminder_enabled);
    setActivity(myProfile.activity_notify);
  }

  const [dateText, setDateText] = useState(startDate ?? '');
  const [pushState, setPushState] = useState<PushState | 'idle'>(hasDevicePush() ? 'enabled' : 'idle');
  const [busy, setBusy] = useState(false);

  const saveReminder = (patch: { hour?: number; min?: number; enabled?: boolean }) => {
    const pid = getProfileId();
    if (pid) void setReminder(pid, patch).then(onReminderSaved);
  };
  const saveActivity = (next: boolean) => {
    setActivity(next);
    const pid = getProfileId();
    if (pid) void setActivityNotify(pid, next).then(onReminderSaved);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={[styles.sheet, { maxHeight: '92%', paddingBottom: insets.bottom + 24 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grip} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Settings</Text>
            {myProfile ? <Text style={styles.signedIn}>Signed in as {myProfile.display_name}</Text> : null}

            {/* Program */}
            <Text style={styles.sectionLabel}>Program</Text>
            <View style={styles.rowGap}>
              {programs.map((p) => {
                const on = programId === p.id;
                return (
                  <Pressable key={p.id} onPress={() => onProgramChange(p.id)} style={[styles.segBtn, { backgroundColor: on ? colors.accent : colors.card }]}>
                    <Text style={[styles.segText, { color: on ? '#000' : colors.muted }]}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Start date */}
            <Text style={styles.sectionLabel}>Start date</Text>
            <Text style={styles.hint}>The Monday of Week 1. Anchors &ldquo;Today&rdquo; to the right week and day.</Text>
            <TextInput
              value={dateText}
              onChangeText={(v) => {
                setDateText(v);
                if (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v)) onStartDateChange(v);
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            {/* Rest timer */}
            <Text style={styles.sectionLabel}>Rest timer</Text>
            <Text style={styles.hint}>Your break after each set. &ldquo;Program&rdquo; uses the sheet&apos;s prescribed rests.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowGap}>
              {REST_PRESETS.map((r) => {
                const on = restPref === r.sec;
                return (
                  <Pressable key={r.sec} onPress={() => onRestPrefChange(r.sec)} style={[styles.chip, { backgroundColor: on ? colors.accent : colors.card }]}>
                    <Text style={[styles.chipText, { color: on ? '#000' : colors.muted }]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Device notifications */}
            <View style={styles.divider} />
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.rowTitle}>Device notifications</Text>
                <Text style={styles.hint}>
                  {pushState === 'enabled'
                    ? 'On. Daily reminders arrive on your lock screen.'
                    : pushState === 'unsupported'
                      ? 'Not available on web.'
                      : pushState === 'needs-build'
                        ? 'Available once Rukr is installed from the app build.'
                        : pushState === 'denied'
                          ? 'Blocked. Enable notifications for Rukr in Settings.'
                          : 'Get daily workout reminders even when the app is closed.'}
                </Text>
              </View>
              {pushState === 'enabled' ? (
                <Pressable
                  onPress={() => {
                    void disableDevicePush();
                    setPushState('idle');
                  }}
                  style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>Disable</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={async () => {
                    setBusy(true);
                    setPushState(await enableDevicePush());
                    setBusy(false);
                  }}
                  disabled={busy}
                  style={[styles.enableBtn, busy && { opacity: 0.5 }]}>
                  <Text style={styles.enableText}>{busy ? '...' : 'Enable'}</Text>
                </Pressable>
              )}
            </View>
            {pushState === 'enabled' ? (
              <Pressable onPress={() => void testDevicePush()} style={styles.testBtn}>
                <Text style={styles.testText}>Send test</Text>
              </Pressable>
            ) : null}

            {/* Daily reminder time */}
            <View style={styles.divider} />
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Daily reminder</Text>
                <Text style={styles.hint}>Your own time</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={(next) => {
                  setEnabled(next);
                  saveReminder({ enabled: next });
                }}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor="#fff"
              />
            </View>
            {enabled ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.rowGap, { marginTop: 8 }]}>
                  {HOURS.map((h) => {
                    const on = h === hour;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => {
                          setHour(h);
                          saveReminder({ hour: h });
                        }}
                        style={[styles.chip, { backgroundColor: on ? colors.accent : colors.card }]}>
                        <Text style={[styles.chipText, { color: on ? '#000' : colors.muted }]}>{fmt12(h, min)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={[styles.rowGap, { marginTop: 8 }]}>
                  {MINUTES.map((m) => {
                    const on = m === min;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => {
                          setMin(m);
                          saveReminder({ min: m });
                        }}
                        style={[styles.chip, { backgroundColor: on ? colors.accent : colors.card }]}>
                        <Text style={[styles.chipText, { color: on ? '#000' : colors.muted }]}>:{String(m).padStart(2, '0')}</Text>
                      </Pressable>
                    );
                  })}
                  <Text style={styles.central}>Central</Text>
                </View>
              </>
            ) : null}

            {/* Family activity */}
            <View style={styles.divider} />
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.rowTitle}>Family activity</Text>
                <Text style={styles.hint}>Get a nudge when someone finishes a workout</Text>
              </View>
              <Switch value={activity} onValueChange={saveActivity} trackColor={{ true: colors.accent, false: colors.border }} thumbColor="#fff" />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingTop: 12 },
  grip: { alignSelf: 'center', height: 4, width: 40, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  title: { color: colors.foreground, fontSize: 16, fontWeight: '800' },
  signedIn: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sectionLabel: { color: colors.foreground, fontSize: 14, fontWeight: '700', marginTop: 16 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowGap: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center' },
  segBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  segText: { fontSize: 12, fontWeight: '700' },
  input: { marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.foreground },
  chip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: '700' },
  central: { color: colors.muted, fontSize: 12, marginLeft: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  rowTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  enableBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  enableText: { color: '#000', fontSize: 13, fontWeight: '800' },
  smallBtn: { backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  smallBtnText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  testBtn: { marginTop: 10, backgroundColor: colors.accent + '20', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  testText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
});
