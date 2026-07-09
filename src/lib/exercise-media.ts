// Public-domain exercise reference images, mapped from each strength exercise to
// a photo set. Source: yuhonas/free-exercise-db (The Unlicense / public domain),
// start + end frames. A few entries use the closest faithful movement when the
// exact variant isn't in the set (e.g. lateral step-ups -> step-ups). Images are
// bundled under public/exercise-img and served from the app origin (offline-safe).

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

type Entry = { slug: string; source: string; frames: number };

const MEDIA: Record<string, Entry> = {
  "Back Extension": { slug: "hyperextensions-back-extensions", source: "Hyperextensions (Back Extensions)", frames: 2 },
  "Back Squat": { slug: "barbell-full-squat", source: "Barbell Full Squat", frames: 2 },
  "Barbell Bent-Over Row": { slug: "bent-over-barbell-row", source: "Bent Over Barbell Row", frames: 2 },
  "Barbell Split Squat": { slug: "split-squats", source: "Split Squats", frames: 2 },
  "Barbell or Dumbbell Bench Press": { slug: "dumbbell-bench-press", source: "Dumbbell Bench Press", frames: 2 },
  "Chin-Ups": { slug: "chin-up", source: "Chin-Up", frames: 2 },
  "DB Alt. Curl to Press": { slug: "clean-and-press", source: "Clean and Press", frames: 2 },
  "DB Alternate Lunges": { slug: "dumbbell-lunges", source: "Dumbbell Lunges", frames: 2 },
  "DB Alternate Push-Up / Row": { slug: "alternating-renegade-row", source: "Alternating Renegade Row", frames: 2 },
  "DB Bent-Over Rows": { slug: "bent-over-two-dumbbell-row", source: "Bent Over Two-Dumbbell Row", frames: 2 },
  "DB Combo Raise": { slug: "front-dumbbell-raise", source: "Front Dumbbell Raise", frames: 2 },
  "DB Flat Bench Press": { slug: "dumbbell-bench-press", source: "Dumbbell Bench Press", frames: 2 },
  "DB Lateral Lunges": { slug: "dumbbell-rear-lunge", source: "Dumbbell Rear Lunge", frames: 2 },
  "DB Lateral Shoulder Raise": { slug: "side-lateral-raise", source: "Side Lateral Raise", frames: 2 },
  "DB Lateral Step-Ups": { slug: "dumbbell-step-ups", source: "Dumbbell Step Ups", frames: 2 },
  "DB Overhead Tricep Extension": { slug: "dumbbell-one-arm-triceps-extension", source: "Dumbbell One-Arm Triceps Extension", frames: 2 },
  "DB Shoulder Circuit": { slug: "dumbbell-shoulder-press", source: "Dumbbell Shoulder Press", frames: 2 },
  "DB Shoulder Press": { slug: "dumbbell-shoulder-press", source: "Dumbbell Shoulder Press", frames: 2 },
  "DB Single Arm Bent-Over Row": { slug: "one-arm-dumbbell-row", source: "One-Arm Dumbbell Row", frames: 2 },
  "DB Single Arm Shoulder Press": { slug: "dumbbell-one-arm-shoulder-press", source: "Dumbbell One-Arm Shoulder Press", frames: 2 },
  "DB Single Leg RDLs": { slug: "stiff-legged-dumbbell-deadlift", source: "Stiff-Legged Dumbbell Deadlift", frames: 2 },
  "DB Squats": { slug: "dumbbell-squat", source: "Dumbbell Squat", frames: 2 },
  "DB Step-Ups": { slug: "dumbbell-step-ups", source: "Dumbbell Step Ups", frames: 2 },
  "DB Upright Row": { slug: "standing-dumbbell-upright-row", source: "Standing Dumbbell Upright Row", frames: 2 },
  "DB X-Over Step-Ups": { slug: "dumbbell-step-ups", source: "Dumbbell Step Ups", frames: 2 },
  "Deadlift": { slug: "barbell-deadlift", source: "Barbell Deadlift", frames: 2 },
  "Dips": { slug: "dips-triceps-version", source: "Dips - Triceps Version", frames: 2 },
  "Dumbbell Incline Bench": { slug: "incline-dumbbell-press", source: "Incline Dumbbell Press", frames: 2 },
  "Front Squat": { slug: "front-barbell-squat", source: "Front Barbell Squat", frames: 2 },
  "Glute Hip Bridges (w/ 3 sec holds)": { slug: "butt-lift-bridge", source: "Butt Lift (Bridge)", frames: 2 },
  "Glute-Ham Raises": { slug: "glute-ham-raise", source: "Glute Ham Raise", frames: 2 },
  "Hamstring Curls": { slug: "lying-leg-curls", source: "Lying Leg Curls", frames: 2 },
  "Hanging Knee Tucks to Chest": { slug: "hanging-leg-raise", source: "Hanging Leg Raise", frames: 2 },
  "Hanging Leg Lowers": { slug: "hanging-leg-raise", source: "Hanging Leg Raise", frames: 2 },
  "Inverted Rows": { slug: "inverted-row", source: "Inverted Row", frames: 2 },
  "Kettlebell Deadlift": { slug: "kettlebell-one-legged-deadlift", source: "Kettlebell One-Legged Deadlift", frames: 2 },
  "Lat Pulldown": { slug: "wide-grip-lat-pulldown", source: "Wide-Grip Lat Pulldown", frames: 2 },
  "Lunges": { slug: "bodyweight-walking-lunge", source: "Bodyweight Walking Lunge", frames: 2 },
  "Medicine Ball Overhead Slam": { slug: "overhead-slam", source: "Overhead Slam", frames: 2 },
  "Planks (Front, Left, Right)": { slug: "plank", source: "Plank", frames: 2 },
  "Plyometric Push-Up (clapping)": { slug: "plyo-push-up", source: "Plyo Push-up", frames: 2 },
  "Pull-Ups": { slug: "pullups", source: "Pullups", frames: 2 },
  "Push-Ups": { slug: "pushups", source: "Pushups", frames: 2 },
  "Seated Medball Side-to-Side Twists": { slug: "russian-twist", source: "Russian Twist", frames: 2 },
  "Single Arm DB Incline Bench Press": { slug: "one-arm-dumbbell-bench-press", source: "One Arm Dumbbell Bench Press", frames: 2 },
  "Sit-Ups": { slug: "sit-up", source: "Sit-Up", frames: 2 },
  "Squat Jump (bodyweight)": { slug: "freehand-jump-squat", source: "Freehand Jump Squat", frames: 2 },
  "Standing Oblique DB Crunch": { slug: "dumbbell-side-bend", source: "Dumbbell Side Bend", frames: 2 },
};

export type ExerciseMedia = { images: string[]; source: string };

// Reference photos for a strength exercise (by its program name), or null if
// there's no faithful match.
export function getExerciseMedia(name: string): ExerciseMedia | null {
  const m = MEDIA[name];
  if (!m) return null;
  const images = Array.from({ length: m.frames }, (_, i) => `${BASE_PATH}/exercise-img/${m.slug}-${i}.jpg`);
  return { images, source: m.source };
}
