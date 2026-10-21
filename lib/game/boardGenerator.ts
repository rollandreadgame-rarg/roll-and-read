import { shuffle } from "@/lib/utils";

export interface WordEntry {
  _id: string;
  word: string;
  isNonsense: boolean;
  level: string;
  levelNumber: number;
  coinValue: number;
  phonicFamily: string;
  phonicPattern: string;
}

export interface GameRow {
  dieNumber: number;
  words: WordEntry[];
  cleared: boolean;
}

export interface GameBoard {
  rows: GameRow[];
  level: string;
  boardNumber: number;
}

export interface BoardConfig {
  currentLevel: string;
  boardsCleared: number;
  wordPool: WordEntry[];
  // Next sublevel's words — pass [] when the reader may not see them (their
  // plan doesn't include the next level, or this is the last level).
  nextLevelPool: WordEntry[];
  // Same-level words used to fill the board when wordPool is too small
  // (nonsense-only mode has ~5–13 words per sublevel; a board needs 30).
  fillPool?: WordEntry[];
  // Recent per-board accuracy (0–1). Next-level words are only blended in
  // while the reader is succeeding at the current level.
  recentAccuracy?: number[];
}

const BLEND_MIN_ACCURACY = 0.7;

export function generateBoard(config: BoardConfig): GameBoard {
  const { currentLevel, boardsCleared, wordPool, nextLevelPool, fillPool = [], recentAccuracy = [] } = config;

  // Blend ratio — after 4 boards, start introducing next level, but only for
  // a reader who's doing well (a struggling reader keeps practising this level).
  const recent = recentAccuracy.slice(-3);
  const doingWell =
    recent.length === 0 || recent.reduce((a, b) => a + b, 0) / recent.length >= BLEND_MIN_ACCURACY;
  let nextRatio = 0;
  if (boardsCleared >= 4 && doingWell) {
    const blendBoard = boardsCleared - 3;
    nextRatio = Math.min(blendBoard * 0.2, 0.8);
  }
  const currentRatio = 1 - nextRatio;

  const totalNeeded = 30; // 6 rows × 5 words
  const currentTarget = Math.round(totalNeeded * currentRatio);
  const nextTarget = totalNeeded - currentTarget;

  // Build a deduplicated pool respecting blend ratio. Each word (by _id AND
  // by spelling) appears at most once, so clearing a word in one row never
  // removes it from another, and the child never sees two identical cards.
  const seenIds = new Set<string>();
  const seenText = new Set<string>();
  const board30: WordEntry[] = [];
  const take = (pool: WordEntry[], limit: number) => {
    for (const w of shuffle([...pool])) {
      if (board30.length >= limit) break;
      const text = w.word.toLowerCase();
      if (!seenIds.has(w._id) && !seenText.has(text)) {
        seenIds.add(w._id);
        seenText.add(text);
        board30.push(w);
      }
    }
  };

  take(wordPool, currentTarget);
  take(nextLevelPool, currentTarget + nextTarget);
  // Pad to 30: this level first, then the fill pool (e.g. real words of the
  // same level in nonsense mode), then the next level as a last resort.
  take(wordPool, totalNeeded);
  take(fillPool, totalNeeded);
  take(nextLevelPool, totalNeeded);

  // Shuffle the final 30 unique words
  const shuffled = shuffle(board30);

  // Partition into 6 rows of 5 — each word appears exactly once on the board
  const rows: GameRow[] = [];
  for (let i = 0; i < 6; i++) {
    rows.push({
      dieNumber: i + 1,
      words: shuffled.slice(i * 5, (i + 1) * 5),
      cleared: false,
    });
  }

  return {
    rows,
    level: currentLevel,
    boardNumber: boardsCleared + 1,
  };
}

export function checkLevelAdvancement(
  boardsClearedAtLevel: number,
  accuracyHistory: number[]
): boolean {
  if (boardsClearedAtLevel < 7) return false;
  const recent = accuracyHistory.slice(-3);
  if (recent.length < 3) return false;
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return avg >= 0.7;
}
