import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    let alive = true;
    hydrateStore().then(() => {
      if (!alive) return;
      // Dev-only: seed a test identity so the unlocked app can be verified without
      // the real family passcode. No-op unless EXPO_PUBLIC_DEV_BYPASS=1.
      if (DEV_BYPASS && !getPasscode()) {
        setPasscode(DEV_PASSCODE);
        setProfileId(DEV_PROFILE_ID);
      }
      initSync();
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

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
