import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DEV_BYPASS, DEV_PASSCODE, DEV_PROFILE_ID } from '@/lib/dev-bypass';
import { getPasscode, setPasscode, setProfileId } from '@/lib/profiles';
import { hydrateStore } from '@/lib/store';
import { initSync } from '@/lib/sync';
import { colors } from '@/lib/theme';

// Boot order matters: hydrate the local store from disk BEFORE any screen reads
// identity/logs (the store is the synchronous source of truth), then wire the
// background sync flush triggers. Held behind a brief splash-covered gate.
export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    hydrateStore()
      .then(() => {
        if (!alive) return;
        // Dev-only: seed a test identity so the unlocked app can be verified without
        // the real family passcode. No-op unless EXPO_PUBLIC_DEV_BYPASS=1.
        if (DEV_BYPASS && !getPasscode()) {
          setPasscode(DEV_PASSCODE);
          setProfileId(DEV_PROFILE_ID);
        }
        initSync();
        setReady(true);
      })
      .catch(() => {
        // Hydration ultimately failed. Surface a retry rather than booting against
        // an empty store (which the first write would then overwrite on disk).
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (failed) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.bootError}>
          <Text style={styles.bootErrorTitle}>Couldn&apos;t load your saved data</Text>
          <Text style={styles.bootErrorBody}>
            Your history is safe on this device — this was just a load hiccup. Tap retry.
          </Text>
          <Pressable
            onPress={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
            style={styles.bootRetry}>
            <Text style={styles.bootRetryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaProvider>
    );
  }
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootError: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
  },
  bootErrorTitle: { color: colors.foreground, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  bootErrorBody: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  bootRetry: {
    marginTop: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  bootRetryText: { color: '#000', fontWeight: '600', fontSize: 15 },
});
