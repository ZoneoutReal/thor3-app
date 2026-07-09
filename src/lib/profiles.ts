// Identity: which family member is using this device, and the shared passcode.
// Both live only in this device's localStorage. Profile display names are never
// hard-coded here — they come from the server (see sync.pullAll), so the public
// repo carries no personal identities.

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

const PASSCODE_KEY = "thor3-passcode";
const PROFILE_KEY = "thor3-profile";

function ls(): Storage | null {
  return typeof window !== "undefined" ? window.localStorage : null;
}

export function getPasscode(): string | null {
  return ls()?.getItem(PASSCODE_KEY) ?? null;
}
export function setPasscode(v: string) {
  ls()?.setItem(PASSCODE_KEY, v);
}

export function getProfileId(): string | null {
  return ls()?.getItem(PROFILE_KEY) ?? null;
}
export function setProfileId(v: string) {
  ls()?.setItem(PROFILE_KEY, v);
}

// Full reset — used by "Switch profile" / a failed passcode.
export function clearIdentity() {
  ls()?.removeItem(PASSCODE_KEY);
  ls()?.removeItem(PROFILE_KEY);
}
