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
