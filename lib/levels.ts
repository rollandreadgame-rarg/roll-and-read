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

/** Position of a sublevel in the curriculum (-1 if unknown). */
export function levelIndex(level: string): number {
  return LEVEL_SEQUENCE.indexOf(level as Level);
}

// Small seeded PRNG so a Convex query (which must be deterministic) can still
// vary which older levels it reviews from board to board.
function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Earlier sublevels to draw review words from: the two just before this one
 * (most review), plus up to three older ones picked by `seed` so every older
 * pattern keeps coming back over time.
 */
export function getReviewLevels(level: string, seed: number): { recent: Level[]; older: Level[] } {
  const idx = levelIndex(level);
  if (idx <= 0) return { recent: [], older: [] };
  const earlier = LEVEL_SEQUENCE.slice(0, idx);
  const recent = earlier.slice(-2);
  const pool = earlier.slice(0, -2);
  const rand = seededRandom(seed);
  const older: Level[] = [];
  while (older.length < 3 && pool.length > 0) {
    older.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return { recent, older };
}

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
