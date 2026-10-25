import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { as, seedFamily, seedProfile, seedSticker, seedUser, seedWord, setup } from "./test.helpers";
import type { T } from "./test.helpers";

afterEach(() => vi.useRealTimers());

const getProfile = (t: T, id: Id<"profiles">) => t.run((ctx) => ctx.db.get(id));
const countProfiles = (t: T, userId: Id<"users">) =>
  t.run(async (ctx) =>
    (await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).collect())
      .length
  );

// Puts a fully played board on the server's record (what 30 addWord calls
// leave behind), then finishes it.
type Family = Awaited<ReturnType<typeof seedFamily>>;
async function complete(
  t: T,
  a: Family,
  args: { accuracy?: number; localDate?: string } = {},
  firstTry = 30
) {
  await t.run((ctx) => ctx.db.patch(a.profileId, { boardWords: 30, boardFirstTry: firstTry }));
  return a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 1, ...args });
}

describe("reads are owner-only", () => {
  test("getByUser returns [] for anonymous and other users", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await seedFamily(t, "user_b");
    expect(await t.query(api.profiles.getByUser, { userId: a.userId })).toEqual([]);
    expect(await as(t, "user_b").query(api.profiles.getByUser, { userId: a.userId })).toEqual([]);
    const mine = await a.client.query(api.profiles.getByUser, { userId: a.userId });
    expect(mine.map((p) => p._id)).toEqual([a.profileId]);
  });

  test("get returns null for anonymous, other users and deleted profiles", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    expect(await t.query(api.profiles.get, { profileId: a.profileId })).toBeNull();
    expect(await as(t, "user_b").query(api.profiles.get, { profileId: a.profileId })).toBeNull();
    expect((await a.client.query(api.profiles.get, { profileId: a.profileId }))?._id).toBe(
      a.profileId
    );
    await t.run((ctx) => ctx.db.delete(a.profileId));
    expect(await a.client.query(api.profiles.get, { profileId: a.profileId })).toBeNull();
  });
});

describe("create", () => {
  test("requires sign-in and only creates for the caller", async () => {
    const t = setup();
    const a = await seedUser(t, "user_a");
    const b = await seedUser(t, "user_b");
    const args = { userId: a, name: "Ann", avatarEmoji: "🐶" };
    await expect(t.mutation(api.profiles.create, args)).rejects.toThrow("Not authenticated");
    await expect(as(t, "user_b").mutation(api.profiles.create, args)).rejects.toThrow("Forbidden");
    expect(await countProfiles(t, a)).toBe(0);
    expect(await countProfiles(t, b)).toBe(0);
  });

  test("new reader gets safe defaults at 1A", async () => {
    const t = setup();
    const a = await seedUser(t, "user_a");
    const id = await as(t, "user_a").mutation(api.profiles.create, {
      userId: a,
      name: "Ann",
      avatarEmoji: "🐶",
    });
    const p = await getProfile(t, id);
    expect(p).toMatchObject({
      currentLevel: "1A",
      coins: 0,
      lifetimeCoins: 0,
      boardsClearedAtLevel: 0,
      totalBoardsCleared: 0,
      streakDays: 0,
      accuracyHistory: [],
      wordMode: "mixed",
      hasSeenTutorial: false,
    });
  });

  test.each([
    ["free", 1],
    ["individual", 1],
    ["family", 5],
    ["classroom", 30],
  ] as const)("%s plan allows exactly %i reader(s)", async (plan, limit) => {
    const t = setup();
    const userId = await seedUser(t, "user_a", plan);
    const me = as(t, "user_a");
    for (let i = 0; i < limit; i++) {
      await me.mutation(api.profiles.create, { userId, name: `Kid ${i}`, avatarEmoji: "🐱" });
    }
    await expect(
      me.mutation(api.profiles.create, { userId, name: "One too many", avatarEmoji: "🐱" })
    ).rejects.toThrow("PROFILE_LIMIT_REACHED");
    expect(await countProfiles(t, userId)).toBe(limit);
  });

  test("a downgraded account over its limit cannot add more readers", async () => {
    const t = setup();
    const userId = await seedUser(t, "user_a", "free");
    for (let i = 0; i < 3; i++) await seedProfile(t, userId);
    await expect(
      as(t, "user_a").mutation(api.profiles.create, { userId, name: "X", avatarEmoji: "🐱" })
    ).rejects.toThrow("PROFILE_LIMIT_REACHED");
  });

  test.each(["9Z", "1a", "", " 1A", "3E", "5C", "1A; drop", "0A"])(
    "rejects invalid starting level %j",
    async (startingLevel) => {
      const t = setup();
      const userId = await seedUser(t, "user_a", "classroom");
      await expect(
        as(t, "user_a").mutation(api.profiles.create, {
          userId,
          name: "X",
          avatarEmoji: "🐱",
          startingLevel,
        })
      ).rejects.toThrow("Invalid level");
      expect(await countProfiles(t, userId)).toBe(0);
    }
  );

  test("free plan can start anywhere in Level 1 but not beyond", async () => {
    const t = setup();
    const userId = await seedUser(t, "user_a", "free");
    const me = as(t, "user_a");
    await expect(
      me.mutation(api.profiles.create, { userId, name: "X", avatarEmoji: "🐱", startingLevel: "2A" })
    ).rejects.toThrow("LEVEL_LOCKED");
    const id = await me.mutation(api.profiles.create, {
      userId,
      name: "X",
      avatarEmoji: "🐱",
      startingLevel: "1H",
    });
    expect((await getProfile(t, id))?.currentLevel).toBe("1H");
  });

  test("paid plan can start at the last sublevel", async () => {
    const t = setup();
    const userId = await seedUser(t, "user_a", "individual");
    const id = await as(t, "user_a").mutation(api.profiles.create, {
      userId,
      name: "X",
      avatarEmoji: "🐱",
      startingLevel: "5B",
    });
    expect((await getProfile(t, id))?.currentLevel).toBe("5B");
  });
});

describe("names, avatars and themes are checked", () => {
  test("create trims the name and refuses blank or overlong names", async () => {
    const t = setup();
    const a = await seedUser(t, "user_a", "family");
    const me = as(t, "user_a");
    const id = await me.mutation(api.profiles.create, { userId: a, name: "  Ann   Lee ", avatarEmoji: "🐶" });
    expect((await getProfile(t, id))?.name).toBe("Ann Lee");
    for (const name of ["", "   ", "x".repeat(31)]) {
      await expect(me.mutation(api.profiles.create, { userId: a, name, avatarEmoji: "🐶" })).rejects.toThrow(
        "INVALID_NAME"
      );
    }
    await expect(
      me.mutation(api.profiles.create, { userId: a, name: "Bo", avatarEmoji: "x".repeat(200) })
    ).rejects.toThrow("INVALID_AVATAR");
    expect(await countProfiles(t, a)).toBe(1);
  });

  test("update refuses blank names, unknown themes and huge avatars", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { name: "Ann" });
    const upd = (args: Record<string, unknown>) =>
      a.client.mutation(api.profiles.update, { profileId: a.profileId, ...args });
    await expect(upd({ name: " " })).rejects.toThrow("INVALID_NAME");
    await expect(upd({ name: "y".repeat(31) })).rejects.toThrow("INVALID_NAME");
    await expect(upd({ selectedTheme: "<script>" })).rejects.toThrow("INVALID_THEME");
    await expect(upd({ avatarEmoji: "" })).rejects.toThrow("INVALID_AVATAR");
    expect((await getProfile(t, a.profileId))?.name).toBe("Ann");
    await upd({ name: " Annie ", selectedTheme: "classic" });
    const p = await getProfile(t, a.profileId);
    expect(p?.name).toBe("Annie");
    expect(p?.selectedTheme).toBe("classic");
  });
});

describe("update", () => {
  test("owner can patch; omitted fields are untouched", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { name: "Ann", selectedTheme: "space" });
    await a.client.mutation(api.profiles.update, { profileId: a.profileId, wordMode: "real" });
    const p = await getProfile(t, a.profileId);
    expect(p?.wordMode).toBe("real");
    expect(p?.name).toBe("Ann");
    expect(p?.selectedTheme).toBe("space");
  });

  test("cannot touch coins or level through update", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await expect(
      a.client.mutation(api.profiles.update, {
        profileId: a.profileId,
        // @ts-expect-error not an accepted field
        coins: 99999,
      })
    ).rejects.toThrow();
    await expect(
      a.client.mutation(api.profiles.update, {
        profileId: a.profileId,
        // @ts-expect-error not an accepted field
        currentLevel: "5B",
      })
    ).rejects.toThrow();
    const p = await getProfile(t, a.profileId);
    expect(p?.coins).toBe(0);
    expect(p?.currentLevel).toBe("1A");
  });

  test("other users and anonymous callers are refused", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { name: "Ann" });
    await seedUser(t, "user_b");
    await expect(
      as(t, "user_b").mutation(api.profiles.update, { profileId: a.profileId, name: "Hacked" })
    ).rejects.toThrow("Forbidden");
    await expect(
      t.mutation(api.profiles.update, { profileId: a.profileId, name: "Hacked" })
    ).rejects.toThrow("Not authenticated");
    expect((await getProfile(t, a.profileId))?.name).toBe("Ann");
  });

  test("updating a deleted profile fails cleanly", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await t.run((ctx) => ctx.db.delete(a.profileId));
    await expect(
      a.client.mutation(api.profiles.update, { profileId: a.profileId, name: "X" })
    ).rejects.toThrow("Profile not found");
  });
});

describe("remove", () => {
  test("cascades only this profile's data", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family");
    const sibling = await seedProfile(t, a.userId);
    const wordId = await seedWord(t, "cat", "1A");
    const stickerId = await seedSticker(t, "Cat");
    await t.run(async (ctx) => {
      for (const profileId of [a.profileId, sibling]) {
        await ctx.db.insert("word_bank", {
          profileId,
          wordId,
          word: "cat",
          level: "1A",
          isNonsense: false,
          coinValue: 5,
          needsPractice: false,
          firstEarned: 1,
          timesCorrect: 1,
        });
        await ctx.db.insert("profile_stickers", { profileId, stickerId, earnedAt: 1 });
        await ctx.db.insert("game_sessions", {
          profileId,
          level: "1A",
          boardsPlayed: 1,
          wordsCorrect: 1,
          firstAttemptCorrect: 1,
          wordsAttempted: 1,
          wordsSkipped: 0,
          hintsUsed: 0,
          coinsEarned: 5,
          stickersEarned: 0,
          duration: 10,
          completedAt: 1,
        });
      }
    });

    await a.client.mutation(api.profiles.remove, { profileId: a.profileId });

    const left = await t.run(async (ctx) => ({
      profile: await ctx.db.get(a.profileId),
      bank: await ctx.db.query("word_bank").collect(),
      stickers: await ctx.db.query("profile_stickers").collect(),
      sessions: await ctx.db.query("game_sessions").collect(),
    }));
    expect(left.profile).toBeNull();
    for (const rows of [left.bank, left.stickers, left.sessions]) {
      expect(rows.map((r) => r.profileId)).toEqual([sibling]);
    }
  });

  test("another user cannot delete my reader", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    await expect(
      as(t, "user_b").mutation(api.profiles.remove, { profileId: a.profileId })
    ).rejects.toThrow("Forbidden");
    expect(await getProfile(t, a.profileId)).not.toBeNull();
  });
});

describe("coins", () => {
  // Coins are paid by the server (wordBank.addWord / markPracticed). The old
  // client call is kept so older browsers don't error, but it pays nothing.
  test.each([25, 100, 1e9, -1, NaN])("awardCoins(%s) changes nothing", async (amount) => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { coins: 10, lifetimeCoins: 40 });
    await a.client.mutation(api.profiles.awardCoins, { profileId: a.profileId, amount });
    expect(await getProfile(t, a.profileId)).toMatchObject({ coins: 10, lifetimeCoins: 40 });
  });

  test("awardCoins to someone else's reader is refused", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    await expect(
      as(t, "user_b").mutation(api.profiles.awardCoins, { profileId: a.profileId, amount: 5 })
    ).rejects.toThrow("Forbidden");
  });

  test("spendCoins deducts and refuses to overdraw", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { coins: 30, lifetimeCoins: 30 });
    await a.client.mutation(api.profiles.spendCoins, { profileId: a.profileId, amount: 20 });
    await expect(
      a.client.mutation(api.profiles.spendCoins, { profileId: a.profileId, amount: 11 })
    ).rejects.toThrow("Insufficient coins");
    expect(await getProfile(t, a.profileId)).toMatchObject({ coins: 10, lifetimeCoins: 30 });
  });

  // Regression: a negative "spend" used to mint coins (coins - (-1e9)), and
  // NaN corrupted the balance to NaN.
  test.each([-1_000_000, NaN, Infinity])("spendCoins rejects %s", async (amount) => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { coins: 30 });
    await expect(
      a.client.mutation(api.profiles.spendCoins, { profileId: a.profileId, amount })
    ).rejects.toThrow();
    expect((await getProfile(t, a.profileId))?.coins).toBe(30);
  });

  test("spendCoins on someone else's reader is refused", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { coins: 30 });
    await seedUser(t, "user_b");
    await expect(
      as(t, "user_b").mutation(api.profiles.spendCoins, { profileId: a.profileId, amount: 30 })
    ).rejects.toThrow("Forbidden");
    expect((await getProfile(t, a.profileId))?.coins).toBe(30);
  });
});

// Meets the level-up goal: 7 boards at the level, last 3 averaging 80%+.
const READY = { boardsClearedAtLevel: 7, accuracyHistory: [0.8, 0.8, 0.8] };

describe("advanceLevel", () => {
  test("moves to the next sublevel and resets level progress", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", {
      currentLevel: "1A",
      boardsClearedAtLevel: 7,
      totalBoardsCleared: 9,
      accuracyHistory: [0.9, 0.9, 0.9],
    });
    await a.client.mutation(api.profiles.advanceLevel, { profileId: a.profileId, nextLevel: "1B" });
    expect(await getProfile(t, a.profileId)).toMatchObject({
      currentLevel: "1B",
      boardsClearedAtLevel: 0,
      totalBoardsCleared: 9,
      accuracyHistory: [],
    });
  });

  test.each([
    ["1A", "1C"],
    ["1A", "1A"],
    ["1B", "1A"],
    ["1A", "5B"],
    ["5B", "5C"],
    ["1A", "nope"],
  ])("refuses %s → %s", async (from, to) => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "classroom", { currentLevel: from });
    await expect(
      a.client.mutation(api.profiles.advanceLevel, { profileId: a.profileId, nextLevel: to })
    ).rejects.toThrow("Invalid level advance");
    expect((await getProfile(t, a.profileId))?.currentLevel).toBe(from);
  });

  test("free plan stops at the end of Level 1", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { currentLevel: "1H", ...READY });
    await expect(
      a.client.mutation(api.profiles.advanceLevel, { profileId: a.profileId, nextLevel: "2A" })
    ).rejects.toThrow("LEVEL_LOCKED");
    expect((await getProfile(t, a.profileId))?.currentLevel).toBe("1H");
  });

  test("paid plan crosses into Level 2", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "individual", { currentLevel: "1H", ...READY });
    await a.client.mutation(api.profiles.advanceLevel, { profileId: a.profileId, nextLevel: "2A" });
    expect((await getProfile(t, a.profileId))?.currentLevel).toBe("2A");
  });

  test.each([
    ["too few boards", { boardsClearedAtLevel: 6, accuracyHistory: [1, 1, 1] }],
    ["accuracy too low", { boardsClearedAtLevel: 9, accuracyHistory: [0.9, 0.7, 0.7] }],
    ["fewer than 3 scores", { boardsClearedAtLevel: 9, accuracyHistory: [1, 1] }],
    ["nothing played", {}],
  ])("a reader who hasn't earned it can't move up (%s)", async (_name, progress) => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "classroom", { currentLevel: "1A", ...progress });
    await expect(
      a.client.mutation(api.profiles.advanceLevel, { profileId: a.profileId, nextLevel: "1B" })
    ).rejects.toThrow("NOT_READY");
    expect((await getProfile(t, a.profileId))?.currentLevel).toBe("1A");
  });

  test("a reader stranded on a retired sublevel can only move to its replacement", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family", { currentLevel: "3E" });
    await expect(
      a.client.mutation(api.profiles.advanceLevel, { profileId: a.profileId, nextLevel: "3D" })
    ).rejects.toThrow("Invalid level advance");
    await a.client.mutation(api.profiles.advanceLevel, { profileId: a.profileId, nextLevel: "4A" });
    expect((await getProfile(t, a.profileId))?.currentLevel).toBe("4A");
  });

  test("someone else cannot advance my reader", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family");
    await seedUser(t, "user_b", "family");
    await expect(
      as(t, "user_b").mutation(api.profiles.advanceLevel, { profileId: a.profileId, nextLevel: "1B" })
    ).rejects.toThrow("Forbidden");
  });
});

describe("setLevel", () => {
  test("owner can move a reader up or down; level progress resets", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family", {
      currentLevel: "2C",
      boardsClearedAtLevel: 5,
      totalBoardsCleared: 20,
      accuracyHistory: [0.5, 0.6],
      coins: 77,
    });
    await a.client.mutation(api.profiles.setLevel, { profileId: a.profileId, level: "1D" });
    expect(await getProfile(t, a.profileId)).toMatchObject({
      currentLevel: "1D",
      boardsClearedAtLevel: 0,
      accuracyHistory: [],
      totalBoardsCleared: 20,
      coins: 77,
    });
    await a.client.mutation(api.profiles.setLevel, { profileId: a.profileId, level: "5B" });
    expect((await getProfile(t, a.profileId))?.currentLevel).toBe("5B");
  });

  test("choosing the current level keeps progress", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family", {
      currentLevel: "2C",
      boardsClearedAtLevel: 5,
      accuracyHistory: [0.9],
    });
    await a.client.mutation(api.profiles.setLevel, { profileId: a.profileId, level: "2C" });
    expect(await getProfile(t, a.profileId)).toMatchObject({
      boardsClearedAtLevel: 5,
      accuracyHistory: [0.9],
    });
  });

  test.each(["3E", "6A", "", "1a"])("rejects invalid level %j", async (level) => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family");
    await expect(
      a.client.mutation(api.profiles.setLevel, { profileId: a.profileId, level })
    ).rejects.toThrow("Invalid level");
  });

  test("free plan cannot be placed beyond Level 1", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free");
    await expect(
      a.client.mutation(api.profiles.setLevel, { profileId: a.profileId, level: "2A" })
    ).rejects.toThrow("LEVEL_LOCKED");
    expect((await getProfile(t, a.profileId))?.currentLevel).toBe("1A");
  });

  test("other users and anonymous callers are refused", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family");
    await seedUser(t, "user_b", "family");
    await expect(
      as(t, "user_b").mutation(api.profiles.setLevel, { profileId: a.profileId, level: "5B" })
    ).rejects.toThrow("Forbidden");
    await expect(
      t.mutation(api.profiles.setLevel, { profileId: a.profileId, level: "5B" })
    ).rejects.toThrow("Not authenticated");
    expect((await getProfile(t, a.profileId))?.currentLevel).toBe("1A");
  });
});

describe("completedBoard", () => {
  const at = (iso: string) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
  };

  test("counts the board; accuracy comes from the server's count, not the client", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", {
      boardsClearedAtLevel: 2,
      totalBoardsCleared: 10,
    });
    const r = await complete(t, a, { accuracy: 1 }, 24);
    expect(r.accuracy).toBeCloseTo(0.8);
    await complete(t, a, { accuracy: 0 }, 30);
    const p = await getProfile(t, a.profileId);
    expect(p?.boardsClearedAtLevel).toBe(4);
    expect(p?.totalBoardsCleared).toBe(12);
    expect(p?.accuracyHistory).toEqual([0.8, 1]);
    expect(p).toMatchObject({ boardWords: 0, boardFirstTry: 0 });
  });

  test.each([
    [1.5, 1],
    [-3, 0],
    [NaN, 0],
    [0.75, 0.75],
  ])("a reader mid-board when counting began: client accuracy %s is clamped to %s, once", async (accuracy, kept) => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy });
    expect((await getProfile(t, a.profileId))?.accuracyHistory).toEqual([kept]);
    // From then on the server counts, so an unplayed board is refused.
    await expect(
      a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 1 })
    ).rejects.toThrow("BOARD_NOT_FINISHED");
  });

  test.each([0, 1, 27])("a board with %i answers is not finished", async (words) => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { boardWords: words, boardFirstTry: words });
    await expect(
      a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 1 })
    ).rejects.toThrow("BOARD_NOT_FINISHED");
    expect((await getProfile(t, a.profileId))?.totalBoardsCleared).toBe(0);
  });

  test("keeps only the last 10 accuracy scores", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", {
      accuracyHistory: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
    });
    await a.client.mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 0.9 });
    const p = await getProfile(t, a.profileId);
    expect(p?.accuracyHistory).toHaveLength(10);
    expect(p?.accuracyHistory.at(-1)).toBe(0.9);
  });

  test("streak: first day, same day, next day, then a gap", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const play = (localDate: string) =>
      complete(t, a, { localDate });
    expect((await play("2026-10-01")).newStreakDays).toBe(1);
    expect((await play("2026-10-01")).newStreakDays).toBe(1);
    expect((await play("2026-10-02")).newStreakDays).toBe(2);
    const r = await play("2026-10-03");
    expect(r).toMatchObject({ newStreakDays: 3, previousStreakDays: 2 });
    expect((await play("2026-10-06")).newStreakDays).toBe(1);
  });

  test("streak survives month/year boundaries and a clock moving backwards", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", {
      streakDays: 4,
      lastPlayedLocalDate: "2026-12-31",
    });
    const r1 = await complete(t, a, { localDate: "2027-01-01" });
    expect(r1.newStreakDays).toBe(5);
    const r2 = await complete(t, a, { localDate: "2026-12-30" });
    expect(r2.newStreakDays).toBe(5);
  });

  test("a malformed localDate falls back to the server's UTC day", async () => {
    at("2026-10-02T12:00:00Z");
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", {
      streakDays: 2,
      lastPlayedLocalDate: "2026-10-01",
    });
    const r = await complete(t, a, { localDate: "10/02/2026" });
    expect(r.newStreakDays).toBe(3);
    expect((await getProfile(t, a.profileId))?.lastPlayedLocalDate).toBe("2026-10-02");
  });

  test("old clients without localDate use lastPlayedAt in UTC", async () => {
    at("2026-10-02T12:00:00Z");
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", {
      streakDays: 6,
      lastPlayedAt: Date.parse("2026-10-01T08:00:00Z"),
    });
    const r = await complete(t, a);
    expect(r.newStreakDays).toBe(7);
  });

  test("someone else cannot log boards on my reader", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    await expect(
      as(t, "user_b").mutation(api.profiles.completedBoard, { profileId: a.profileId, accuracy: 1 })
    ).rejects.toThrow("Forbidden");
    expect((await getProfile(t, a.profileId))?.totalBoardsCleared).toBe(0);
  });
});
