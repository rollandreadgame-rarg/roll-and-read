import { describe, expect, test } from "vitest";
import { parseSavedBoard, SAVED_BOARD_MAX_AGE_MS, type SavedBoard } from "./savedBoard";
import type { GameBoard, WordEntry } from "./boardGenerator";

const NOW = 1_800_000_000_000;
const expected = { level: "1A", wordMode: "real", now: NOW };

const word = (id: string): WordEntry => ({
  _id: id,
  word: id,
  isNonsense: false,
  level: "1A",
  levelNumber: 1,
  coinValue: 5,
  phonicFamily: "short-a",
  phonicPattern: "cvc",
});

function board(): GameBoard {
  return {
    level: "1A",
    boardNumber: 1,
    rows: [1, 2, 3, 4, 5, 6].map((d) => ({
      dieNumber: d,
      cleared: false,
      words: [1, 2, 3, 4, 5].map((i) => word(`w${d}${i}`)),
    })),
  };
}

function saved(over: Partial<SavedBoard> = {}): SavedBoard {
  return {
    v: 1,
    level: "1A",
    wordMode: "real",
    savedAt: NOW - 60_000,
    board: board(),
    clearedRows: [2],
    clearedWords: ["w21", "w22", "w23", "w24", "w25", "w31"],
    activeRow: 3,
    targetId: "w32",
    session: {
      wordsCorrect: 6,
      firstAttemptCorrect: 5,
      wordsAttempted: 8,
      wordsSkipped: 0,
      hintsUsed: 0,
      coinsEarned: 30,
      startTime: NOW - 120_000,
    },
    ...over,
  };
}

const raw = (s: unknown) => JSON.stringify(s);

describe("parseSavedBoard", () => {
  test("restores a board in progress with its row, target and session", () => {
    const s = parseSavedBoard(raw(saved()), expected)!;
    expect(s.activeRow).toBe(3);
    expect(s.targetId).toBe("w32");
    expect(s.clearedRows).toEqual([2]);
    expect(s.board.rows.find((r) => r.dieNumber === 2)!.cleared).toBe(true);
    expect(s.board.rows.find((r) => r.dieNumber === 3)!.cleared).toBe(false);
    expect(s.session.wordsCorrect).toBe(6);
  });

  test.each([
    ["nothing stored", null],
    ["corrupt JSON", "{not json"],
    ["JSON null", "null"],
    ["an array", "[]"],
    ["wrong version", raw(saved({ v: 2 as 1 }))],
  ])("%s gives a new board", (_name, value) => {
    expect(parseSavedBoard(value, expected)).toBeNull();
  });

  test("a different level or word mode gives a new board", () => {
    expect(parseSavedBoard(raw(saved({ level: "1B" })), expected)).toBeNull();
    expect(parseSavedBoard(raw(saved({ wordMode: "mixed" })), expected)).toBeNull();
  });

  test("a stale board, or one saved in the future, gives a new board", () => {
    expect(parseSavedBoard(raw(saved({ savedAt: NOW - SAVED_BOARD_MAX_AGE_MS - 1 })), expected)).toBeNull();
    expect(parseSavedBoard(raw(saved({ savedAt: NOW - SAVED_BOARD_MAX_AGE_MS })), expected)).not.toBeNull();
    expect(parseSavedBoard(raw(saved({ savedAt: NOW + 5_000 })), expected)).toBeNull();
  });

  test("a finished board gives a new board", () => {
    expect(parseSavedBoard(raw(saved({ clearedRows: [1, 2, 3, 4, 5, 6], activeRow: null })), expected)).toBeNull();
  });

  test("malformed boards give a new board", () => {
    const five = board();
    five.rows.pop();
    expect(parseSavedBoard(raw(saved({ board: five })), expected)).toBeNull();
    expect(parseSavedBoard(raw({ ...saved(), board: { rows: "x" } }), expected)).toBeNull();
    expect(parseSavedBoard(raw({ ...saved(), board: { rows: [1, 2, 3, 4, 5, 6] } }), expected)).toBeNull();
    expect(parseSavedBoard(raw({ ...saved(), clearedWords: "w11" }), expected)).toBeNull();
    expect(parseSavedBoard(raw({ ...saved(), session: undefined }), expected)).toBeNull();
  });

  test("unknown cleared rows and words are dropped; duplicates collapse", () => {
    const s = parseSavedBoard(raw(saved({ clearedRows: [2, 2, 9], clearedWords: ["w21", "nope"] })), expected)!;
    expect(s.clearedRows).toEqual([2]);
    expect(s.clearedWords).toEqual(["w21"]);
  });

  test("duplicate cleared rows cannot fake a finished board", () => {
    const s = parseSavedBoard(raw(saved({ clearedRows: [1, 1, 1, 1, 1, 1], activeRow: null })), expected);
    expect(s?.clearedRows).toEqual([1]);
  });

  test("a target that was already read moves to a word still on the row", () => {
    const s = parseSavedBoard(raw(saved({ targetId: "w31" })), expected)!;
    expect(s.activeRow).toBe(3);
    expect(s.targetId).not.toBe("w31");
    expect(["w32", "w33", "w34", "w35"]).toContain(s.targetId);
  });

  test("an active row that is cleared or empty goes back to rolling", () => {
    const cleared = parseSavedBoard(raw(saved({ activeRow: 2, targetId: "w21" })), expected)!;
    expect(cleared.activeRow).toBeNull();
    expect(cleared.targetId).toBeNull();
    const empty = parseSavedBoard(
      raw(saved({ clearedRows: [], clearedWords: ["w31", "w32", "w33", "w34", "w35"] })),
      expected
    )!;
    expect(empty.activeRow).toBeNull();
    const missing = parseSavedBoard(raw(saved({ activeRow: 9 })), expected)!;
    expect(missing.activeRow).toBeNull();
  });

  test("no active row restores to rolling", () => {
    const s = parseSavedBoard(raw(saved({ activeRow: null, targetId: null })), expected)!;
    expect(s.activeRow).toBeNull();
    expect(s.targetId).toBeNull();
  });
});
