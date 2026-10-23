import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { WORD_DATA } from "./seedWordLists";
import {
  TEST_MAINTENANCE_SECRET,
  TEST_SYNC_SECRET,
  as,
  installFakeTrustedSecrets,
  seedFamily,
  seedSticker,
  seedWord,
  setup,
} from "./test.helpers";
import type { T } from "./test.helpers";
import type { Id } from "./_generated/dataModel";

afterEach(() => vi.restoreAllMocks());

const counts = (t: T) =>
  t.run(async (ctx) => ({
    words: (await ctx.db.query("word_lists").collect()).length,
    bank: (await ctx.db.query("word_bank").collect()).length,
  }));

async function bank(t: T, profileId: Id<"profiles">, wordId: Id<"word_lists">) {
  return await t.run(async (ctx) => {
    const w = (await ctx.db.get(wordId))!;
    return ctx.db.insert("word_bank", {
      profileId,
      wordId,
      word: w.word,
      level: w.level,
      isNonsense: w.isNonsense,
      coinValue: w.coinValue,
      needsPractice: false,
      firstEarned: 1,
      timesCorrect: 1,
    });
  });
}

describe("runDataFixes access", () => {
  test("refuses missing / wrong / sync-secret keys, for anonymous and signed-in callers", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const a = await seedFamily(t, "user_a", "family", { currentLevel: "3E" });
    const keys = ["", "wrong", TEST_SYNC_SECRET];
    for (const client of [t, as(t, "user_a")]) {
      for (const maintenanceSecret of keys) {
        await expect(
          client.mutation(api.maintenance.runDataFixes, { maintenanceSecret, dryRun: false })
        ).rejects.toThrow("Forbidden");
      }
    }
    expect(await counts(t)).toEqual({ words: 0, bank: 0 });
    expect((await t.run((ctx) => ctx.db.get(a.profileId)))?.currentLevel).toBe("3E");
  });
});

describe("runDataFixes behaviour (with a fake test key)", () => {
  test("dry run reports but writes nothing", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const a = await seedFamily(t, "user_a", "family", { currentLevel: "5D" });
    await seedSticker(t, "Adventure And Travel_classic Soccer Ball Kick");
    const r = await t.mutation(api.maintenance.runDataFixes, {
      maintenanceSecret: TEST_MAINTENANCE_SECRET,
      dryRun: true,
    });
    expect(r.words.inserted).toHaveLength(WORD_DATA.length);
    expect(r.levels).toHaveLength(1);
    expect(r.stickers).toHaveLength(1);
    expect(await counts(t)).toEqual({ words: 0, bank: 0 });
    expect((await t.run((ctx) => ctx.db.get(a.profileId)))?.currentLevel).toBe("5D");
  });

  test("syncs words, moves stranded readers, cleans sticker names — and is idempotent", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const a = await seedFamily(t, "user_a", "family", {
      currentLevel: "3F",
      boardsClearedAtLevel: 4,
      accuracyHistory: [1],
    });
    const fine = await seedFamily(t, "user_b", "family", { currentLevel: "2B" });
    const sticker = await seedSticker(t, "With Fish");
    await t.run((ctx) => ctx.db.patch(sticker, { subcategory: "CAT" }));

    // A real curriculum word stored at the wrong level with a stale coin value,
    // a duplicate row of it, and a word that is no longer in the curriculum.
    const real = WORD_DATA.find((w) => w.level === "2A")!;
    const wrong = await seedWord(t, real.word, "1A");
    const dup = await seedWord(t, real.word, "1B");
    const retired = await seedWord(t, "notarealcurriculumword", "1A");
    await bank(t, a.profileId, wrong);
    await bank(t, fine.profileId, dup);
    await bank(t, a.profileId, retired);

    const fix = () =>
      t.mutation(api.maintenance.runDataFixes, {
        maintenanceSecret: TEST_MAINTENANCE_SECRET,
        dryRun: false,
      });
    const r = await fix();
    expect(r.words.deleted).toEqual(["notarealcurriculumword (1A)"]);
    expect(r.words.merged).toHaveLength(1);

    const state = await t.run(async (ctx) => ({
      words: await ctx.db.query("word_lists").collect(),
      bank: await ctx.db.query("word_bank").collect(),
      a: await ctx.db.get(a.profileId),
      b: await ctx.db.get(fine.profileId),
      sticker: await ctx.db.get(sticker),
    }));
    expect(state.words).toHaveLength(WORD_DATA.length);
    const kept = state.words.filter((w) => w.word === real.word);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ level: "2A", coinValue: real.coinValue });
    // Both readers' copies now point at the surviving row with its new labels;
    // the retired word's bank row is gone.
    expect(state.bank).toHaveLength(2);
    for (const row of state.bank) {
      expect(row.wordId).toBe(kept[0]._id);
      expect(row).toMatchObject({ level: "2A", coinValue: real.coinValue });
    }
    expect(state.a).toMatchObject({ currentLevel: "4A", boardsClearedAtLevel: 0, accuracyHistory: [] });
    expect(state.b?.currentLevel).toBe("2B");
    expect(state.sticker?.name).toBe("Cat With Fish");

    const again = await fix();
    expect(again.words).toMatchObject({ inserted: [], updated: [], merged: [], deleted: [] });
    expect(again.levels).toEqual([]);
    expect(again.stickers).toEqual([]);
  });

  test("merging a duplicate a reader already has keeps one bank row", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const a = await seedFamily(t, "user_a", "family");
    const w = WORD_DATA[0];
    const keep = await seedWord(t, w.word, w.level);
    const dup = await seedWord(t, w.word, "5B");
    await bank(t, a.profileId, keep);
    await bank(t, a.profileId, dup);
    await t.mutation(api.maintenance.runDataFixes, {
      maintenanceSecret: TEST_MAINTENANCE_SECRET,
      dryRun: false,
    });
    const rows = await t.run((ctx) => ctx.db.query("word_bank").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].wordId).toBe(keep);
  });
});

describe("internal word tools", () => {
  test("purgeWords removes the word everywhere, case-insensitively", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const bad = await seedWord(t, "Badword", "1A");
    const ok = await seedWord(t, "cat", "1A");
    await bank(t, a.profileId, bad);
    await bank(t, a.profileId, ok);
    const r = await t.mutation(internal.maintenance.purgeWords, { words: ["BADWORD"] });
    expect(r).toEqual({ wordListsRemoved: { Badword: 1 }, wordBankRemoved: 1 });
    const left = await t.run(async (ctx) => ({
      words: (await ctx.db.query("word_lists").collect()).map((w) => w.word),
      bank: (await ctx.db.query("word_bank").collect()).map((b) => b.word),
    }));
    expect(left).toEqual({ words: ["cat"], bank: ["cat"] });
  });

  test("inspectWords reports matches", async () => {
    const t = setup();
    await seedWord(t, "zib", "1A", true);
    await seedWord(t, "cat", "1A");
    const r = await t.query(internal.maintenance.inspectWords, { words: ["CAT", "nope"] });
    expect(r.totalWordLists).toBe(2);
    expect(r.matchesForTargets).toEqual([{ word: "cat", level: "1A", isNonsense: false }]);
    expect(r.level1ANonsenseWords).toEqual(["zib"]);
  });
});
