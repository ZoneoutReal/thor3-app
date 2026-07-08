export type WorkoutType = "run" | "strength" | "ruck" | "nic" | "rest" | "apft" | "walk" | "bike" | "mixed";

export interface WorkoutSession {
  label?: string;
  description: string[];
}

export interface DayWorkout {
  day: number;
  type: WorkoutType;
  sessions: WorkoutSession[];
}

export interface Week {
  week: number;
  days: DayWorkout[];
}

export interface Program {
  id: string;
  name: string;
  weeks: number;
  description: string;
  data: Week[];
}

const tenWeekData: Week[] = [
  {
    week: 1,
    days: [
      { day: 1, type: "apft", sessions: [{ description: ["APFT", "Push-ups: AMRAP in 2 minutes", "Sit-ups: AMRAP in 2 minutes", "Run: 2 miles for time"] }] },
      { day: 2, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 3, type: "run", sessions: [{ description: ["RUN:", "5 minute warm-up (easy)", "", "Run: 2 minutes", "Jog: 1 minute", "Repeat 4x", "", "5 minute cooldown (easy)"] }] },
      { day: 4, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 5, type: "run", sessions: [{ description: ["RUN: 5 mile time trial", "(As fast as possible)"] }] },
      { day: 6, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 2,
    days: [
      { day: 1, type: "run", sessions: [{ description: ["RUN:", "6 x 400 meters", "3 min rest between reps"] }] },
      { day: 2, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 3, type: "run", sessions: [{ description: ["RUN:", "5 minute warm-up (easy)", "", "Run: 3 minutes", "Jog: 1 minute", "Repeat 4x", "", "5 minute cooldown (easy)"] }] },
      { day: 4, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 5, type: "run", sessions: [{ description: ["RUN: 5 mile tempo", "(Run at a pace 60-90 seconds slower/mile than time trial pace)"] }] },
      { day: 6, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 3,
    days: [
      { day: 1, type: "run", sessions: [{ description: ["RUN:", "4 x 800 meters", "4 min rest between reps"] }] },
      { day: 2, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 3, type: "run", sessions: [{ description: ["RUN: 12 km time trial", "(As fast as possible)"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["NON-IMPACT CONDITIONING", "(Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "3 x 8 minutes", "Rest 5 minutes between sets"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 20% of bodyweight (dry)", "Distance: 5 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 4,
    days: [
      { day: 1, type: "run", sessions: [{ description: ["RUN:", "6 x 800 meters", "4 min rest between reps"] }] },
      { day: 2, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 3, type: "run", sessions: [{ description: ["RUN: 12 km tempo", "(Run at a pace 60-90 seconds slower/mile than time trial pace)"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["NON-IMPACT CONDITIONING", "(Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "3 x 10 minutes", "Rest 5 minutes between sets"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 25% of bodyweight (dry)", "Distance: 5 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 5,
    days: [
      { day: 1, type: "walk", sessions: [{ description: ["WALK: 2.5 miles"] }] },
      { day: 2, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 30% of bodyweight (dry)", "Distance: 2.5 miles", "Pace: Fast"] }] },
      { day: 3, type: "nic", sessions: [{ description: ["NON-IMPACT CONDITIONING (Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "5 x 5 minutes, rest 5 minutes between sets"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["RUN: 5 min warm-up (easy)", "", "1600 meters (hard)", "400 meter recovery jog", "1200 meters (hard)", "400 meter recovery jog", "800 meters (hard)", "400 meter recovery jog", "400 meters (hard)", "", "5 minute cooldown (easy)"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 30% of bodyweight (dry)", "Distance: 5 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 6,
    days: [
      { day: 1, type: "walk", sessions: [{ description: ["WALK: 4 miles"] }] },
      { day: 2, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 30% of bodyweight (dry)", "Distance: 4 miles", "Pace: Fast"] }] },
      { day: 3, type: "nic", sessions: [{ description: ["NON-IMPACT CONDITIONING (Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "5 x 8 minutes, rest 5 minutes between sets"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["RUN: 5 minute warm-up (easy)", "", "75 sec (hard)", "150 sec (easy)", "60 sec (hard)", "120 sec (easy)", "Repeat 3x", "", "5 minute cooldown (easy)"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 30% of bodyweight (dry)", "Distance: 8 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 7,
    days: [
      { day: 1, type: "walk", sessions: [{ description: ["WALK: 5 miles"] }] },
      { day: 2, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 35% of bodyweight (dry)", "Distance: 4 miles", "Pace: Fast"] }] },
      { day: 3, type: "nic", sessions: [{ description: ["NON-IMPACT CONDITIONING (Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "5 x 10 minutes, rest 5 minutes between sets"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["RUN: 5 minute warm-up (easy)", "", "5x", "1 minute (hard),", "1 minute (easy)", "", "5 minutes (easy)", "", "5x", "1 minute (hard),", "1 minute (easy)", "", "5 minute cool-down (easy)"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 35% of bodyweight (dry)", "Distance: 8 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 8,
    days: [
      { day: 1, type: "apft", sessions: [{ description: ["APFT", "Push-ups: AMRAP in 2 minutes", "Sit-ups: AMRAP in 2 minutes", "Run: 2 miles for time"] }] },
      { day: 2, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 35% of bodyweight (dry)", "Distance: 5 miles", "Pace: Fast"] }] },
      { day: 3, type: "nic", sessions: [{ description: ["NON-IMPACT CONDITIONING (Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "4 x 12 minutes, rest 5 minutes between sets"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["RUN: 20 minutes"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 35% of bodyweight (dry)", "Distance: 10 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 9,
    days: [
      { day: 1, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 2, type: "run", sessions: [{ description: ["RUN: 30 minutes (easy)"] }] },
      { day: 3, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 4, type: "bike", sessions: [{ description: ["BIKE:", "3 rounds x 10 minutes at threshold pace", "2 minutes rest between rounds"] }] },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 25% of bodyweight (dry)", "Distance: 5 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 10,
    days: [
      { day: 1, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 2, type: "run", sessions: [{ description: ["RUN: 20 minutes (easy)"] }] },
      { day: 3, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 4, type: "bike", sessions: [{ description: ["BIKE:", "3 rounds x 5 minutes at threshold pace", "2 minutes rest between rounds"] }] },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST", "", "*** WEEK 11: SELECTION ***"] }] },
    ],
  },
];

const fourteenWeekData: Week[] = [
  {
    week: 1,
    days: [
      { day: 1, type: "apft", sessions: [{ description: ["APFT", "Push-ups: AMRAP in 2 minutes", "Sit-ups: AMRAP in 2 minutes", "Run: 2 miles for time"] }] },
      { day: 2, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 3, type: "run", sessions: [{ description: ["RUN:", "5 minute warm-up (easy)", "", "Run: 2 minutes", "Jog: 1 minute", "Repeat 4x", "", "5 minute cooldown (easy)"] }] },
      { day: 4, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 5, type: "run", sessions: [{ description: ["RUN: 3 mile time trial", "(As fast as possible)"] }] },
      { day: 6, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 2,
    days: [
      { day: 1, type: "run", sessions: [{ description: ["RUN:", "4 x 400 meters", "3 min rest between reps"] }] },
      { day: 2, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 3, type: "run", sessions: [{ description: ["RUN:", "5 minute warm-up (easy)", "", "Run: 3 minutes", "Jog: 1 minute", "Repeat 4x", "", "5 minute cooldown (easy)"] }] },
      { day: 4, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 5, type: "run", sessions: [{ description: ["RUN: 3 mile tempo", "(Run at a pace 60-90 seconds slower/mile than time trial pace)"] }] },
      { day: 6, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 3,
    days: [
      { day: 1, type: "run", sessions: [{ description: ["RUN:", "6 x 400 meters", "3 min rest between reps"] }] },
      { day: 2, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 3, type: "run", sessions: [{ description: ["RUN:", "5 minute warm-up (easy)", "", "Run: 2 minutes", "Jog: 1 minute", "Repeat 6x", "", "5 minute cooldown (easy)"] }] },
      { day: 4, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 5, type: "run", sessions: [{ description: ["RUN: 5 mile time trial", "(As fast as possible)"] }] },
      { day: 6, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 4,
    days: [
      { day: 1, type: "run", sessions: [{ description: ["RUN:", "3 x 400 meters", "3 min rest between reps"] }] },
      { day: 2, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 3, type: "run", sessions: [{ description: ["RUN:", "5 minute warm-up (easy)", "", "Run: 3 minutes", "Jog: 1 minute", "Repeat 6x", "", "5 minute cooldown (easy)"] }] },
      { day: 4, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 5, type: "run", sessions: [{ description: ["RUN: 5 mile tempo", "(Run at a pace 60-90 seconds slower/mile than time trial pace)"] }] },
      { day: 6, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 5,
    days: [
      { day: 1, type: "run", sessions: [{ description: ["RUN:", "4 x 800 meters", "4 minutes between reps"] }] },
      { day: 2, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 3, type: "run", sessions: [{ description: ["RUN: 10 km time trial"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["NON-IMPACT CONDITIONING", "(Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "3 x 5 minutes", "Rest 5 minutes between sets"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 20% of bodyweight (dry)", "Distance: 3 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 6,
    days: [
      { day: 1, type: "run", sessions: [{ description: ["RUN:", "6 x 800 meters", "4 minutes between reps"] }] },
      { day: 2, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 3, type: "run", sessions: [{ description: ["RUN: 10 km tempo", "(Run at a pace 60-90 seconds slower/mile than time trial pace)"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["NON-IMPACT CONDITIONING", "(Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "3 x 8 minutes", "Rest 5 minutes between sets"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 20% of bodyweight (dry)", "Distance: 5 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 7,
    days: [
      { day: 1, type: "run", sessions: [{ description: ["RUN:", "8 x 800 meters", "4 minutes between reps"] }] },
      { day: 2, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 3, type: "run", sessions: [{ description: ["RUN: 12 km time trial", "(As fast as possible)"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["NON-IMPACT CONDITIONING", "(Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "3 x 12 minutes", "Rest 5 minutes between sets"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 25% of bodyweight (dry)", "Distance: 5 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 8,
    days: [
      { day: 1, type: "run", sessions: [{ description: ["RUN:", "5 x 800 meters", "4 minutes between reps"] }] },
      { day: 2, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 3, type: "run", sessions: [{ description: ["RUN: 12 km tempo", "(Run at a pace 60-90 seconds slower/mile than time trial pace)"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["NON-IMPACT CONDITIONING", "(Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "3 x 10 minutes", "Rest 5 minutes between sets"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 25% of bodyweight (dry)", "Distance: 7 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 9,
    days: [
      { day: 1, type: "walk", sessions: [{ description: ["WALK: 2 miles"] }] },
      { day: 2, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 30% of bodyweight (dry)", "Distance: 3.5 miles", "Pace: Fast"] }] },
      { day: 3, type: "nic", sessions: [{ description: ["NON-IMPACT CONDITIONING (Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "5 x 5 minutes, rest 5 minutes between sets"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["RUN: 5 min warm-up (easy)", "", "1600 meters (hard)", "400 meter recovery jog", "1200 meters (hard)", "400 meter recovery jog", "800 meters (hard)", "400 meter recovery jog", "400 meters (hard)", "", "5 minute cooldown (easy)"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 30% of bodyweight (dry)", "Distance: 7 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 10,
    days: [
      { day: 1, type: "walk", sessions: [{ description: ["WALK: 3 miles"] }] },
      { day: 2, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 30% of bodyweight (dry)", "Distance: 4 miles", "Pace: Fast"] }] },
      { day: 3, type: "nic", sessions: [{ description: ["NON-IMPACT CONDITIONING (Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "5 x 8 minutes, rest 5 minutes between sets"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["RUN: 5 minute warm-up (easy)", "", "75 sec (hard)", "150 sec (easy)", "60 sec (hard)", "120 sec (easy)", "Repeat 3x", "", "5 minute cooldown (easy)"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 30% of bodyweight (dry)", "Distance: 8 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 11,
    days: [
      { day: 1, type: "walk", sessions: [{ description: ["WALK: 4 miles"] }] },
      { day: 2, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 35% of bodyweight (dry)", "Distance: 4 miles", "Pace: Fast"] }] },
      { day: 3, type: "nic", sessions: [{ description: ["NON-IMPACT CONDITIONING (Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "5 x 12 minutes, rest 5 minutes between sets"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["RUN: 5 minute warm-up (easy)", "", "5x", "1 minute (hard),", "1 minute (easy)", "", "5 minutes (easy)", "", "5x", "1 minute (hard),", "1 minute (easy)", "", "5 minute cool-down (easy)"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 35% of bodyweight (dry)", "Distance: 8 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 12,
    days: [
      { day: 1, type: "apft", sessions: [{ description: ["APFT", "Push-ups: AMRAP in 2 minutes", "Sit-ups: AMRAP in 2 minutes", "Run: 2 miles for time"] }] },
      { day: 2, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 35% of bodyweight (dry)", "Distance: 5 miles", "Pace: Fast"] }] },
      { day: 3, type: "nic", sessions: [{ description: ["NON-IMPACT CONDITIONING (Rower, Jacobs Ladder, Versa Climber, Bike, etc):", "5 x 10 minutes, rest 5 minutes between sets"] }] },
      {
        day: 4,
        type: "mixed",
        sessions: [
          { label: "Session 1", description: ["RUN: 20 minutes"] },
          { label: "Session 2", description: ["STRENGTH TRAINING (see strength sheet)"] },
        ],
      },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 35% of bodyweight (dry)", "Distance: 10 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 13,
    days: [
      { day: 1, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 2, type: "run", sessions: [{ description: ["RUN: 30 minutes (easy)"] }] },
      { day: 3, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 4, type: "bike", sessions: [{ description: ["BIKE:", "3 rounds x 10 minutes at threshold pace", "2 minutes rest between rounds"] }] },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "ruck", sessions: [{ description: ["RUCK:", "Load: 25% of bodyweight (dry)", "Distance: 5 miles", "Pace: Moderate"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST"] }] },
    ],
  },
  {
    week: 14,
    days: [
      { day: 1, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 2, type: "run", sessions: [{ description: ["RUN: 20 minutes (easy)"] }] },
      { day: 3, type: "strength", sessions: [{ description: ["STRENGTH TRAINING (see strength sheet)"] }] },
      { day: 4, type: "bike", sessions: [{ description: ["BIKE:", "3 rounds x 5 minutes at threshold pace", "2 minutes rest between rounds"] }] },
      { day: 5, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 6, type: "rest", sessions: [{ description: ["REST"] }] },
      { day: 7, type: "rest", sessions: [{ description: ["REST", "", "*** WEEK 15: SELECTION ***"] }] },
    ],
  },
];

export const programs: Program[] = [
  {
    id: "10week",
    name: "10 Week Program",
    weeks: 10,
    description: "Accelerated SFAS preparation for candidates with an existing fitness base",
    data: tenWeekData,
  },
  {
    id: "14week",
    name: "14 Week Program",
    weeks: 14,
    description: "Full-length SFAS preparation with extended base-building phase",
    data: fourteenWeekData,
  },
];

export function getProgram(id: string): Program | undefined {
  return programs.find((p) => p.id === id);
}

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const TYPE_META: Record<WorkoutType, { label: string; color: string; icon: string }> = {
  run: { label: "Run", color: "#DC2626", icon: "\u{1F3C3}" },
  strength: { label: "Strength", color: "#2563EB", icon: "\u{1F4AA}" },
  ruck: { label: "Ruck", color: "#65A30D", icon: "\u{1F392}" },
  nic: { label: "NIC", color: "#7C3AED", icon: "\u{1F6A3}" },
  rest: { label: "Rest", color: "#6B7280", icon: "\u{1F4A4}" },
  apft: { label: "APFT", color: "#D97706", icon: "\u{1F3C5}" },
  walk: { label: "Walk", color: "#0891B2", icon: "\u{1F6B6}" },
  bike: { label: "Bike", color: "#059669", icon: "\u{1F6B4}" },
  mixed: { label: "Multi", color: "#BE185D", icon: "⚡" },
};

// --- Strength Sheet (the "attached sheet" referenced on strength days) ---

export interface StrengthRow {
  // Superset grouping letter (B/C/D/E...) mirrored from the source sheet; rows
  // that share a letter are performed as a superset before the group's rest.
  group?: string;
  name: string;
  // Full per-week prescription. A single string means "same every week in the
  // block"; an array holds one entry per week column (aligned to weekLabels).
  prescription: string | string[];
  rest?: string;
}

export interface StrengthDay {
  label: string; // "Day 1", "Day 2", "Day 3"
  title?: string; // e.g. "Work Capacity Circuit"
  kind: "table" | "ladder" | "circuit";
  note?: string;
  rounds?: string; // circuits only, display string e.g. "10 Rounds"
  roundsByWeek?: number[]; // circuits only, round count per week column
  rows?: StrengthRow[]; // table & circuit
  ladder?: string[][]; // ladder only: [step][weekIndex]
}

export interface StrengthBlock {
  title: string; // "Weeks 1-4"
  weeks: number[];
  weekLabels: string[];
  days: StrengthDay[];
}

// Performed over 10-15 yards before every strength day.
export interface WarmupMove {
  name: string;
  // Optional form cue shown as sub-text under the movement name.
  note?: string;
}

export const DYNAMIC_WARMUP: WarmupMove[] = [
  { name: "Walking Lunge w/ Twist" },
  { name: "Walking Lunge w/ Overhead Reach" },
  { name: "Lateral Lunge" },
  { name: "Walking Lunge > Elbow to Instep > Twisting Overhead Reach" },
  { name: "Knee Pull to Chest" },
  { name: "Heel Pull to Butt" },
  { name: "Leg Cradle" },
  { name: "Frankensteins" },
  { name: "Lateral Shuffle" },
  { name: "Carioca" },
  { name: "High Knee Run" },
  { name: "Power Skipping" },
  {
    name: "T, Y, W & L's x10 each",
    note:
      "Shoulder raises done face-down on a bench or bent at the hips, light or no weight. Your arms trace each letter to work the mid-back and rotator cuff. T: arms straight out to the sides, thumbs up. Y: arms overhead in a Y at about 45 degrees, thumbs up. W: elbows bent, pull the arms down and back and squeeze the shoulder blades. L: upper arms pinned to your sides, elbows at 90 degrees, rotate the forearms up and out.",
  },
];

export const strengthBlocks: StrengthBlock[] = [
  {
    title: "Weeks 1-4",
    weeks: [1, 2, 3, 4],
    weekLabels: ["W1", "W2", "W3", "W4"],
    days: [
      {
        label: "Day 1",
        kind: "table",
        rows: [
          { group: "B", name: "Front Squat", prescription: ["4x15", "4x12", "4x10", "4x8"] },
          { group: "B", name: "Lat Pulldown", prescription: ["4x15", "4x12", "4x10", "4x8"], rest: "1:30" },
          { group: "C", name: "Barbell Split Squat", prescription: ["3x12 ea", "3x12 ea", "3x10 ea", "3x10 ea"] },
          { group: "C", name: "Barbell Bent-Over Row", prescription: ["3x12", "3x12", "3x10", "3x10"] },
          { group: "C", name: "Seated Medball Side-to-Side Twists", prescription: "3x12 ea", rest: "1:00" },
          { group: "D", name: "Single Leg Piston Squats to Bench", prescription: "3x10 ea" },
          { group: "D", name: "Pull-Ups", prescription: "5+, 5+, MAX" },
          { group: "D", name: "Push-Ups", prescription: "20+, 20+, MAX", rest: "0:30" },
          { group: "E", name: "Back Extension", prescription: ["3x10", "3x12", "3x12", "3x15"] },
          { group: "E", name: "DB Combo Raise", prescription: "3x5" },
          { group: "E", name: "Planks (Front, Left, Right)", prescription: ["0:30", "0:40", "0:50", "1:00"], rest: "0:30" },
          { group: "F", name: "Foam Rolling & Stretching", prescription: "10:00" },
        ],
      },
      {
        label: "Day 2",
        kind: "table",
        rows: [
          { group: "B", name: "Kettlebell Deadlift", prescription: ["4x15", "4x12", "4x10", "4x8"] },
          { group: "B", name: "DB Flat Bench Press", prescription: ["4x15", "4x12", "4x10", "4x8"], rest: "1:30" },
          { group: "C", name: "Hamstring Curls", prescription: ["3x12", "3x12", "3x10", "3x10"] },
          { group: "C", name: "Single Arm DB Incline Bench Press", prescription: ["3x12 ea", "3x12 ea", "3x10 ea", "3x10 ea"] },
          { group: "C", name: "Standing Oblique DB Crunch", prescription: ["3x12 ea", "3x12 ea", "3x10 ea", "3x10 ea"], rest: "1:00" },
          { group: "D", name: "DB Single Arm Shoulder Press", prescription: "3x10 ea" },
          { group: "D", name: "Hanging Knee Tucks to Chest", prescription: "3x10" },
          { group: "D", name: "Glute Hip Bridges (w/ 3 sec holds)", prescription: "3x10", rest: "0:30" },
          { group: "E", name: "Sit-Ups", prescription: "20, 20, MAX" },
          { group: "E", name: "Chin-Ups", prescription: "10, 10, MAX" },
          { group: "E", name: "Dips", prescription: "10, 10, MAX", rest: "0:30" },
          { group: "F", name: "Foam Rolling & Stretching", prescription: "10:00" },
        ],
      },
      {
        label: "Day 3",
        title: "Work Capacity Circuit",
        kind: "ladder",
        note: "Rowing / Burpee Ladder. No rest between steps. Row the distance, then complete the burpees.",
        ladder: [
          ["100m / 1 burpee", "100m / 4 burpee", "500m / 5 burpee", "1000m / 10 burpee"],
          ["200m / 2 burpee", "200m / 4 burpee", "250m / 5 burpee", "900m / 9 burpee"],
          ["300m / 3 burpee", "300m / 4 burpee", "500m / 5 burpee", "800m / 8 burpee"],
          ["400m / 4 burpee", "400m / 4 burpee", "250m / 5 burpee", "700m / 7 burpee"],
          ["500m / 5 burpee", "500m / 4 burpee", "500m / 5 burpee", "600m / 6 burpee"],
          ["500m / 5 burpee", "500m / 4 burpee", "250m / 5 burpee", "500m / 5 burpee"],
          ["400m / 4 burpee", "400m / 4 burpee", "500m / 5 burpee", "400m / 4 burpee"],
          ["300m / 3 burpee", "300m / 4 burpee", "250m / 5 burpee", "300m / 3 burpee"],
          ["200m / 2 burpee", "200m / 4 burpee", "500m / 5 burpee", "200m / 2 burpee"],
          ["100m / 1 burpee", "100m / 4 burpee", "250m / 5 burpee", "100m / 1 burpee"],
        ],
      },
    ],
  },
  {
    title: "Weeks 5-8",
    weeks: [5, 6, 7, 8],
    weekLabels: ["W5", "W6", "W7", "W8"],
    days: [
      {
        label: "Day 1",
        kind: "table",
        rows: [
          { group: "B", name: "Back Squat", prescription: ["4x15", "4x12", "4x10", "4x8"] },
          { group: "B", name: "Squat Jump (bodyweight)", prescription: "4x5", rest: "1:30" },
          { group: "C", name: "Pull-Ups", prescription: "4x MAX" },
          { group: "C", name: "DB Step-Ups", prescription: ["4x12 ea", "4x10 ea", "4x10 ea", "4x8 ea"], rest: "1:00" },
          { group: "D", name: "Inverted Rows", prescription: ["10, 10, MAX", "12, 12, MAX", "12, 12, MAX", "15, 15, MAX"] },
          { group: "D", name: "Lunges", prescription: "3x8 ea" },
          { group: "D", name: "Push-Ups", prescription: "3x MAX", rest: "0:30" },
          { group: "E", name: "DB Single Arm Bent-Over Row", prescription: "3x10 ea" },
          { group: "E", name: "DB Shoulder Circuit", prescription: "3x10 ea" },
          { group: "E", name: "Planks (Front, Left, Right)", prescription: ["0:30 ea", "0:40 ea", "0:50 ea", "1:00 ea"], rest: "0:30" },
          { group: "F", name: "Foam Rolling & Stretching", prescription: "10:00" },
        ],
      },
      {
        label: "Day 2",
        kind: "table",
        rows: [
          { group: "B", name: "Deadlift", prescription: ["4x15", "4x12", "4x10", "4x8"] },
          { group: "B", name: "Medicine Ball Overhead Slam", prescription: ["4x8", "4x8", "4x10", "4x10"], rest: "1:30" },
          { group: "C", name: "Barbell or Dumbbell Bench Press", prescription: ["4x12", "4x10", "4x10", "4x8"] },
          { group: "C", name: "Plyometric Push-Up (clapping)", prescription: "4x5", rest: "1:00" },
          { group: "D", name: "Dumbbell Incline Bench", prescription: ["3x10", "3x12", "3x12", "3x15"] },
          { group: "D", name: "Glute-Ham Raises", prescription: ["3x10", "3x12", "3x12", "3x15"] },
          { group: "D", name: "Sit-Ups", prescription: "3x MAX", rest: "0:30" },
          { group: "E", name: "DB Shoulder Press", prescription: "3x10 ea" },
          { group: "E", name: "DB Lateral Lunges", prescription: "3x8 ea" },
          { group: "E", name: "Hanging Leg Lowers", prescription: "3x10" },
          { group: "E", name: "Dips", prescription: "3x MAX", rest: "0:30" },
          { group: "F", name: "Foam Rolling & Stretching", prescription: "10:00" },
        ],
      },
    ],
  },
  {
    title: "Weeks 9-10",
    weeks: [9, 10],
    weekLabels: ["W9", "W10"],
    days: [
      {
        label: "Day 1",
        title: "Dumbbell Circuit Day",
        kind: "circuit",
        rounds: "W9: 3 Rounds  ·  W10: 2 Rounds",
        roundsByWeek: [3, 2],
        note: "Use dumbbells that are 10% of your bodyweight in each hand. Rest 2-3 min between rounds.",
        rows: [
          { name: "DB Upright Row", prescription: "10" },
          { name: "DB Step-Ups", prescription: "10 ea" },
          { name: "DB Lateral Shoulder Raise", prescription: "10" },
          { name: "DB Alternate Push-Up / Row", prescription: "10" },
          { name: "DB Alternate Lunges", prescription: "10 ea" },
          { name: "DB Squats", prescription: "10" },
          { name: "DB Bent-Over Rows", prescription: "10" },
          { name: "DB Single Leg RDLs", prescription: "10 ea" },
          { name: "DB Lateral Step-Ups", prescription: "10 ea" },
          { name: "DB Alt. Curl to Press", prescription: "10 ea" },
          { name: "DB X-Over Step-Ups", prescription: "10 ea" },
          { name: "DB Overhead Tricep Extension", prescription: "10" },
          { name: "DB Lateral Lunges", prescription: "10 ea" },
          { group: "C", name: "Planks (Front, Left, Right)", prescription: "4 x 0:45 ea" },
          { group: "D", name: "Foam Rolling & Stretching", prescription: "10:00" },
        ],
      },
      {
        label: "Day 2",
        title: "Pull / Push / Sit Circuit",
        kind: "circuit",
        rounds: "10 Rounds",
        roundsByWeek: [10, 10],
        note: "No rest between exercises or rounds.",
        rows: [
          { name: "Pull-Ups", prescription: "3" },
          { name: "Push-Ups", prescription: "10" },
          { name: "Sit-Ups", prescription: "10" },
          { group: "C", name: "Foam Rolling & Stretching", prescription: "10:00" },
        ],
      },
    ],
  },
];

// Which strength block covers a given program week.
export function getStrengthBlockForWeek(week: number): StrengthBlock | undefined {
  return strengthBlocks.find((b) => b.weeks.includes(week));
}

// The prescription for one week column of a row (arrays hold one entry per week,
// a plain string is uniform across the block).
export function prescriptionForWeek(row: StrengthRow, weekIndex: number): string {
  return typeof row.prescription === "string"
    ? row.prescription
    : row.prescription[weekIndex] ?? "";
}

export interface ParsedSet {
  label: string; // target shown on the set row, e.g. "15", "12 ea", "MAX", "0:45"
  seconds?: number; // present when the target is a duration (timed set)
}

function durationToSeconds(s: string): number | undefined {
  const m = s.match(/(\d+):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : undefined;
}

// Expand a single per-week prescription into individual, loggable sets.
// `rounds`, when given (circuit exercises), overrides the set count.
export function parseStrengthSets(prescription: string, rounds?: number): ParsedSet[] {
  const p = prescription.trim();

  if (rounds && rounds > 0) {
    return Array.from({ length: rounds }, () => ({ label: p }));
  }

  // "Nx<target>" e.g. 4x15, 3x12 ea, 4x MAX, 4 x 0:45 ea
  const mult = p.match(/^(\d+)\s*x\s*(.+)$/i);
  if (mult) {
    const n = parseInt(mult[1], 10);
    const target = mult[2].trim();
    const seconds = durationToSeconds(target);
    return Array.from({ length: n }, () => ({ label: target, seconds }));
  }

  // comma list e.g. "5+, 5+, MAX" or "20, 20, MAX"
  if (p.includes(",")) {
    return p.split(",").map((t) => {
      const label = t.trim();
      return { label, seconds: durationToSeconds(label) };
    });
  }

  // single timed value e.g. "0:30", "10:00"
  const seconds = durationToSeconds(p);
  if (seconds != null) return [{ label: p, seconds }];

  return [{ label: p }];
}
