import { beforeEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { LEVEL_SEQUENCE, getReviewLevels } from "../lib/levels";
import { setup } from "./test.helpers";
import type { T } from "./test.helpers";

// 20 real + 10 silly words for every sublevel up to 2C.
const REAL = 20;
const SILLY = 10;
const SEEDED = LEVEL_SEQUENCE.slice(0, LEVEL_SEQUENCE.indexOf("2C") + 1);

let t: T;
beforeEach(async () => {
  t = setup();
  await t.run(async (ctx) => {
    for (const level of SEEDED) {
      for (let i = 0; i < REAL + SILLY; i++) {
        const isNonsense = i >= REAL;
        await ctx.db.insert("word_lists", {
          word: `${level.toLowerCase()}${isNonsense ? "silly" : "real"}${i}`,
          isNonsense,
          level,
          levelNumber: Number(level[0]),
          coinValue: 5,
          phonicFamily: "-x",
          phonicPattern: "test",
        });
      }
    }
  });
});

const pool = (level: string, wordMode: "real" | "nonsense" | "mixed", seed = 1) =>
  t.query(api.wordLists.getReviewPool, { level, wordMode, seed });

const countByLevel = (words: { level: string }[]) =>
  words.reduce<Record<string, number>>((acc, w) => {
    acc[w.level] = (acc[w.level] ?? 0) + 1;
    return acc;
  }, {});

describe("getReviewPool", () => {
  test("1A has nothing earlier to review", async () => {
    expect(await pool("1A", "mixed")).toEqual([]);
  });

  test("unknown or retired levels return an empty pool instead of throwing", async () => {
    expect(await pool("9Z", "mixed")).toEqual([]);
    expect(await pool("", "real")).toEqual([]);
  });

  test("1B reviews only 1A (15 words)", async () => {
    const words = await pool("1B", "mixed");
    expect(countByLevel(words)).toEqual({ "1A": 15 });
  });

  test("1C reviews 15 each from 1A and 1B", async () => {
    expect(countByLevel(await pool("1C", "mixed"))).toEqual({ "1A": 15, "1B": 15 });
  });

  test("1D adds one older level (8 words)", async () => {
    expect(countByLevel(await pool("1D", "mixed"))).toEqual({ "1A": 8, "1B": 15, "1C": 15 });
  });

  test("2C: 15 from each of the 2 previous sublevels + 8 from each of 3 older ones", async () => {
    for (const seed of [0, 1, 2, 7, 123456]) {
      const words = await pool("2C", "mixed", seed);
      const counts = countByLevel(words);
      const { recent, older } = getReviewLevels("2C", seed);
      expect(recent).toEqual(["2A", "2B"]);
      expect(counts["2A"]).toBe(15);
      expect(counts["2B"]).toBe(15);
      expect(older).toHaveLength(3);
      for (const level of older) expect(counts[level]).toBe(8);
      expect(words).toHaveLength(15 * 2 + 8 * 3);
      // Never the current level or anything above it.
      expect(Object.keys(counts)).not.toContain("2C");
    }
  });

  test("no duplicate words within a pool", async () => {
    const words = await pool("2C", "mixed", 5);
    expect(new Set(words.map((w) => w._id)).size).toBe(words.length);
  });

  test("'real' mode never returns silly words", async () => {
    const words = await pool("2C", "real", 3);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => !w.isNonsense)).toBe(true);
  });

  test("'nonsense' mode reviews a real+silly mix, same as 'mixed'", async () => {
    const silly = await pool("2C", "nonsense", 9);
    const mixed = await pool("2C", "mixed", 9);
    expect(silly.map((w) => w._id)).toEqual(mixed.map((w) => w._id));
    expect(silly.some((w) => !w.isNonsense)).toBe(true);
  });

  test("deterministic for the same seed, rotates with the seed", async () => {
    const a = await pool("2C", "mixed", 42);
    const b = await pool("2C", "mixed", 42);
    expect(a.map((w) => w._id)).toEqual(b.map((w) => w._id));
    const seeds = await Promise.all([1, 2, 3, 4, 5, 6].map((s) => pool("2C", "mixed", s)));
    const signatures = new Set(seeds.map((p) => p.map((w) => w._id).join()));
    expect(signatures.size).toBeGreaterThan(1);
  });

  test("short levels give what they have", async () => {
    await t.run(async (ctx) => {
      for (const w of await ctx.db
        .query("word_lists")
        .withIndex("by_level", (q) => q.eq("level", "1A"))
        .collect()) {
        if (!w.word.endsWith("0") && !w.word.endsWith("1")) await ctx.db.delete(w._id);
      }
    });
    const counts = countByLevel(await pool("1B", "mixed"));
    expect(counts["1A"]).toBeLessThan(15);
    expect(counts["1A"]).toBeGreaterThan(0);
  });

  test("odd seeds (negative, fractional, huge) still work", async () => {
    for (const seed of [-1, 0.5, Number.MAX_SAFE_INTEGER, 2 ** 40]) {
      const words = await pool("1D", "mixed", seed);
      expect(words).toHaveLength(15 * 2 + 8);
    }
  });
});

describe("getForLevel / getForLevels", () => {
  test("filters by word mode", async () => {
    const real = await t.query(api.wordLists.getForLevel, { level: "1A", wordMode: "real" });
    const silly = await t.query(api.wordLists.getForLevel, { level: "1A", wordMode: "nonsense" });
    const mixed = await t.query(api.wordLists.getForLevel, { level: "1A", wordMode: "mixed" });
    expect(real).toHaveLength(REAL);
    expect(silly).toHaveLength(SILLY);
    expect(mixed).toHaveLength(REAL + SILLY);
    expect(real.every((w) => !w.isNonsense && w.level === "1A")).toBe(true);
    expect(silly.every((w) => w.isNonsense)).toBe(true);
  });

  test("unknown level is empty", async () => {
    expect(await t.query(api.wordLists.getForLevel, { level: "zz", wordMode: "mixed" })).toEqual([]);
  });

  test("getForLevels concatenates the requested levels", async () => {
    const words = await t.query(api.wordLists.getForLevels, {
      levels: ["1A", "1B", "nope"],
      wordMode: "real",
    });
    expect(countByLevel(words)).toEqual({ "1A": REAL, "1B": REAL });
    expect(
      await t.query(api.wordLists.getForLevels, { levels: [], wordMode: "mixed" })
    ).toEqual([]);
  });
});
