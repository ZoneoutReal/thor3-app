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
