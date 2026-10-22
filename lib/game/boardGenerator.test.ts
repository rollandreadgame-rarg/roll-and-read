// Run: npx tsx --test lib/game/boardGenerator.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateBoard, checkLevelAdvancement, type WordEntry } from "./boardGenerator";
import { getReviewLevels } from "../levels";

function words(level: string, n: number, prefix = level): WordEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    _id: `${prefix}-${i}`,
    word: `${prefix.toLowerCase()}w${i}`,
    isNonsense: false,
    level,
    levelNumber: Number(level[0]),
    coinValue: 5,
    phonicFamily: "",
    phonicPattern: "",
  }));
}

function boardWords(b: ReturnType<typeof generateBoard>) {
  return b.rows.flatMap((r) => r.words);
}

test("board always has 30 unique words in 6 rows of 5", () => {
  const b = generateBoard({
    currentLevel: "2A",
    boardsCleared: 5,
    wordPool: words("2A", 50),
    nextLevelPool: words("2B", 50),
    reviewPool: words("1H", 20),
    practicePool: words("1G", 6),
  });
  assert.equal(b.rows.length, 6);
  for (const r of b.rows) assert.equal(r.words.length, 5);
  const all = boardWords(b);
  assert.equal(new Set(all.map((w) => w._id)).size, 30);
  assert.equal(new Set(all.map((w) => w.word)).size, 30);
});

test("each board gets up to 4 practice words and 6 review words", () => {
  const b = generateBoard({
    currentLevel: "2A",
    boardsCleared: 0,
    wordPool: words("2A", 50),
    nextLevelPool: words("2B", 50),
    reviewPool: words("1H", 20, "REV"),
    practicePool: words("1G", 10, "PRA"),
  });
  const all = boardWords(b);
  assert.equal(all.filter((w) => w._id.startsWith("PRA")).length, 4);
  assert.equal(all.filter((w) => w._id.startsWith("REV")).length, 6);
  // No next-level words before 4 boards at a level.
  assert.equal(all.filter((w) => w.level === "2B").length, 0);
  assert.equal(all.filter((w) => w.level === "2A").length, 20);
});

test("a practice word that duplicates a level word is not shown twice", () => {
  const level = words("2A", 50);
  const b = generateBoard({
    currentLevel: "2A",
    boardsCleared: 0,
    wordPool: level,
    nextLevelPool: [],
    practicePool: level.slice(0, 3),
  });
  assert.equal(new Set(boardWords(b).map((w) => w._id)).size, 30);
});

test("first level (no review pool) still fills the board from the level", () => {
  const b = generateBoard({ currentLevel: "1A", boardsCleared: 0, wordPool: words("1A", 65), nextLevelPool: [] });
  assert.equal(boardWords(b).length, 30);
  assert.ok(boardWords(b).every((w) => w.level === "1A"));
});

test("small pools are padded with review words before next-level words", () => {
  const b = generateBoard({
    currentLevel: "2A",
    boardsCleared: 0,
    wordPool: words("2A", 10),
    nextLevelPool: words("2B", 40),
    reviewPool: words("1H", 40, "REV"),
  });
  const all = boardWords(b);
  assert.equal(all.length, 30);
  assert.equal(all.filter((w) => w.level === "2A").length, 10);
  assert.equal(all.filter((w) => w._id.startsWith("REV")).length, 20);
});

test("next-level blending still kicks in for a reader doing well", () => {
  const b = generateBoard({
    currentLevel: "2A",
    boardsCleared: 6,
    wordPool: words("2A", 50),
    nextLevelPool: words("2B", 50),
    reviewPool: words("1H", 20, "REV"),
    recentAccuracy: [0.9, 0.9, 0.9],
  });
  // 30 − 6 review = 24; board 7 → 60% next level → 14 next, 10 current.
  const all = boardWords(b);
  assert.equal(all.filter((w) => w.level === "2B").length, 14);
  assert.equal(all.filter((w) => w.level === "2A").length, 10);
});

test("struggling reader sees no next-level words", () => {
  const b = generateBoard({
    currentLevel: "2A",
    boardsCleared: 6,
    wordPool: words("2A", 50),
    nextLevelPool: words("2B", 50),
    recentAccuracy: [0.5, 0.6, 0.55],
  });
  assert.equal(boardWords(b).filter((w) => w.level === "2B").length, 0);
});

test("level-up needs 7 boards and an 80% average over the last 3", () => {
  assert.equal(checkLevelAdvancement(6, [1, 1, 1]), false);
  assert.equal(checkLevelAdvancement(7, [0.8, 0.8]), false);
  assert.equal(checkLevelAdvancement(7, [0.75, 0.8, 0.8]), false);
  assert.equal(checkLevelAdvancement(7, [0.8, 0.8, 0.8]), true);
  assert.equal(checkLevelAdvancement(9, [0.2, 0.9, 0.85, 0.8]), true);
});

test("review levels: two most recent plus up to three rotating older ones", () => {
  assert.deepEqual(getReviewLevels("1A", 0), { recent: [], older: [] });
  assert.deepEqual(getReviewLevels("1B", 0), { recent: ["1A"], older: [] });
  assert.deepEqual(getReviewLevels("1C", 3), { recent: ["1A", "1B"], older: [] });
  const r = getReviewLevels("3A", 7);
  assert.deepEqual(r.recent, ["2G", "2H"]);
  assert.equal(r.older.length, 3);
  assert.equal(new Set(r.older).size, 3);
  for (const l of r.older) assert.ok(!["2G", "2H", "3A"].includes(l));
  // Same seed → same pick (Convex queries must be deterministic).
  assert.deepEqual(getReviewLevels("3A", 7), r);
  // Over many seeds every older level comes up.
  const seen = new Set<string>();
  for (let s = 0; s < 200; s++) for (const l of getReviewLevels("5B", s).older) seen.add(l);
  assert.equal(seen.size, 22);
});
