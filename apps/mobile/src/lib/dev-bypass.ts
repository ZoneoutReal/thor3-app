// Dev-only auth bypass for verifying the unlocked app without the real family
// passcode. Active ONLY when EXPO_PUBLIC_DEV_BYPASS=1 (set in the local .env,
// never in the EAS build env), so production / on-device builds always have it
// off. When on: pullAll() short-circuits to this mock snapshot and the root
// layout auto-seeds a test identity at boot. Test profiles are neutral names.

import type { Snapshot } from './sync';

export const DEV_BYPASS = process.env.EXPO_PUBLIC_DEV_BYPASS === '1';

export const DEV_PASSCODE = 'dev';
export const DEV_PROFILE_ID = 'test-alpha';

export const mockSnapshot: Snapshot = {
  profiles: [
    {
      id: 'test-alpha',
      display_name: 'Test Alpha',
      reminder_enabled: false,
      reminder_hour: 6,
      reminder_min: 0,
      tz: 'America/Chicago',
      sort: 0,
      activity_notify: true,
    },
    {
      id: 'test-bravo',
      display_name: 'Test Bravo',
      reminder_enabled: false,
      reminder_hour: 6,
      reminder_min: 0,
      tz: 'America/Chicago',
      sort: 1,
      activity_notify: true,
    },
  ],
  progress: [
    {
      profile: 'test-alpha',
      program: '10week',
      days: ['1-1', '1-2', '2-1', '2-3'],
      sets: [],
      // A couple of charted trends so Metrics has something to draw in dev.
      logs: {
        r1: { v: '18:30', m: 'run-2mi', w: 1 },
        r2: { v: '17:45', m: 'run-2mi', w: 2 },
        r3: { v: '17:05', m: 'run-2mi', w: 3 },
        p1: { v: '42', m: 'pushups', w: 1 },
        p2: { v: '48', m: 'pushups', w: 2 },
        p3: { v: '55', m: 'pushups', w: 3 },
        'session-dur-1-1': { v: '1980', m: 'session-duration', w: 1 },
      },
      updated_at: '2026-07-10T09:15:00.000Z',
    },
    { profile: 'test-bravo', program: '10week', days: ['1-1'], sets: [], logs: {}, updated_at: '2026-07-08T18:00:00.000Z' },
  ],
};
