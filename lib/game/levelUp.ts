// Level-up rule. Shared by the client and Convex (convex/ imports this file),
// so it must stay dependency-free.

/** First-try accuracy the last 3 boards must average to move up a level. */
export const LEVEL_UP_ACCURACY = 0.8;
/** Boards a reader must clear at a level before moving up. */
export const LEVEL_UP_MIN_BOARDS = 7;
// Accuracies are fractions like 21/30; their average can land a hair under the
// threshold in floating point (21/30 + 24/30 + 27/30 averages 0.7999999999999999).
// Anything this close to the threshold counts as meeting it.
export const ACCURACY_EPSILON = 1e-9;

/** Words on a board (6 rows of 5). */
export const BOARD_SIZE = 30;
/** Answers the server must have counted to accept a finished board. Two short
 * of a full board, so one lost save on a bad connection doesn't cost the board. */
export const MIN_BOARD_ANSWERS = BOARD_SIZE - 2;

export function checkLevelAdvancement(
  boardsClearedAtLevel: number,
  accuracyHistory: number[]
): boolean {
  if (boardsClearedAtLevel < LEVEL_UP_MIN_BOARDS) return false;
  const recent = accuracyHistory.slice(-3);
  if (recent.length < 3) return false;
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return avg >= LEVEL_UP_ACCURACY - ACCURACY_EPSILON;
}
