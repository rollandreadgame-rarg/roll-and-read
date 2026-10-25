// Coins, finished boards, sticker picks and level-ups are decided by the
// server. These tests play the way a browser does and the way a cheat would.
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MIN_ANSWER_GAP_MS, PRACTICE_COIN_REWARD } from "./wordBank";
import { seedFamily, seedSticker, seedWord, setup } from "./test.helpers";
import type { T } from "./test.helpers";

afterEach(() => vi.useRealTimers());

type Family = Awaited<ReturnType<typeof seedFamily>>;
const getProfile = (t: T, id: Id<"profiles">) => t.run((ctx) => ctx.db.get(id));

// A clock the tests move forward, so answers arrive at a human pace.
let now = 1_800_000_000_000;
function clock() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  return (ms = 1500) => {
    now += ms;
    vi.setSystemTime(now);
  };
}

async function seedWords(t: T, n: number, level = "1A") {
  const ids: Id<"word_lists">[] = [];
  for (let i = 0; i < n; i++) ids.push(await seedWord(t, `w${level}${i}`, level));
  return ids;
}

const answer = (a: Family, wordId: Id<"word_lists">, opts: { misses?: number; skipped?: boolean } = {}) =>
  a.client.mutation(api.wordBank.addWord, {
    profileId: a.profileId,
    wordId,
    // What the browser sends; the server ignores all three.
    word: "fake",
    level: "5B",
    coinValue: 1000,
    isNonsense: false,
    needsPractice: !!opts.skipped,
    missesBeforeCorrect: opts.skipped ? 7 : (opts.misses ?? 0),
  });

/** Answers a full board of 30 words, `firstTry` of them on the first try. */
async function playBoard(t: T, a: Family, words: Id<"word_lists">[], firstTry = 30, tick = clock()) {
  await a.client.mutation(api.profiles.startBoard, { profileId: a.profileId });
  for (let i = 0; i < 30; i++) {
    tick();
    await answer(a, words[i], { misses: i < firstTry ? 0 : 1 });
  }
}

describe("coins are paid by the server when a word is read", () => {
  test("the curriculum's coin value is paid, not the browser's", async () => {
    const tick = clock();
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const [w] = await seedWords(t, 1);
    tick();
    await answer(a, w);
    expect(await getProfile(t, a.profileId)).toMatchObject({ coins: 5, lifetimeCoins: 5, boardWords: 1, boardFirstTry: 1 });
  });

  test("a skipped word is counted on the board but pays nothing", async () => {
    const tick = clock();
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const [w] = await seedWords(t, 1);
    tick();
    await answer(a, w, { skipped: true });
    expect(await getProfile(t, a.profileId)).toMatchObject({ coins: 0, boardWords: 1, boardFirstTry: 0 });
  });

  test("answers faster than a child could tap pay nothing", async () => {
    const tick = clock();
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const words = await seedWords(t, 5);
    tick();
    await answer(a, words[0]);
    for (let i = 1; i < 5; i++) {
      tick(MIN_ANSWER_GAP_MS - 1);
      await answer(a, words[i]);
    }
    // 4 too-fast answers in a row: each is under the gap from the last paid one.
    const p = await getProfile(t, a.profileId);
    expect(p?.coins).toBeLessThanOrEqual(15);
    expect(p?.coins).toBeGreaterThanOrEqual(5);
    tick(MIN_ANSWER_GAP_MS);
    await answer(a, words[0]);
    expect((await getProfile(t, a.profileId))?.coins).toBe((p?.coins ?? 0) + 5);
  });

  test("a full board stops paying until it is finished", async () => {
    const tick = clock();
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const words = await seedWords(t, 31);
    await playBoard(t, a, words, 30, tick);
    expect((await getProfile(t, a.profileId))?.coins).toBe(150);
    tick();
    await answer(a, words[30]);
    expect(await getProfile(t, a.profileId)).toMatchObject({ coins: 150, boardWords: 30 });
  });

  test("words far above the reader's level pay nothing (next level does)", async () => {
    const tick = clock();
    const t = setup();
    const a = await seedFamily(t, "user_a", "classroom", { currentLevel: "1A" });
    const [next] = await seedWords(t, 1, "1B");
    const [far] = await seedWords(t, 1, "5B");
    tick();
    await answer(a, far);
    expect(await getProfile(t, a.profileId)).toMatchObject({ coins: 0 });
    tick();
    await answer(a, next);
    expect(await getProfile(t, a.profileId)).toMatchObject({ coins: 5, boardWords: 1 });
  });

  test("startBoard forgets an abandoned board", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { boardWords: 17, boardFirstTry: 9 });
    await a.client.mutation(api.profiles.startBoard, { profileId: a.profileId });
    expect(await getProfile(t, a.profileId)).toMatchObject({ boardWords: 0, boardFirstTry: 0 });
  });
});

describe("finishing a board", () => {
  test("accuracy is the server's count of first-try answers", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const words = await seedWords(t, 30);
    await playBoard(t, a, words, 21);
    const r = await a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 1 });
    expect(r.accuracy).toBeCloseTo(0.7);
    expect((await getProfile(t, a.profileId))?.accuracyHistory).toEqual([r.accuracy]);
  });

  test("finishing twice needs two played boards", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const words = await seedWords(t, 30);
    await playBoard(t, a, words);
    await a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 1 });
    await expect(
      a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 1 })
    ).rejects.toThrow("BOARD_NOT_FINISHED");
    expect((await getProfile(t, a.profileId))?.totalBoardsCleared).toBe(1);
  });

  test("the first board earns a sticker pick, held on the server", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const words = await seedWords(t, 30);
    await playBoard(t, a, words, 20);
    const r = await a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 1 });
    expect(r.milestones.map((m) => m.type)).toEqual(["first-board"]);
    expect((await getProfile(t, a.profileId))?.pendingRewards).toEqual([
      { type: "first-board", rarity: "common", label: "First board cleared!" },
    ]);
  });

  test("a perfect board adds a rare pick; picks queue up to 10", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", {
      totalBoardsCleared: 1,
      pendingRewards: Array.from({ length: 9 }, () => ({ type: "x", rarity: "common", label: "x" })),
    });
    const words = await seedWords(t, 30);
    await playBoard(t, a, words, 30);
    const r = await a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 0 });
    expect(r.milestones.map((m) => m.type)).toEqual(["perfect-accuracy"]);
    const pending = (await getProfile(t, a.profileId))?.pendingRewards ?? [];
    expect(pending).toHaveLength(10);
    expect(pending.at(-1)).toMatchObject({ type: "perfect-accuracy", rarity: "rare" });
  });

  test("earning the next level: paid plan gets levelUp and a level-up pick", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "individual", {
      currentLevel: "1H",
      boardsClearedAtLevel: 6,
      totalBoardsCleared: 6,
      accuracyHistory: [0.9, 0.9],
    });
    const words = await seedWords(t, 30, "1H");
    await playBoard(t, a, words, 27);
    const r = await a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 0 });
    expect(r).toMatchObject({ levelUp: "2A", levelLocked: false });
    expect(r.milestones.map((m) => m.type)).toContain("level-up");
    await a.client.mutation(api.profiles.advanceLevel, { profileId: a.profileId, nextLevel: "2A" });
    expect((await getProfile(t, a.profileId))?.currentLevel).toBe("2A");
  });

  test("earning a level the plan doesn't include: levelLocked, no level-up pick", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", {
      currentLevel: "1H",
      boardsClearedAtLevel: 6,
      totalBoardsCleared: 6,
      accuracyHistory: [0.9, 0.9],
    });
    const words = await seedWords(t, 30, "1H");
    await playBoard(t, a, words, 27);
    const r = await a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 0 });
    expect(r).toMatchObject({ levelUp: null, levelLocked: true });
    expect(r.milestones.map((m) => m.type)).not.toContain("level-up");
  });

  test("a low-accuracy board doesn't earn the level, whatever the browser says", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "individual", {
      currentLevel: "1H",
      boardsClearedAtLevel: 6,
      accuracyHistory: [0.9, 0.9],
    });
    const words = await seedWords(t, 30, "1H");
    await playBoard(t, a, words, 10);
    const r = await a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 1 });
    expect(r).toMatchObject({ levelUp: null, levelLocked: false });
    await expect(
      a.client.mutation(api.profiles.advanceLevel, { profileId: a.profileId, nextLevel: "2A" })
    ).rejects.toThrow("NOT_READY");
  });
});

describe("claiming sticker picks", () => {
  const claim = (a: Family, rarity: "common" | "legendary" = "common") =>
    a.client.mutation(api.stickersDb.awardStickerFromCategory, {
      profileId: a.profileId,
      category: "animals",
      preferredRarity: rarity,
    });
  const owned = (t: T, id: Id<"profiles">) =>
    t.run((ctx) => ctx.db.query("profile_stickers").withIndex("by_profile", (q) => q.eq("profileId", id)).collect());

  test("each claim uses one pick, with the server's rarity", async () => {
    const t = setup();
    for (const r of ["common", "rare", "legendary"] as const) {
      await seedSticker(t, `${r}1`, r);
      await seedSticker(t, `${r}2`, r);
    }
    const a = await seedFamily(t, "user_a", "free", {
      pendingRewards: [{ type: "first-board", rarity: "common", label: "First board cleared!" }],
    });
    const got = await claim(a, "legendary");
    expect(got?.rarity).toBe("common");
    expect((await getProfile(t, a.profileId))?.pendingRewards).toEqual([]);
    await expect(claim(a)).rejects.toThrow("NO_PENDING_REWARD");
    expect(await owned(t, a.profileId)).toHaveLength(1);
  });

  test("readers from before picks were stored get up to 3 claims, then none", async () => {
    const t = setup();
    for (let i = 0; i < 5; i++) await seedSticker(t, `s${i}`);
    const a = await seedFamily(t, "user_a");
    await claim(a);
    await claim(a);
    await claim(a);
    await expect(claim(a)).rejects.toThrow("NO_PENDING_REWARD");
    expect(await owned(t, a.profileId)).toHaveLength(3);
  });

  test("someone else can't claim my reader's picks", async () => {
    const t = setup();
    await seedSticker(t, "s1");
    const a = await seedFamily(t, "user_a", "free", {
      pendingRewards: [{ type: "first-board", rarity: "common", label: "x" }],
    });
    const b = await seedFamily(t, "user_b");
    await expect(
      b.client.mutation(api.stickersDb.awardStickerFromCategory, {
        profileId: a.profileId,
        category: "animals",
        preferredRarity: "common",
      })
    ).rejects.toThrow("Forbidden");
    expect((await getProfile(t, a.profileId))?.pendingRewards).toHaveLength(1);
  });

  test("a full play-through: board → pick → claimed sticker", async () => {
    const t = setup();
    await seedSticker(t, "cat");
    const a = await seedFamily(t, "user_a");
    const words = await seedWords(t, 30);
    await playBoard(t, a, words);
    await a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 1 });
    const pending = (await getProfile(t, a.profileId))?.pendingRewards ?? [];
    for (let i = 0; i < pending.length; i++) await claim(a);
    expect(await owned(t, a.profileId)).toHaveLength(1);
    expect((await getProfile(t, a.profileId))?.pendingRewards).toEqual([]);
  });
});

describe("practice coins", () => {
  test("reading a word that needed practice pays once", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { coins: 0, lifetimeCoins: 0 });
    const [w] = await seedWords(t, 1);
    const entry = await t.run((ctx) =>
      ctx.db.insert("word_bank", {
        profileId: a.profileId,
        wordId: w,
        word: "wx",
        level: "1A",
        isNonsense: false,
        coinValue: 5,
        needsPractice: true,
        firstEarned: 1,
        timesCorrect: 0,
      })
    );
    await a.client.mutation(api.wordBank.markPracticed, { wordBankId: entry, stillNeedsPractice: false });
    await a.client.mutation(api.wordBank.markPracticed, { wordBankId: entry, stillNeedsPractice: false });
    expect(await getProfile(t, a.profileId)).toMatchObject({
      coins: PRACTICE_COIN_REWARD,
      lifetimeCoins: PRACTICE_COIN_REWARD,
    });
  });

  test("'still hard' pays nothing", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const [w] = await seedWords(t, 1);
    const entry = await t.run((ctx) =>
      ctx.db.insert("word_bank", {
        profileId: a.profileId,
        wordId: w,
        word: "wx",
        level: "1A",
        isNonsense: false,
        coinValue: 5,
        needsPractice: true,
        firstEarned: 1,
        timesCorrect: 0,
      })
    );
    await a.client.mutation(api.wordBank.markPracticed, { wordBankId: entry, stillNeedsPractice: true });
    expect((await getProfile(t, a.profileId))?.coins).toBe(0);
  });
});
