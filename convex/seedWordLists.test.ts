// Curriculum data integrity + the (internal) seed mutation.
// maintenance.runDataFixes keys words by their text, so a word that appears
// twice in WORD_DATA would make it delete one level's copy every run.
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { WORD_DATA } from "./seedWordLists";
import { LEVEL_SEQUENCE } from "../lib/levels";
import { setup } from "./test.helpers";

const COIN_BY_LEVEL: Record<string, number> = { "1": 5, "2": 8, "3": 12, "4": 18, "5": 25 };

describe("WORD_DATA", () => {
  test("every word is unique (case-insensitive)", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const w of WORD_DATA) {
      const k = w.word.toLowerCase();
      if (seen.has(k)) dupes.push(`${w.word} (${seen.get(k)} & ${w.level})`);
      seen.set(k, w.level);
    }
    expect(dupes).toEqual([]);
  });

  test("covers exactly the sublevels in LEVEL_SEQUENCE", () => {
    const levels = new Set(WORD_DATA.map((w) => w.level));
    expect([...levels].sort()).toEqual([...LEVEL_SEQUENCE].sort());
  });

  test.each([...LEVEL_SEQUENCE])("%s has enough real and silly words for a board", (level) => {
    const words = WORD_DATA.filter((w) => w.level === level);
    // A board is 30 unique words; a real-words-only reader needs them all real.
    expect(words.filter((w) => !w.isNonsense).length).toBeGreaterThanOrEqual(30);
    expect(words.filter((w) => w.isNonsense).length).toBeGreaterThan(0);
  });

  test("levelNumber and coin value match the level", () => {
    const bad = WORD_DATA.filter(
      (w) => w.levelNumber !== Number(w.level[0]) || w.coinValue !== COIN_BY_LEVEL[w.level[0]]
    );
    expect(bad).toEqual([]);
  });

  test("words are clean lowercase text (they become audio file names)", () => {
    const bad = WORD_DATA.filter((w) => !/^[a-z]+(['-][a-z]+)*$/.test(w.word));
    expect(bad.map((w) => w.word)).toEqual([]);
  });
});

describe("seedWordLists", () => {
  test("inserts everything once and is safe to re-run", async () => {
    const t = setup();
    const first = await t.mutation(internal.seedWordLists.seedWordLists, {});
    expect(first).toEqual({ inserted: WORD_DATA.length, skipped: 0, total: WORD_DATA.length });
    const second = await t.mutation(internal.seedWordLists.seedWordLists, {});
    expect(second).toEqual({ inserted: 0, skipped: WORD_DATA.length, total: WORD_DATA.length });
    expect(await t.run(async (ctx) => (await ctx.db.query("word_lists").collect()).length)).toBe(
      WORD_DATA.length
    );
  });
});
