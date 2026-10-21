// First-try accuracy of a saved game session, 0–1. Words skipped after 7
// misses count against it (they were answered, just not correctly).
export function sessionAccuracy(s: {
  firstAttemptCorrect: number;
  wordsCorrect: number;
  wordsSkipped?: number;
}): number {
  const answered = s.wordsCorrect + (s.wordsSkipped ?? 0);
  return answered > 0 ? s.firstAttemptCorrect / answered : 0;
}
