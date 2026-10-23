// Edge cases for the board generator beyond boardGenerator.test.ts.
import { describe, expect, test } from "vitest";
import {
  checkLevelAdvancement,
  generateBoard,
  LEVEL_UP_ACCURACY,
  LEVEL_UP_MIN_BOARDS,
  type GameBoard,
  type WordEntry,
} from "./boardGenerator";

function words(level: string, n: number, prefix = level, start = 0): WordEntry[] {
  return Array.from({ length: n }, (_, k) => {
    const i = k + start;
    return {
      _id: `${prefix}-${i}`,
      word: `${prefix.toLowerCase()}w${i}`,
      isNonsense: false,
      level,
      levelNumber: Number(level[0]),
      coinValue: 5,
      phonicFamily: "",
      phonicPattern: "",
    };
  });
}

function w(id: string, word: string, level = "2A"): WordEntry {
  return { _id: id, word, isNonsense: false, level, levelNumber: Number(level[0]), coinValue: 5, phonicFamily: "", phonicPattern: "" };
}

const all = (b: GameBoard) => b.rows.flatMap((r) => r.words);

function expectUnique(b: GameBoard) {
  const ws = all(b);
  expect(new Set(ws.map((x) => x._id)).size).toBe(ws.length);
  expect(new Set(ws.map((x) => x.word.toLowerCase())).size).toBe(ws.length);
}

describe("generateBoard edge cases", () => {
  test("all pools empty: 6 empty rows, dice 1–6, no crash", () => {
    const b = generateBoard({ currentLevel: "1A", boardsCleared: 0, wordPool: [], nextLevelPool: [] });
    expect(b.rows.map((r) => r.dieNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(all(b)).toHaveLength(0);
    expect(b.rows.every((r) => r.cleared === false)).toBe(true);
    expect(b.level).toBe("1A");
    expect(b.boardNumber).toBe(1);
  });

  test("boardNumber is boardsCleared + 1", () => {
    const b = generateBoard({ currentLevel: "2C", boardsCleared: 11, wordPool: words("2C", 40), nextLevelPool: [] });
    expect(b.boardNumber).toBe(12);
    expect(b.level).toBe("2C");
  });

  test("total supply under 30: uses every word once, never pads with repeats", () => {
    const b = generateBoard({
      currentLevel: "2A",
      boardsCleared: 0,
      wordPool: words("2A", 8),
      nextLevelPool: [],
      fillPool: words("2A", 5, "FILL"),
      reviewPool: words("1H", 4, "REV"),
    });
    expect(all(b)).toHaveLength(17);
    expectUnique(b);
    // Rows are filled in order of 5: 5,5,5,2,0,0
    expect(b.rows.map((r) => r.words.length)).toEqual([5, 5, 5, 2, 0, 0]);
  });

  test("exactly 30 words in the level is enough for a full board", () => {
    const b = generateBoard({ currentLevel: "1A", boardsCleared: 0, wordPool: words("1A", 30), nextLevelPool: [] });
    expect(all(b)).toHaveLength(30);
    expectUnique(b);
  });

  test("same spelling with different ids across pools appears once (case-insensitive)", () => {
    const b = generateBoard({
      currentLevel: "2A",
      boardsCleared: 6,
      wordPool: [w("a1", "rain"), w("a2", "Train"), ...words("2A", 40)],
      nextLevelPool: [w("b1", "RAIN", "2B"), w("b2", "train", "2B"), ...words("2B", 40)],
      reviewPool: [w("r1", "rain", "1H"), ...words("1H", 10, "REV")],
      practicePool: [w("p1", "Rain", "1G")],
      recentAccuracy: [1, 1, 1],
    });
    expectUnique(b);
    expect(all(b).filter((x) => x.word.toLowerCase() === "rain")).toHaveLength(1);
    expect(all(b)).toHaveLength(30);
  });

  test("same _id offered in several pools appears once", () => {
    const shared = w("shared", "boat", "2E");
    const b = generateBoard({
      currentLevel: "2E",
      boardsCleared: 0,
      wordPool: [shared, ...words("2E", 40)],
      nextLevelPool: [],
      reviewPool: [shared, ...words("2D", 10, "REV")],
      practicePool: [shared],
    });
    expect(all(b).filter((x) => x._id === "shared")).toHaveLength(1);
    expectUnique(b);
  });

  test("practice words that are also in the review pool: no duplicate cards, practice wins its 4 slots", () => {
    const practice = words("1G", 6, "PRA");
    const b = generateBoard({
      currentLevel: "2A",
      boardsCleared: 0,
      wordPool: words("2A", 50),
      nextLevelPool: [],
      reviewPool: [...practice, ...words("1H", 20, "REV")],
      practicePool: practice,
    });
    expectUnique(b);
    expect(all(b)).toHaveLength(30);
    // 4 practice slots + 6 review slots; review may legitimately re-pick the
    // remaining practice words, but never the same card twice.
    const fromPracticeOrReview = all(b).filter((x) => x._id.startsWith("PRA") || x._id.startsWith("REV"));
    expect(fromPracticeOrReview).toHaveLength(10);
    expect(all(b).filter((x) => x.level === "2A")).toHaveLength(20);
  });

  test("fewer than 4 practice words: review still capped at 6", () => {
    const b = generateBoard({
      currentLevel: "3A",
      boardsCleared: 0,
      wordPool: words("3A", 50),
      nextLevelPool: [],
      reviewPool: words("2H", 30, "REV"),
      practicePool: words("2G", 2, "PRA"),
    });
    expect(all(b).filter((x) => x._id.startsWith("PRA"))).toHaveLength(2);
    expect(all(b).filter((x) => x._id.startsWith("REV"))).toHaveLength(6);
    expect(all(b).filter((x) => x.level === "3A")).toHaveLength(22);
  });

  test("nonsense-only level pool is padded from fillPool before review and next level", () => {
    const b = generateBoard({
      currentLevel: "2A",
      boardsCleared: 0,
      wordPool: words("2A", 6, "NONS"),
      fillPool: words("2A", 40, "REAL"),
      nextLevelPool: words("2B", 40),
      reviewPool: words("1H", 40, "REV"),
    });
    expect(all(b)).toHaveLength(30);
    expect(all(b).filter((x) => x._id.startsWith("NONS"))).toHaveLength(6);
    expect(all(b).filter((x) => x._id.startsWith("REV"))).toHaveLength(6);
    expect(all(b).filter((x) => x._id.startsWith("REAL"))).toHaveLength(18);
    expect(all(b).filter((x) => x.level === "2B")).toHaveLength(0);
  });

  test("next-level blend grows 20% per board after board 4 and caps at 80% of the non-review slots", () => {
    const counts = [3, 4, 5, 6, 7, 8, 20].map((boardsCleared) => {
      const b = generateBoard({
        currentLevel: "2A",
        boardsCleared,
        wordPool: words("2A", 60),
        nextLevelPool: words("2B", 60),
        recentAccuracy: [1, 1, 1],
      });
      expectUnique(b);
      expect(all(b)).toHaveLength(30);
      return all(b).filter((x) => x.level === "2B").length;
    });
    expect(counts).toEqual([0, 6, 12, 18, 24, 24, 24]);
  });

  test("last level (no next pool) still fills 30 from the current level when blending would start", () => {
    const b = generateBoard({ currentLevel: "5B", boardsCleared: 10, wordPool: words("5B", 60), nextLevelPool: [], recentAccuracy: [1, 1, 1] });
    expect(all(b)).toHaveLength(30);
    expect(all(b).every((x) => x.level === "5B")).toBe(true);
  });

  test("blend threshold: exactly 70% average counts as doing well (floating-point safe)", () => {
    // 18/30, 21/30, 24/30 average exactly 0.7.
    const b = generateBoard({
      currentLevel: "2A",
      boardsCleared: 6,
      wordPool: words("2A", 60),
      nextLevelPool: words("2B", 60),
      recentAccuracy: [18 / 30, 21 / 30, 24 / 30],
    });
    expect(all(b).filter((x) => x.level === "2B").length).toBeGreaterThan(0);
  });

  test("does not mutate the input pools", () => {
    const pool = words("2A", 40);
    const snapshot = JSON.stringify(pool);
    generateBoard({ currentLevel: "2A", boardsCleared: 5, wordPool: pool, nextLevelPool: words("2B", 40) });
    expect(JSON.stringify(pool)).toBe(snapshot);
  });
});

describe("checkLevelAdvancement boundaries", () => {
  test("constants match the parent-facing copy (7 boards, 80%)", () => {
    expect(LEVEL_UP_MIN_BOARDS).toBe(7);
    expect(LEVEL_UP_ACCURACY).toBe(0.8);
  });

  test("6 boards is never enough, even with perfect accuracy", () => {
    expect(checkLevelAdvancement(6, [1, 1, 1, 1, 1, 1])).toBe(false);
  });

  test("exactly 7 boards at exactly 80% levels up", () => {
    expect(checkLevelAdvancement(7, [0.8, 0.8, 0.8])).toBe(true);
  });

  test("a hair under 80% does not", () => {
    expect(checkLevelAdvancement(7, [0.8, 0.8, 0.79])).toBe(false);
  });

  test("needs 3 boards of history", () => {
    expect(checkLevelAdvancement(7, [1, 1])).toBe(false);
    expect(checkLevelAdvancement(10, [])).toBe(false);
  });

  test("only the last 3 boards count", () => {
    expect(checkLevelAdvancement(9, [0, 0, 0.8, 0.8, 0.8])).toBe(true);
    expect(checkLevelAdvancement(9, [1, 1, 1, 0.5, 0.5, 0.5])).toBe(false);
  });

  // Real accuracies are first-try / answered fractions. Averages that are
  // exactly 80% in arithmetic land a hair under 0.8 in floating point.
  test.each([
    [21 / 30, 24 / 30, 27 / 30],
    [18 / 30, 24 / 30, 30 / 30],
    [22 / 30, 24 / 30, 26 / 30],
    [0.7, 0.8, 0.9],
  ])("averages that are exactly 80%% level up: %f, %f, %f", (a, b, c) => {
    expect(checkLevelAdvancement(7, [a, b, c])).toBe(true);
  });

  test("every 30-word triple averaging exactly 80% levels up", () => {
    for (let a = 0; a <= 30; a++) {
      for (let b = 0; b <= 30; b++) {
        const c = 72 - a - b; // a+b+c = 72 = 80% of 90
        if (c < 0 || c > 30) continue;
        expect(checkLevelAdvancement(7, [a / 30, b / 30, c / 30])).toBe(true);
        // And one word fewer never does.
        if (c > 0) expect(checkLevelAdvancement(7, [a / 30, b / 30, (c - 1) / 30])).toBe(false);
      }
    }
  });
});
