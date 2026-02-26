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
  nextLevelPool: WordEntry[];
}

export function generateBoard(config: BoardConfig): GameBoard {
  const { currentLevel, boardsCleared, wordPool, nextLevelPool } = config;

  // Blend ratio — after 4 boards, start introducing next level
  let nextRatio = 0;
  if (boardsCleared >= 4) {
    const blendBoard = boardsCleared - 3;
    nextRatio = Math.min(blendBoard * 0.2, 0.8);
  }
  const currentRatio = 1 - nextRatio;

  const totalNeeded = 30; // 6 rows × 5 words
  const currentTarget = Math.round(totalNeeded * currentRatio);
  const nextTarget = totalNeeded - currentTarget;

  // Build a deduplicated pool respecting blend ratio.
  // Each _id must appear at most once so clearing a word in one row
  // never removes it from another row.
  const seenIds = new Set<string>();
  const board30: WordEntry[] = [];

  for (const w of shuffle([...wordPool])) {
    if (board30.length >= currentTarget) break;
    if (!seenIds.has(w._id)) {
      seenIds.add(w._id);
      board30.push(w);
    }
  }

  for (const w of shuffle([...nextLevelPool])) {
    if (board30.length >= currentTarget + nextTarget) break;
    if (!seenIds.has(w._id)) {
      seenIds.add(w._id);
      board30.push(w);
    }
  }

  // Pad to 30 from wordPool if blend didn't fill the board
  for (const w of shuffle([...wordPool])) {
    if (board30.length >= totalNeeded) break;
    if (!seenIds.has(w._id)) {
      seenIds.add(w._id);
      board30.push(w);
    }
  }

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
