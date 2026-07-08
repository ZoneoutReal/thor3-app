// Per-profile program choice + program start date. Stored on the device
// (localStorage), keyed by profile id so a shared phone that switches between
// the two brothers keeps each person's selection. Progress itself is keyed by
// (profile, program) in the DB, so switching program just reads/writes a
// different server row — no schema change needed here.
//
// Not yet synced to the server: "which program am I on" and "when did I start"
// are per-person settings that each device sets once. Promoting them to the
// profiles table (so they follow you across devices) is a future enhancement.

import type { Program } from "./program-data";

const PROGRAM_KEY = "thor3-program"; // -> `thor3-program-<profileId>`
const START_KEY = "thor3-start"; //    -> `thor3-start-<profileId>` (YYYY-MM-DD)

export const DEFAULT_PROGRAM = "10week";

function ls(): Storage | null {
  return typeof window !== "undefined" ? window.localStorage : null;
}

export function getProgramPref(profileId: string | null): string {
  if (!profileId) return DEFAULT_PROGRAM;
  return ls()?.getItem(`${PROGRAM_KEY}-${profileId}`) ?? DEFAULT_PROGRAM;
}

export function setProgramPref(profileId: string, programId: string) {
  ls()?.setItem(`${PROGRAM_KEY}-${profileId}`, programId);
}

// The calendar day (local) the person began week 1. Empty string clears it.
export function getStartDate(profileId: string | null): string | null {
  if (!profileId) return null;
  return ls()?.getItem(`${START_KEY}-${profileId}`) || null;
}

export function setStartDate(profileId: string, iso: string) {
  const v = iso.trim();
  if (v) ls()?.setItem(`${START_KEY}-${profileId}`, v);
  else ls()?.removeItem(`${START_KEY}-${profileId}`);
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
  if (!startISO) return null;
  const start = new Date(`${startISO}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysElapsed = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  if (daysElapsed < 0) return null; // starts in the future

  const lastIdx = program.data.length - 1;
  const weekIndex = Math.min(Math.max(0, Math.floor(daysElapsed / 7)), lastIdx);
  const weekNumber = program.data[weekIndex].week;
  const dayNumber = ((now.getDay() + 6) % 7) + 1; // JS Sun=0..Sat=6 -> Mon=1..Sun=7
  return { weekIndex, weekNumber, dayNumber, todayId: `${weekNumber}-${dayNumber}` };
}
