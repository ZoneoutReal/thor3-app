// Haptic feedback cues for the workout timers. A real audio beep (expo-audio)
// lands in Phase 3; mid-workout with the phone in a pocket the haptic is what
// actually registers, so the timers are wired to this now and gain sound later.
// Web (the verification harness) no-ops gracefully.

import * as Haptics from 'expo-haptics';

// The web app needed a user-gesture Web Audio unlock; native has nothing to unlock.
export function unlockAudio() {}

// Timer-finished cue.
export function beep() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function vibrate(_ms?: number) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}
