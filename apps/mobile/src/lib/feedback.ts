// Audio + haptic feedback cues for the workout timers. A short two-note beep
// (bundled WAV, via expo-audio) plus a haptic — mid-workout with the phone in a
// pocket both matter. Web plays the beep too; all calls are best-effort.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

let player: AudioPlayer | null = null;
let audioConfigured = false;

// Configure the iOS audio session once so the timer beep is audible with the
// hardware mute switch on, and can play while the app is backgrounded. Called at
// boot and on the first Start tap. Best-effort: unsupported on web / older runtimes.
export function configureAudio() {
  if (audioConfigured) return;
  audioConfigured = true;
  setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'mixWithOthers',
  }).catch(() => {});
}
function getPlayer(): AudioPlayer | null {
  if (player) return player;
  try {
    player = createAudioPlayer(require('../../assets/beep.wav'));
  } catch {
    player = null;
  }
  return player;
}

// Warm the audio player on a user gesture (the timer Start tap) so the first
// beep is instant. Historically the web app needed this to unlock audio.
export function unlockAudio() {
  configureAudio();
  getPlayer();
}

// Timer-finished cue: beep + a success haptic.
export function beep() {
  try {
    const p = getPlayer();
    if (p) {
      // seekTo returns a promise; keep a rejection from escaping the sync catch.
      Promise.resolve(p.seekTo(0)).catch(() => {});
      p.play();
    }
  } catch {
    /* best-effort */
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function vibrate(ms?: number) {
  const style =
    ms != null && ms < 250
      ? Haptics.ImpactFeedbackStyle.Light
      : ms != null && ms < 400
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy;
  Haptics.impactAsync(style).catch(() => {});
}
