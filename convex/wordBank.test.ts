import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { as, seedFamily, seedUser, seedWord, setup } from "./test.helpers";
import type { T } from "./test.helpers";

const bankRows = (t: T, profileId: Id<"profiles">) =>
  t.run((ctx) =>
    ctx.db.query("word_bank").withIndex("by_profile", (q) => q.eq("profileId", profileId)).collect()
  );

async function addWord(
  client: ReturnType<typeof as>,
  profileId: Id<"profiles">,
  wordId: Id<"word_lists">,
  extra: { needsPractice?: boolean; missesBeforeCorrect?: number; coinValue?: number } = {}
) {
  return await client.mutation(api.wordBank.addWord, {
    profileId,
    wordId,
    word: "cat",
    level: "1A",
    isNonsense: false,
    coinValue: extra.coinValue ?? 5,
    needsPractice: extra.needsPractice ?? false,
    ...(extra.missesBeforeCorrect === undefined
      ? {}
      : { missesBeforeCorrect: extra.missesBeforeCorrect }),
  });
}

async function seedBankEntry(
  t: T,
  profileId: Id<"profiles">,
  wordId: Id<"word_lists">,
  needsPractice: boolean,
  timesCorrect = 1
) {
  return await t.run(async (ctx) => {
    const w = (await ctx.db.get(wordId))!;
    return ctx.db.insert("word_bank", {
      profileId,
      wordId,
      word: w.word,
      level: w.level,
      isNonsense: w.isNonsense,
      coinValue: w.coinValue,
      needsPractice,
      firstEarned: 1,
      timesCorrect,
    });
  });
}

describe("addWord practice rules", () => {
  test.each([
    // [explicit needsPractice, misses, existing needsPractice, expected]
    [true, undefined, undefined, true],
    [true, 0, false, true],
    [false, undefined, undefined, false],
    [false, 0, true, false],
    [false, undefined, true, false],
    [false, 3, false, true],
    [false, 6, undefined, true],
    [false, 1, true, true],
    [false, 2, true, true],
    [false, 1, false, false],
    [false, 2, undefined, false],
  ] as const)(
    "needsPractice=%s misses=%s existing=%s → %s",
    async (needsPractice, misses, existing, expected) => {
      const t = setup();
      const a = await seedFamily(t, "user_a");
      const wordId = await seedWord(t, "cat", "1A");
      if (existing !== undefined) await seedBankEntry(t, a.profileId, wordId, existing);
      await addWord(a.client, a.profileId, wordId, {
        needsPractice,
        missesBeforeCorrect: misses,
      });
      const rows = await bankRows(t, a.profileId);
      expect(rows).toHaveLength(1);
      expect(rows[0].needsPractice).toBe(expected);
    }
  );

  test("re-adding a word updates the same row; skips are not counted as correct", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const wordId = await seedWord(t, "cat", "1A");
    const id1 = await addWord(a.client, a.profileId, wordId, { needsPractice: true });
    let [row] = await bankRows(t, a.profileId);
    expect(row.timesCorrect).toBe(0);

    const id2 = await addWord(a.client, a.profileId, wordId, { missesBeforeCorrect: 0 });
    const id3 = await addWord(a.client, a.profileId, wordId, { missesBeforeCorrect: 4 });
    expect(id2).toBe(id1);
    expect(id3).toBe(id1);
    const rows = await bankRows(t, a.profileId);
    expect(rows).toHaveLength(1);
    [row] = rows;
    expect(row.timesCorrect).toBe(2);
    expect(row.needsPractice).toBe(true);
  });

  test("first correct read is stored with timesCorrect 1", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const wordId = await seedWord(t, "cat", "1A");
    await addWord(a.client, a.profileId, wordId, { missesBeforeCorrect: 0 });
    const [row] = await bankRows(t, a.profileId);
    expect(row).toMatchObject({ timesCorrect: 1, needsPractice: false, word: "cat", level: "1A" });
  });

  // Regression: word text / level / coin value used to be copied from the
  // client, so a tampered call could bank a "cat" worth 1,000,000 coins (or a
  // 5B word for a 1A reader) and inflate the word-bank value shown to parents.
  test("stored word details come from the word list, not the client", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const wordId = await seedWord(t, "ship", "1C", false);
    await a.client.mutation(api.wordBank.addWord, {
      profileId: a.profileId,
      wordId,
      word: "something rude",
      level: "5B",
      isNonsense: true,
      coinValue: 1_000_000,
      needsPractice: false,
      missesBeforeCorrect: 0,
    });
    const [row] = await bankRows(t, a.profileId);
    expect(row).toMatchObject({ word: "ship", level: "1C", isNonsense: false, coinValue: 5 });
    expect(await a.client.query(api.wordBank.getTotalValue, { profileId: a.profileId })).toBe(5);
  });

  test("a word that no longer exists is not banked", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const wordId = await seedWord(t, "zap", "1A");
    await t.run((ctx) => ctx.db.delete(wordId));
    await addWord(a.client, a.profileId, wordId, { missesBeforeCorrect: 0 });
    expect(await bankRows(t, a.profileId)).toHaveLength(0);
  });

  test("cannot add words to someone else's reader", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    const wordId = await seedWord(t, "cat", "1A");
    await expect(addWord(as(t, "user_b"), a.profileId, wordId)).rejects.toThrow("Forbidden");
    await expect(addWord(as(t, "nobody"), a.profileId, wordId)).rejects.toThrow("User not found");
    expect(await bankRows(t, a.profileId)).toHaveLength(0);
  });
});

describe("reads are owner-only", () => {
  test("getForProfile / getTotalValue / getStats / getPracticeWords hide other readers", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    const wordId = await seedWord(t, "cat", "1A");
    await seedBankEntry(t, a.profileId, wordId, true, 1);
    for (const client of [t, as(t, "user_b")]) {
      expect(await client.query(api.wordBank.getForProfile, { profileId: a.profileId })).toEqual([]);
      expect(await client.query(api.wordBank.getTotalValue, { profileId: a.profileId })).toBe(0);
      expect(await client.query(api.wordBank.getStats, { profileId: a.profileId })).toEqual({
        count: 0,
        value: 0,
      });
      expect(
        await client.query(api.wordBank.getPracticeWords, { profileId: a.profileId })
      ).toEqual([]);
    }
    expect(await a.client.query(api.wordBank.getForProfile, { profileId: a.profileId })).toHaveLength(1);
  });

  test("value and count only include words read correctly at least once", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const read = await seedWord(t, "cat", "1A");
    const skipped = await seedWord(t, "drip", "1E");
    const later = await seedWord(t, "storm", "2C");
    await seedBankEntry(t, a.profileId, read, false, 3);
    await seedBankEntry(t, a.profileId, skipped, true, 0);
    await seedBankEntry(t, a.profileId, later, false, 1);
    expect(await a.client.query(api.wordBank.getTotalValue, { profileId: a.profileId })).toBe(13);
    expect(await a.client.query(api.wordBank.getStats, { profileId: a.profileId })).toEqual({
      count: 2,
      value: 13,
    });
  });
});

describe("getPracticeWords", () => {
  test("returns full word-list entries at or below the reader's level", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family", { currentLevel: "1C" });
    const below = await seedWord(t, "cat", "1A");
    const same = await seedWord(t, "ship", "1C");
    const above = await seedWord(t, "rain", "2A");
    const mastered = await seedWord(t, "dog", "1B");
    for (const w of [below, same, above]) await seedBankEntry(t, a.profileId, w, true);
    await seedBankEntry(t, a.profileId, mastered, false);
    const words = await a.client.query(api.wordBank.getPracticeWords, { profileId: a.profileId });
    expect(words.map((w) => w.word).sort()).toEqual(["cat", "ship"]);
    expect(words[0]).toHaveProperty("phonicPattern");
  });

  test("drops silly words for a real-words-only reader", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { currentLevel: "1B", wordMode: "real" });
    await seedBankEntry(t, a.profileId, await seedWord(t, "cat", "1A"), true);
    await seedBankEntry(t, a.profileId, await seedWord(t, "zib", "1A", true), true);
    const words = await a.client.query(api.wordBank.getPracticeWords, { profileId: a.profileId });
    expect(words.map((w) => w.word)).toEqual(["cat"]);
  });

  test("keeps silly words for mixed readers", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { currentLevel: "1B", wordMode: "mixed" });
    await seedBankEntry(t, a.profileId, await seedWord(t, "zib", "1A", true), true);
    const words = await a.client.query(api.wordBank.getPracticeWords, { profileId: a.profileId });
    expect(words.map((w) => w.word)).toEqual(["zib"]);
  });

  test("a reader on a retired sublevel is treated as its replacement level", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family", { currentLevel: "3E" });
    await seedBankEntry(t, a.profileId, await seedWord(t, "boil", "3A"), true);
    await seedBankEntry(t, a.profileId, await seedWord(t, "knee", "5A"), true);
    const words = await a.client.query(api.wordBank.getPracticeWords, { profileId: a.profileId });
    expect(words.map((w) => w.word)).toEqual(["boil"]);
  });

  test("skips practice rows whose word was deleted from the curriculum", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family", { currentLevel: "1B" });
    const gone = await seedWord(t, "gone", "1A");
    await seedBankEntry(t, a.profileId, gone, true);
    await t.run((ctx) => ctx.db.delete(gone));
    expect(
      await a.client.query(api.wordBank.getPracticeWords, { profileId: a.profileId })
    ).toEqual([]);
  });

  test("returns at most 40 words", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family", { currentLevel: "1A" });
    for (let i = 0; i < 45; i++) {
      await seedBankEntry(t, a.profileId, await seedWord(t, `w${i}`, "1A"), true);
    }
    const words = await a.client.query(api.wordBank.getPracticeWords, { profileId: a.profileId });
    expect(words).toHaveLength(40);
  });

  // Regression: the 40-row cap was applied BEFORE filtering by level/mode, so a
  // reader moved down a level (setLevel) or switched to real words could get
  // no practice words even though plenty were eligible.
  test("the 40 cap applies after filtering out ineligible words", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family", { currentLevel: "1A" });
    for (let i = 0; i < 45; i++) {
      await seedBankEntry(t, a.profileId, await seedWord(t, `hard${i}`, "2A"), true);
    }
    for (let i = 0; i < 5; i++) {
      await seedBankEntry(t, a.profileId, await seedWord(t, `easy${i}`, "1A"), true);
    }
    const words = await a.client.query(api.wordBank.getPracticeWords, { profileId: a.profileId });
    expect(words.map((w) => w.word).sort()).toEqual(["easy0", "easy1", "easy2", "easy3", "easy4"]);
  });
});

describe("markPracticed", () => {
  test("'Got it' clears practice and counts a correct read", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const id = await seedBankEntry(t, a.profileId, await seedWord(t, "cat", "1A"), true, 0);
    await a.client.mutation(api.wordBank.markPracticed, { wordBankId: id, stillNeedsPractice: false });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      needsPractice: false,
      timesCorrect: 1,
    });
  });

  test("'Still practising' keeps the flag and the count", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const id = await seedBankEntry(t, a.profileId, await seedWord(t, "cat", "1A"), true, 2);
    await a.client.mutation(api.wordBank.markPracticed, { wordBankId: id, stillNeedsPractice: true });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      needsPractice: true,
      timesCorrect: 2,
    });
  });

  test("cannot mark another reader's words; missing rows fail cleanly", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    const id = await seedBankEntry(t, a.profileId, await seedWord(t, "cat", "1A"), true, 0);
    await expect(
      as(t, "user_b").mutation(api.wordBank.markPracticed, {
        wordBankId: id,
        stillNeedsPractice: false,
      })
    ).rejects.toThrow("Forbidden");
    expect((await t.run((ctx) => ctx.db.get(id)))?.needsPractice).toBe(true);

    await t.run((ctx) => ctx.db.delete(id));
    await expect(
      a.client.mutation(api.wordBank.markPracticed, { wordBankId: id, stillNeedsPractice: false })
    ).rejects.toThrow("Word bank entry not found");
  });
});
