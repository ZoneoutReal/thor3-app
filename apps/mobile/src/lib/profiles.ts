// Identity: which family member is using this device, and the shared passcode.
// Both live only on this device (the local store, mirrored to AsyncStorage).
// Profile display names are never hard-coded here — they come from the server
// (see sync.pullAll), so the repo carries no personal identities.

import { getItem, removeItem, setItem } from './store';

export type Profile = {
  id: string;
  display_name: string;
  reminder_enabled: boolean;
  reminder_hour: number;
  reminder_min: number;
  tz: string;
  sort: number;
  activity_notify: boolean; // get pinged when a family member finishes a workout
};

const PASSCODE_KEY = 'thor3-passcode';
const PROFILE_KEY = 'thor3-profile';

export function getPasscode(): string | null {
  return getItem(PASSCODE_KEY);
}
export function setPasscode(v: string) {
  setItem(PASSCODE_KEY, v);
}

export function getProfileId(): string | null {
  return getItem(PROFILE_KEY);
}
export function setProfileId(v: string) {
  setItem(PROFILE_KEY, v);
}

// Full reset — used by "Switch profile" / a failed passcode.
export function clearIdentity() {
  removeItem(PASSCODE_KEY);
  removeItem(PROFILE_KEY);
}
