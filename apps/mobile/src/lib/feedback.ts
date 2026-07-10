// Audio + haptic feedback cues for the workout timers. A short two-note beep
// (bundled WAV, via expo-audio) plus a haptic — mid-workout with the phone in a
// pocket both matter. Web plays the beep too; all calls are best-effort.

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

let player: AudioPlayer | null = null;
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
  getPlayer();
}

// Timer-finished cue: beep + a success haptic.
export function beep() {
  try {
    const p = getPlayer();
    if (p) {
      p.seekTo(0);
      p.play();
    }
  } catch {
    /* best-effort */
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function vibrate(_ms?: number) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}
