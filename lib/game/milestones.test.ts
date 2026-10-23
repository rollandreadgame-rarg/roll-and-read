import { describe, expect, test } from "vitest";
import { getMilestonesForBoard } from "./milestones";
import { sessionAccuracy } from "./accuracy";

const base = { totalBoardsCleared: 2, accuracy: 0.5, previousStreakDays: 1, newStreakDays: 1, isLevelUp: false };
const types = (args: Partial<typeof base>) => getMilestonesForBoard({ ...base, ...args }).map((m) => m.type);
const one = (args: Partial<typeof base>, type: string) =>
  getMilestonesForBoard({ ...base, ...args }).find((m) => m.type === type);

describe("getMilestonesForBoard", () => {
  test("an ordinary board triggers nothing", () => {
    expect(types({})).toEqual([]);
  });

  test("first board", () => {
    expect(one({ totalBoardsCleared: 1 }, "first-board")).toMatchObject({ rarity: "common" });
    expect(types({ totalBoardsCleared: 1 })).not.toContain("boards-multiple");
  });

  test.each([
    [5, "uncommon"],
    [10, "uncommon"],
    [20, "uncommon"],
    [25, "rare"],
    [45, "rare"],
    [50, "rare"],
    [95, "rare"],
    [100, "legendary"],
    [105, "legendary"],
  ])("every 5 boards: %i → %s", (n, rarity) => {
    const m = one({ totalBoardsCleared: n }, "boards-multiple");
    expect(m).toMatchObject({ rarity, label: `${n} boards cleared!` });
  });

  test.each([2, 3, 4, 6, 7, 99, 101])("%i boards is not a milestone", (n) => {
    expect(types({ totalBoardsCleared: n })).toEqual([]);
  });

  test("perfect accuracy tolerates floating point, but 29/30 is not perfect", () => {
    expect(types({ accuracy: 1 })).toContain("perfect-accuracy");
    expect(types({ accuracy: 0.99 })).toContain("perfect-accuracy");
    expect(types({ accuracy: 0.9999999999 })).toContain("perfect-accuracy");
    expect(types({ accuracy: 29 / 30 })).not.toContain("perfect-accuracy");
  });

  test.each([
    [2, 3, "streak-3"],
    [6, 7, "streak-7"],
    [29, 30, "streak-30"],
    [0, 3, "streak-3"],
  ])("streak %i → %i fires %s", (prev, next, type) => {
    expect(types({ previousStreakDays: prev, newStreakDays: next })).toEqual([type]);
  });

  test("only the highest streak milestone fires when several are crossed at once", () => {
    expect(types({ previousStreakDays: 0, newStreakDays: 30 })).toEqual(["streak-30"]);
    expect(types({ previousStreakDays: 2, newStreakDays: 8 })).toEqual(["streak-7"]);
  });

  test.each([
    [3, 3],
    [3, 4],
    [7, 8],
    [30, 31],
    [10, 1],
    [0, 0],
  ])("no streak milestone for %i → %i (already past it, same day, or reset)", (prev, next) => {
    expect(types({ previousStreakDays: prev, newStreakDays: next })).toEqual([]);
  });

  test("level up", () => {
    expect(one({ isLevelUp: true }, "level-up")).toMatchObject({ rarity: "rare" });
  });

  test("several milestones stack in a stable order", () => {
    expect(
      types({ totalBoardsCleared: 50, accuracy: 1, previousStreakDays: 6, newStreakDays: 7, isLevelUp: true })
    ).toEqual(["boards-multiple", "perfect-accuracy", "streak-7", "level-up"]);
  });

  test("every milestone has a non-empty label", () => {
    const all = getMilestonesForBoard({
      totalBoardsCleared: 1,
      accuracy: 1,
      previousStreakDays: 0,
      newStreakDays: 3,
      isLevelUp: true,
    });
    expect(all.length).toBe(4);
    for (const m of all) expect(m.label.length).toBeGreaterThan(0);
  });
});

describe("sessionAccuracy", () => {
  test("0 words answered is 0, not NaN or Infinity", () => {
    expect(sessionAccuracy({ firstAttemptCorrect: 0, wordsCorrect: 0 })).toBe(0);
    expect(sessionAccuracy({ firstAttemptCorrect: 0, wordsCorrect: 0, wordsSkipped: 0 })).toBe(0);
  });

  test("first-try correct over all answered words", () => {
    expect(sessionAccuracy({ firstAttemptCorrect: 24, wordsCorrect: 30, wordsSkipped: 0 })).toBe(0.8);
    expect(sessionAccuracy({ firstAttemptCorrect: 30, wordsCorrect: 30 })).toBe(1);
  });

  test("skipped words count against accuracy", () => {
    expect(sessionAccuracy({ firstAttemptCorrect: 20, wordsCorrect: 28, wordsSkipped: 2 })).toBeCloseTo(20 / 30);
  });

  test("a board where every word was skipped is 0", () => {
    expect(sessionAccuracy({ firstAttemptCorrect: 0, wordsCorrect: 0, wordsSkipped: 30 })).toBe(0);
  });

  test("old sessions without wordsSkipped still work", () => {
    expect(sessionAccuracy({ firstAttemptCorrect: 15, wordsCorrect: 30 })).toBe(0.5);
  });

  test("result stays within 0–1 for consistent data", () => {
    for (let correct = 0; correct <= 30; correct++) {
      for (let first = 0; first <= correct; first++) {
        const a = sessionAccuracy({ firstAttemptCorrect: first, wordsCorrect: correct, wordsSkipped: 30 - correct });
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });
});
