// A tiny "timer done" chime, synthesized in the browser (no audio asset, so it
// stays self-contained under the static export + CSP). iOS only lets audio play
// after the AudioContext has been resumed inside a user gesture, so call
// unlockAudio() from the tap that STARTS a timer; beep() then works when the
// timer later reaches zero (even though that fires from a setTimeout, the
// context stays resumed for the session).

type ACtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: ACtor; webkitAudioContext?: ACtor };
  const AC = w.AudioContext ?? w.webkitAudioContext;
  if (!AC) return null;
  try {
    if (!ctx) ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

// Resume the audio context on a user gesture (required on iOS). Cheap; safe to
// call on every timer-start tap.
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

// A short rising two-note chime so a finished timer is unmistakable.
export function beep() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = c.currentTime;
  const notes = [
    { f: 880, at: 0 }, // A5
    { f: 1320, at: 0.16 }, // E6
  ];
  for (const { f, at } of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    const start = now + at;
    // Quick attack then decay, so there's no click and it reads as a chime.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.28, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.17);
  }
}
