// Native device-push client for daily reminders. This is the client half; it
// needs two gated pieces to actually deliver: an EAS build (which injects the
// projectId the Expo push service scopes a token to) and the backend's Expo-push
// support (the `*-expo` push-subscribe actions + an Expo sender in push-send).
// Until both land it degrades to a clear "needs the app build" state, and it
// never touches web (expo-notifications' remote push is native-only).

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { DEV_BYPASS } from './dev-bypass';
import { getPasscode, getProfileId } from './profiles';
import { getItem, removeItem, setItem } from './store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const FN_URL = `${SUPABASE_URL}/functions/v1/push-subscribe`;
const TOKEN_KEY = 'thor3-expo-token';

// Foreground presentation (v56 field names: shouldShowBanner/shouldShowList).
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function callPush(payload: Record<string, unknown>): Promise<{ success?: boolean; error?: string }> {
  if (!SUPABASE_URL) return { success: false, error: 'not configured' };
  try {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(ANON ? { apikey: ANON, Authorization: `Bearer ${ANON}` } : {}) },
      body: JSON.stringify({ passcode: getPasscode() ?? '', ...payload }),
    });
    return (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'request failed' };
  }
}

export type PushState = 'unsupported' | 'denied' | 'needs-build' | 'enabled' | 'error';

function projectId(): string | undefined {
  const id = Constants?.expoConfig?.extra?.eas?.projectId;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

export function hasDevicePush(): boolean {
  return getItem(TOKEN_KEY) != null;
}

// Request permission, get the Expo push token, register it for daily reminders.
export async function enableDevicePush(): Promise<PushState> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const cur = await Notifications.getPermissionsAsync();
    let granted = cur.granted;
    if (!granted && cur.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return 'denied';

    const pid = projectId();
    if (!pid) return 'needs-build'; // getExpoPushTokenAsync throws without an EAS projectId

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: pid });
    if (!token) return 'error';
    setItem(TOKEN_KEY, token);
    if (!DEV_BYPASS) await callPush({ action: 'subscribe-expo', token, profile: getProfileId() });
    return 'enabled';
  } catch {
    return 'error';
  }
}

export async function disableDevicePush(): Promise<void> {
  const token = getItem(TOKEN_KEY);
  removeItem(TOKEN_KEY);
  if (token && !DEV_BYPASS) await callPush({ action: 'unsubscribe-expo', token });
}

export async function testDevicePush(): Promise<{ success?: boolean; error?: string }> {
  const token = getItem(TOKEN_KEY);
  if (!token) return { success: false, error: 'not enabled' };
  if (DEV_BYPASS) return { success: true };
  return callPush({ action: 'test-expo', token });
}
