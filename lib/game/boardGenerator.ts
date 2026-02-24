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

function getFoilWords(target: WordEntry, allWords: WordEntry[], count: number): WordEntry[] {
  const sameFamily = allWords.filter(
    (w) => w._id !== target._id && w.phonicFamily === target.phonicFamily
  );

  if (sameFamily.length >= count) {
    return shuffle(sameFamily).slice(0, count);
  }

  const different = allWords.filter(
    (w) => w._id !== target._id && !sameFamily.find((s) => s._id === w._id)
  );

  return [
    ...shuffle(sameFamily),
    ...shuffle(different).slice(0, count - sameFamily.length),
  ];
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
  const currentCount = Math.round(totalNeeded * currentRatio);
  const nextCount = totalNeeded - currentCount;

  const currentWords = shuffle(wordPool).slice(0, Math.min(currentCount, wordPool.length));
  const nextWords = shuffle(nextLevelPool).slice(0, Math.min(nextCount, nextLevelPool.length));

  // Pad if not enough words
  const allWords = shuffle([...currentWords, ...nextWords]);
  while (allWords.length < totalNeeded && wordPool.length > 0) {
    allWords.push(shuffle(wordPool)[0]);
  }

  const rows: GameRow[] = [];
  for (let i = 0; i < 6; i++) {
    const targetIndex = i * 5;
    if (targetIndex >= allWords.length) {
      // Fallback: use any available words
      const fallbackWords = shuffle(wordPool).slice(0, 5);
      rows.push({
        dieNumber: i + 1,
        words: fallbackWords,
        cleared: false,
      });
      continue;
    }

    const target = allWords[targetIndex];
    const poolForFoils = allWords.filter((_, idx) => idx !== targetIndex);
    const foils = getFoilWords(target, poolForFoils, 4);
    const rowWords = shuffle([target, ...foils]).slice(0, 5);

    rows.push({
      dieNumber: i + 1,
      words: rowWords,
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
