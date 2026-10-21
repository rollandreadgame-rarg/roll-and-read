// Curriculum sublevel order. Shared by the client and Convex (convex/ imports
// this file), so it must stay dependency-free. Must match the sublevels seeded
// in convex/wordData (25 total, 1A–5B).
export const LEVEL_SEQUENCE = [
  "1A", "1B", "1C", "1D", "1E", "1F", "1G", "1H",
  "2A", "2B", "2C", "2D", "2E", "2F", "2G", "2H",
  "3A", "3B", "3C", "3D",
  "4A", "4B", "4C",
  "5A", "5B",
] as const;

export type Level = typeof LEVEL_SEQUENCE[number];

export function isValidLevel(level: string): level is Level {
  return (LEVEL_SEQUENCE as readonly string[]).includes(level);
}

export function getNextLevel(currentLevel: string): string | null {
  const idx = LEVEL_SEQUENCE.indexOf(currentLevel as Level);
  if (idx === -1 || idx >= LEVEL_SEQUENCE.length - 1) return null;
  return LEVEL_SEQUENCE[idx + 1];
}

// Sublevels that existed only in an old, incorrect LEVEL_SEQUENCE (before
// 2026-10-21) and have no words. Readers who advanced into one are moved to
// the first real sublevel after where they were.
const RETIRED_LEVELS: Record<string, Level> = {
  "3E": "4A",
  "3F": "4A",
  "4D": "5A",
  "5C": "5B",
  "5D": "5B",
  "5E": "5B",
};

/** The valid level a stored level should be treated as (itself if valid). */
export function normalizeLevel(level: string): Level {
  if (isValidLevel(level)) return level;
  return RETIRED_LEVELS[level] ?? "1A";
}

/** The phonics skill each sublevel teaches, in plain words for parents. */
export const LEVEL_SKILLS: Record<Level, string> = {
  "1A": "Short a and i",
  "1B": "Short o, u and e",
  "1C": "ch, sh, th, wh and ff, ll, ss",
  "1D": "Blends with l",
  "1E": "Blends with r",
  "1F": "Blends with s, and spl, str, thr",
  "1G": "Ending blends like -mp, -nd, -st",
  "1H": "Silent e: a-e, i-e, o-e, u-e",
  "2A": "Vowel teams ai, ay",
  "2B": "Vowel teams ee, ea",
  "2C": "ar, or and open syllables",
  "2D": "er, ir, ur",
  "2E": "oa, oe, ow",
  "2F": "oo, ou, ow",
  "2G": "ang, ing, ank, ink, ck, tch",
  "2H": "-ed endings, qu, y as a vowel",
  "3A": "oi, oy, igh",
  "3B": "ie, ph, au, aw, short ea",
  "3C": "-tion and -sion",
  "3D": "Soft c and g, schwa, suffixes",
  "4A": "Consonant-le and -dge",
  "4B": "ew, ei, eigh, ue, ui, ey",
  "4C": "Prefixes and suffixes",
  "5A": "Silent letters: kn, wr, gn, mb",
  "5B": "Greek ch, -que, -gue, y as i",
};
