import { describe, expect, test } from "vitest";
import {
  LEVEL_SEQUENCE,
  LEVEL_SKILLS,
  getNextLevel,
  getReviewLevels,
  isValidLevel,
  levelIndex,
  normalizeLevel,
} from "./levels";
import { isLevelAllowed, PLANS } from "../convex/subscriptionConfig";

describe("LEVEL_SEQUENCE", () => {
  test("has the 25 curriculum sublevels 1A–5B in order with no duplicates", () => {
    expect(LEVEL_SEQUENCE).toHaveLength(25);
    expect(new Set(LEVEL_SEQUENCE).size).toBe(25);
    expect(LEVEL_SEQUENCE[0]).toBe("1A");
    expect(LEVEL_SEQUENCE[LEVEL_SEQUENCE.length - 1]).toBe("5B");
    // Level number never goes down, and letters run A, B, C... within a level.
    for (let i = 1; i < LEVEL_SEQUENCE.length; i++) {
      const [prev, cur] = [LEVEL_SEQUENCE[i - 1], LEVEL_SEQUENCE[i]];
      if (prev[0] === cur[0]) {
        expect(cur.charCodeAt(1) - prev.charCodeAt(1)).toBe(1);
      } else {
        expect(Number(cur[0])).toBe(Number(prev[0]) + 1);
        expect(cur[1]).toBe("A");
      }
    }
  });

  test("every sublevel has a parent-facing skill description and nothing extra", () => {
    expect(Object.keys(LEVEL_SKILLS).sort()).toEqual([...LEVEL_SEQUENCE].sort());
    for (const lvl of LEVEL_SEQUENCE) expect(LEVEL_SKILLS[lvl].trim().length).toBeGreaterThan(3);
  });
});

describe("isValidLevel / levelIndex / getNextLevel", () => {
  test.each(LEVEL_SEQUENCE.map((l, i) => [l, i] as const))("%s is valid at index %i", (lvl, i) => {
    expect(isValidLevel(lvl)).toBe(true);
    expect(levelIndex(lvl)).toBe(i);
  });

  test.each(["", "1a", " 1A", "1A ", "0A", "1I", "3E", "5C", "6A", "A1", "undefined"])(
    "%j is not a valid level",
    (lvl) => {
      expect(isValidLevel(lvl)).toBe(false);
      expect(levelIndex(lvl)).toBe(-1);
    }
  );

  test("next level crosses level boundaries and stops at the end", () => {
    expect(getNextLevel("1A")).toBe("1B");
    expect(getNextLevel("1H")).toBe("2A");
    expect(getNextLevel("2H")).toBe("3A");
    expect(getNextLevel("3D")).toBe("4A");
    expect(getNextLevel("4C")).toBe("5A");
    expect(getNextLevel("5B")).toBeNull();
    expect(getNextLevel("3E")).toBeNull();
    expect(getNextLevel("nope")).toBeNull();
  });
});

describe("normalizeLevel", () => {
  test("valid levels are returned unchanged", () => {
    for (const lvl of LEVEL_SEQUENCE) expect(normalizeLevel(lvl)).toBe(lvl);
  });

  test.each([
    ["3E", "4A"],
    ["3F", "4A"],
    ["4D", "5A"],
    ["5C", "5B"],
    ["5D", "5B"],
    ["5E", "5B"],
  ])("retired %s moves to %s (never backwards)", (retired, next) => {
    expect(normalizeLevel(retired)).toBe(next);
    // Retired sublevel sorted after everything before its replacement.
    const prevValid = LEVEL_SEQUENCE.filter((l) => l < retired).pop()!;
    expect(levelIndex(normalizeLevel(retired))).toBeGreaterThanOrEqual(levelIndex(prevValid));
  });

  test.each(["", "garbage", "1a", "9Z"])("unknown %j falls back to 1A", (lvl) => {
    expect(normalizeLevel(lvl)).toBe("1A");
  });
});

describe("getReviewLevels", () => {
  test("1A has nothing to review", () => {
    expect(getReviewLevels("1A", 1)).toEqual({ recent: [], older: [] });
  });

  test("1B reviews only 1A", () => {
    expect(getReviewLevels("1B", 7)).toEqual({ recent: ["1A"], older: [] });
  });

  test("1C reviews 1A and 1B as recent, nothing older", () => {
    expect(getReviewLevels("1C", 7)).toEqual({ recent: ["1A", "1B"], older: [] });
  });

  test("1D: recent = 1B,1C and the only older level is 1A", () => {
    expect(getReviewLevels("1D", 99)).toEqual({ recent: ["1B", "1C"], older: ["1A"] });
  });

  test("1E: older is both of 1A,1B (pool smaller than 3)", () => {
    const { recent, older } = getReviewLevels("1E", 3);
    expect(recent).toEqual(["1C", "1D"]);
    expect([...older].sort()).toEqual(["1A", "1B"]);
  });

  test.each(["", "3E", "5C", "zz"])("unknown/retired %j gives no review (callers must normalize first)", (lvl) => {
    expect(getReviewLevels(lvl, 1)).toEqual({ recent: [], older: [] });
  });

  test("for every level and many seeds: recent = last two, older ≤3 distinct strictly earlier levels", () => {
    for (const lvl of LEVEL_SEQUENCE) {
      const idx = levelIndex(lvl);
      for (let seed = 0; seed < 60; seed++) {
        const { recent, older } = getReviewLevels(lvl, seed);
        expect(recent).toEqual(LEVEL_SEQUENCE.slice(Math.max(0, idx - 2), idx));
        expect(older.length).toBe(Math.min(3, Math.max(0, idx - 2)));
        expect(new Set(older).size).toBe(older.length);
        for (const o of older) {
          expect(levelIndex(o)).toBeGreaterThanOrEqual(0);
          expect(levelIndex(o)).toBeLessThan(idx - 2); // never current, future, or a recent one
        }
      }
    }
  });

  test("is deterministic per seed (Convex queries must be)", () => {
    for (const seed of [0, 1, 42, 123456, 2 ** 31, Date.UTC(2026, 9, 23)]) {
      expect(getReviewLevels("5B", seed)).toEqual(getReviewLevels("5B", seed));
    }
  });

  test("different seeds rotate the older levels, and every older level (1A–4C for 5B) comes back eventually", () => {
    const sets = new Set<string>();
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const { older } = getReviewLevels("5B", seed);
      sets.add(older.join(","));
      older.forEach((o) => seen.add(o));
    }
    expect(sets.size).toBeGreaterThan(10);
    expect([...seen].sort()).toEqual(LEVEL_SEQUENCE.slice(0, 22).slice().sort());
  });

  test("odd seeds (negative, fractional, NaN, huge) still work", () => {
    for (const seed of [-1, -999999, 0.5, NaN, Number.MAX_SAFE_INTEGER, Infinity]) {
      const { recent, older } = getReviewLevels("4A", seed);
      expect(recent).toEqual(["3C", "3D"]);
      expect(older).toHaveLength(3);
      expect(older.every((o) => levelIndex(o) >= 0 && levelIndex(o) < levelIndex("3C"))).toBe(true);
    }
  });

  test("never mutates LEVEL_SEQUENCE", () => {
    const before = [...LEVEL_SEQUENCE];
    for (let s = 0; s < 20; s++) getReviewLevels("5B", s);
    expect([...LEVEL_SEQUENCE]).toEqual(before);
  });
});

describe("isLevelAllowed (plan gating)", () => {
  test("free plan is limited to level 1 (1A–1H)", () => {
    for (const lvl of LEVEL_SEQUENCE) {
      expect(isLevelAllowed("free", lvl)).toBe(lvl.startsWith("1"));
    }
  });

  test.each(["individual", "family", "classroom"] as const)("%s unlocks every level", (plan) => {
    for (const lvl of LEVEL_SEQUENCE) expect(isLevelAllowed(plan, lvl)).toBe(true);
  });

  test("plans list is the four tiers", () => {
    expect([...PLANS]).toEqual(["free", "individual", "family", "classroom"]);
  });
});
