// Per-profile program choice + program start date. Stored on the device (the
// local store, mirrored to AsyncStorage), keyed by profile id so a shared phone
// that switches between the two brothers keeps each person's selection. Progress
// itself is keyed by (profile, program) in the DB, so switching program just
// reads/writes a different server row — no schema change needed here.

import type { Program } from './program-data';
import { getItem, removeItem, setItem } from './store';

const PROGRAM_KEY = 'thor3-program'; // -> `thor3-program-<profileId>`
const START_KEY = 'thor3-start'; //    -> `thor3-start-<profileId>` (YYYY-MM-DD)
const REST_KEY = 'thor3-rest'; //      -> `thor3-rest-<profileId>` (seconds; 0 = program default)

export const DEFAULT_PROGRAM = '10week';

export function getProgramPref(profileId: string | null): string {
  if (!profileId) return DEFAULT_PROGRAM;
  return getItem(`${PROGRAM_KEY}-${profileId}`) ?? DEFAULT_PROGRAM;
}

export function setProgramPref(profileId: string, programId: string) {
  setItem(`${PROGRAM_KEY}-${profileId}`, programId);
}

// Preferred rest-timer length between sets, in seconds. 0 means "use the
// program's prescribed rests" (the default). A non-zero value is the person's
// own fixed break, applied after every set they complete.
export function getRestPref(profileId: string | null): number {
  if (!profileId) return 0;
  const raw = getItem(`${REST_KEY}-${profileId}`);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function setRestPref(profileId: string, seconds: number) {
  if (seconds > 0) setItem(`${REST_KEY}-${profileId}`, String(seconds));
  else removeItem(`${REST_KEY}-${profileId}`);
}

// The calendar day (local) the person began week 1. Empty string clears it.
export function getStartDate(profileId: string | null): string | null {
  if (!profileId) return null;
  return getItem(`${START_KEY}-${profileId}`) || null;
}

export function setStartDate(profileId: string, iso: string) {
  const v = iso.trim();
  if (v) setItem(`${START_KEY}-${profileId}`, v);
  else removeItem(`${START_KEY}-${profileId}`);
}

export interface ProgramPosition {
  weekIndex: number; //  index into program.data (what the week selector uses)
  weekNumber: number; // display week number (program.data[weekIndex].week)
  dayNumber: number; //  today's weekday, 1..7 = Mon..Sun (matches DayWorkout.day)
  todayId: string; //    `${weekNumber}-${dayNumber}` for highlighting today's card
}

// Where the person is in their program *today*, from their start date.
// Returns null if no start date is set or the program hasn't begun yet.
export function currentPosition(program: Program, startISO: string | null): ProgramPosition | null {
  if (!startISO || !program.data.length) return null;
  const start = new Date(`${startISO}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today.getTime() < start.getTime()) return null; // starts in the future

  // The program is weekday-locked (Mon..Sun). Anchor week boundaries to the
  // Monday of the start week so the week index and the calendar weekday stay
  // consistent even when the start date isn't a Monday. Round (not floor) the day
  // span so a DST transition doesn't shave a day and roll the week over early.
  const startDow = (start.getDay() + 6) % 7; // Mon=0..Sun=6
  const monday = new Date(start.getFullYear(), start.getMonth(), start.getDate() - startDow);
  const daysElapsed = Math.round((today.getTime() - monday.getTime()) / 86_400_000);

  const lastIdx = program.data.length - 1;
  const weekIndex = Math.min(Math.max(0, Math.floor(daysElapsed / 7)), lastIdx);
  const weekNumber = program.data[weekIndex].week;
  const dayNumber = ((now.getDay() + 6) % 7) + 1; // JS Sun=0..Sat=6 -> Mon=1..Sun=7
  return { weekIndex, weekNumber, dayNumber, todayId: `${weekNumber}-${dayNumber}` };
}
