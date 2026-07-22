// Exercise reference photos. The PWA bundles ~84 public-domain JPEGs and maps 50
// strength-exercise names to them. Porting those bundled assets into the native
// app (a require() map) is a deferred polish item; until then this returns null
// and the strength cards simply omit the reference-image button. The type is kept
// so wiring the images back in later is a drop-in.

export type ExerciseMedia = { images: number[]; source: string };

export function getExerciseMedia(_name: string): ExerciseMedia | null {
  return null;
}
