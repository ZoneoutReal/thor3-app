import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Minimal root layout for the native Rukr app. The full gate/tab shell arrives in
// Phase 1; Phase 0 just proves the SDK 56 build renders the shared program data.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#111113' },
        }}
      />
    </SafeAreaProvider>
  );
}
