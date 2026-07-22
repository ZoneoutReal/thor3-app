import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setPasscode, setProfileId, type Profile } from '@/lib/profiles';
import { pullAll, type Snapshot } from '@/lib/sync';
import { colors } from '@/lib/theme';

// First-run gate: enter the shared family passcode, then pick who's training on
// this device. Shown until both are set; also reused to switch profiles.
export function Gate({
  initialStep = 'code',
  knownProfiles,
  onUnlock,
  onClose,
}: {
  initialStep?: 'code' | 'pick';
  knownProfiles?: Profile[];
  onUnlock: (snapshot: Snapshot | null) => void;
  onClose?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'code' | 'pick'>(initialStep);
  const [code, setCode] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>(knownProfiles ?? []);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submitCode() {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    const r = await pullAll(code.trim());
    setLoading(false);
    if (!r.ok || !r.snapshot) {
      setError(
        r.error === 'unauthorized'
          ? "That code doesn't match. Try again."
          : "Couldn't reach the server. Check your connection."
      );
      return;
    }
    setPasscode(code.trim());
    setProfiles(r.snapshot.profiles);
    setSnapshot(r.snapshot);
    setStep('pick');
  }

  function pick(p: Profile) {
    setProfileId(p.id);
    onUnlock(snapshot);
  }

  return (
    <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.inner}>
        <View style={styles.brandWrap}>
          <Text style={styles.brand}>
            Ruk<Text style={{ color: colors.accent }}>r</Text>
          </Text>
          <Text style={styles.tagline}>SFAS CONDITIONING</Text>
        </View>

        {step === 'code' ? (
          <View style={styles.form}>
            <Text style={styles.label}>Family code</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              placeholder="Enter your shared code"
              placeholderTextColor={colors.muted}
              onSubmitEditing={submitCode}
              returnKeyType="go"
              style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              onPress={submitCode}
              disabled={loading || !code.trim()}
              style={[styles.primaryBtn, (loading || !code.trim()) && styles.disabled]}>
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryBtnText}>Continue</Text>
              )}
            </Pressable>
            <Text style={styles.hint}>Shared by you and your training partner.</Text>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.pickTitle}>Who&apos;s training?</Text>
            {profiles.length === 0 ? (
              <>
                <Text style={styles.hint}>No profiles are set up for this code yet.</Text>
                <Pressable
                  onPress={() => {
                    setStep('code');
                    setError('');
                  }}
                  style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Re-enter code</Text>
                </Pressable>
              </>
            ) : null}
            {profiles.map((p) => (
              <Pressable key={p.id} onPress={() => pick(p)} style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{p.display_name.slice(0, 1)}</Text>
                </View>
                <Text style={styles.profileName}>{p.display_name}</Text>
              </Pressable>
            ))}
            {onClose ? (
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  inner: { width: '100%', maxWidth: 320 },
  brandWrap: { marginBottom: 32, alignItems: 'center' },
  brand: { color: colors.foreground, fontSize: 34, fontWeight: '800', letterSpacing: 0.5 },
  tagline: { marginTop: 6, color: colors.muted, fontSize: 11, letterSpacing: 3, fontWeight: '600' },
  form: { gap: 12 },
  label: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
  input: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: 'center',
    fontSize: 18,
    letterSpacing: 1,
    color: colors.foreground,
  },
  error: { color: '#f87171', fontSize: 14 },
  primaryBtn: {
    width: '100%',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  primaryBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  hint: { paddingTop: 8, textAlign: 'center', color: colors.muted, fontSize: 12 },
  pickTitle: { textAlign: 'center', color: colors.foreground, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '22',
  },
  avatarText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  profileName: { color: colors.foreground, fontSize: 16, fontWeight: '600' },
  cancelBtn: { paddingVertical: 8, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 12 },
});
