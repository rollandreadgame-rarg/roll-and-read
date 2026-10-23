import type { GameBoard } from "./boardGenerator";

// A board in progress, kept per reader on this device so a reload or a trip to
// another page picks up where the reader left off. Coins and words are saved on
// the server as they happen; this only restores the reader's place.
export interface SavedBoard {
  v: 1;
  level: string;
  wordMode: string;
  savedAt: number;
  board: GameBoard;
  clearedRows: number[];
  clearedWords: string[];
  activeRow: number | null;
  targetId: string | null;
  session: {
    wordsCorrect: number;
    firstAttemptCorrect: number;
    wordsAttempted: number;
    wordsSkipped: number;
    hintsUsed: number;
    coinsEarned: number;
    startTime: number;
  };
}

// An unfinished board older than this is dealt fresh instead.
export const SAVED_BOARD_MAX_AGE_MS = 12 * 60 * 60_000;

export const savedBoardKey = (profileId: string) => `rr:board:${profileId}`;

/**
 * Parses a stored board and returns it only if it still fits the reader:
 * same level and word mode, not stale, well-formed, and not already finished.
 * Anything else returns null and the caller deals a new board.
 */
export function parseSavedBoard(
  raw: string | null,
  expected: { level: string; wordMode: string; now: number }
): SavedBoard | null {
  if (!raw) return null;
  let s: SavedBoard;
  try {
    s = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!s || s.v !== 1 || typeof s.savedAt !== "number") return null;
  if (s.level !== expected.level || s.wordMode !== expected.wordMode) return null;
  if (s.savedAt > expected.now || expected.now - s.savedAt > SAVED_BOARD_MAX_AGE_MS) return null;
  const rows = s.board?.rows;
  if (!Array.isArray(rows) || rows.length !== 6) return null;
  if (!rows.every((r) => typeof r?.dieNumber === "number" && Array.isArray(r.words))) return null;
  if (!Array.isArray(s.clearedRows) || !Array.isArray(s.clearedWords) || !s.session) return null;

  const dice = new Set(rows.map((r) => r.dieNumber));
  const clearedRows = [...new Set(s.clearedRows)].filter((n) => dice.has(n));
  if (clearedRows.length >= 6) return null;
  const ids = new Set(rows.flatMap((r) => r.words.map((w) => w._id)));
  const clearedWords = s.clearedWords.filter((id) => ids.has(id));

  // The active row and target must still be playable, or the reader rolls again.
  let activeRow = s.activeRow;
  let targetId = s.targetId;
  const row = rows.find((r) => r.dieNumber === activeRow);
  const left = row?.words.filter((w) => !clearedWords.includes(w._id)) ?? [];
  if (!row || clearedRows.includes(row.dieNumber) || left.length === 0) {
    activeRow = null;
    targetId = null;
  } else if (!left.some((w) => w._id === targetId)) {
    targetId = left[0]._id;
  }

  return {
    ...s,
    board: { ...s.board, rows: rows.map((r) => ({ ...r, cleared: clearedRows.includes(r.dieNumber) })) },
    clearedRows,
    clearedWords,
    activeRow,
    targetId,
  };
}
