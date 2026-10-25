import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { ERROR_REPORT_DAYS, INACTIVE_READER_DAYS } from "./dataLifecycle";
import {
  installFakeTrustedSecrets,
  seedFamily,
  seedProfile,
  seedSticker,
  seedUser,
  seedWord,
  setup,
  TEST_SYNC_SECRET,
} from "./test.helpers";
import type { T } from "./test.helpers";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const DAY = 86_400_000;
const NOW = Date.parse("2028-06-01T12:00:00Z");

/** Gives a reader a word, a sticker and a session, like real play. */
async function playData(t: T, profileId: Id<"profiles">) {
  const w = await seedWord(t, `w${profileId.slice(-4)}`, "1A");
  const s = await seedSticker(t, `s${profileId.slice(-4)}`);
  await t.run(async (ctx) => {
    await ctx.db.insert("word_bank", {
      profileId,
      wordId: w,
      word: "w",
      level: "1A",
      isNonsense: false,
      coinValue: 5,
      needsPractice: false,
      firstEarned: 1,
      timesCorrect: 1,
    });
    await ctx.db.insert("profile_stickers", { profileId, stickerId: s, earnedAt: 1 });
    await ctx.db.insert("game_sessions", {
      profileId,
      level: "1A",
      boardsPlayed: 1,
      wordsCorrect: 30,
      firstAttemptCorrect: 30,
      wordsAttempted: 30,
      wordsSkipped: 0,
      hintsUsed: 0,
      coinsEarned: 150,
      stickersEarned: 0,
      duration: 300,
      completedAt: 1,
    });
  });
}

async function counts(t: T, profileId: Id<"profiles">) {
  return t.run(async (ctx) => ({
    profile: (await ctx.db.get(profileId)) ? 1 : 0,
    words: (await ctx.db.query("word_bank").withIndex("by_profile", (q) => q.eq("profileId", profileId)).collect()).length,
    stickers: (await ctx.db.query("profile_stickers").withIndex("by_profile", (q) => q.eq("profileId", profileId)).collect()).length,
    sessions: (await ctx.db.query("game_sessions").withIndex("by_profile", (q) => q.eq("profileId", profileId)).collect()).length,
  }));
}
const GONE = { profile: 0, words: 0, stickers: 0, sessions: 0 };
const KEPT = { profile: 1, words: 1, stickers: 1, sessions: 1 };

describe("deleteAccount (Clerk user.deleted)", () => {
  test("needs the server's secret", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await expect(t.mutation(api.dataLifecycle.deleteAccount, { clerkId: "user_a" })).rejects.toThrow("Forbidden");
    await expect(
      a.client.mutation(api.dataLifecycle.deleteAccount, { clerkId: "user_a", syncSecret: "guess" })
    ).rejects.toThrow("Forbidden");
    expect(await counts(t, a.profileId)).toMatchObject({ profile: 1 });
  });

  test("deletes every reader, their data, crash reports and the account; other families untouched", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const a = await seedFamily(t, "user_a", "family");
    const a2 = await seedProfile(t, a.userId, { name: "Second" });
    const b = await seedFamily(t, "user_b");
    for (const p of [a.profileId, a2, b.profileId]) await playData(t, p);
    await t.run(async (ctx) => {
      for (const clerkId of ["user_a", "user_b"]) {
        await ctx.db.insert("client_errors", { message: "x", path: "/play", userAgent: "ua", clerkId, at: 1 });
      }
    });

    const r = await t.mutation(api.dataLifecycle.deleteAccount, { clerkId: "user_a", syncSecret: TEST_SYNC_SECRET });
    expect(r).toEqual({ deleted: true, readers: 2 });
    expect(await counts(t, a.profileId)).toEqual(GONE);
    expect(await counts(t, a2)).toEqual(GONE);
    expect(await t.run((ctx) => ctx.db.get(a.userId))).toBeNull();
    expect(await counts(t, b.profileId)).toEqual(KEPT);
    const errors = await t.run((ctx) => ctx.db.query("client_errors").collect());
    expect(errors.map((e) => e.clerkId)).toEqual(["user_b"]);
  });

  test("is safe to repeat (Clerk retries)", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    await seedFamily(t, "user_a");
    await t.mutation(api.dataLifecycle.deleteAccount, { clerkId: "user_a", syncSecret: TEST_SYNC_SECRET });
    expect(
      await t.mutation(api.dataLifecycle.deleteAccount, { clerkId: "user_a", syncSecret: TEST_SYNC_SECRET })
    ).toEqual({ deleted: false, readers: 0 });
  });
});

describe("retention: inactive readers", () => {
  const purge = (t: T) => t.mutation(internal.dataLifecycle.purgeInactiveReaders, {});
  const old = NOW - (INACTIVE_READER_DAYS + 1) * DAY;
  const recent = NOW - (INACTIVE_READER_DAYS - 1) * DAY;
  const at = () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  };

  test("a free reader unplayed for over 2 years is deleted with all their data", async () => {
    at();
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { lastPlayedAt: old, createdAt: old - DAY });
    await playData(t, a.profileId);
    expect(await purge(t)).toEqual({ deleted: 1 });
    expect(await counts(t, a.profileId)).toEqual(GONE);
    // The grown-up's account itself stays (they can still sign in).
    expect(await t.run((ctx) => ctx.db.get(a.userId))).not.toBeNull();
  });

  test("a reader played within 2 years is kept", async () => {
    at();
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { lastPlayedAt: recent, createdAt: old });
    await playData(t, a.profileId);
    expect(await purge(t)).toEqual({ deleted: 0 });
    expect(await counts(t, a.profileId)).toEqual(KEPT);
  });

  test("a reader who never played is judged by when it was created", async () => {
    at();
    const t = setup();
    const fresh = await seedFamily(t, "user_a", "free", { createdAt: recent });
    const stale = await seedFamily(t, "user_b", "free", { createdAt: old });
    expect(await purge(t)).toEqual({ deleted: 1 });
    expect(await counts(t, fresh.profileId)).toMatchObject({ profile: 1 });
    expect(await counts(t, stale.profileId)).toMatchObject({ profile: 0 });
  });

  test.each([
    ["active subscription", { subscriptionStatus: "active" }],
    ["past due (still billing)", { subscriptionStatus: "past_due" }],
    ["comped tester", { compedTester: true }],
  ])("a paying account's readers are kept (%s)", async (_name, extra) => {
    at();
    const t = setup();
    const userId = await seedUser(t, "user_a", "family");
    await t.run((ctx) => ctx.db.patch(userId, extra));
    const p = await seedProfile(t, userId, { lastPlayedAt: old, createdAt: old });
    expect(await purge(t)).toEqual({ deleted: 0 });
    expect(await counts(t, p)).toMatchObject({ profile: 1 });
  });

  test("a canceled paid plan is treated like free", async () => {
    at();
    const t = setup();
    const userId = await seedUser(t, "user_a", "family");
    await t.run((ctx) => ctx.db.patch(userId, { subscriptionStatus: "canceled" }));
    const p = await seedProfile(t, userId, { lastPlayedAt: old, createdAt: old });
    expect(await purge(t)).toEqual({ deleted: 1 });
    expect(await counts(t, p)).toMatchObject({ profile: 0 });
  });
});

describe("retention: crash reports", () => {
  test(`reports older than ${ERROR_REPORT_DAYS} days are deleted`, async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const t = setup();
    await t.run(async (ctx) => {
      for (const [message, age] of [
        ["old", ERROR_REPORT_DAYS + 1],
        ["new", ERROR_REPORT_DAYS - 1],
      ] as const) {
        await ctx.db.insert("client_errors", { message, path: "/", userAgent: "ua", clerkId: "u", at: NOW - age * DAY });
      }
    });
    expect(await t.mutation(internal.dataLifecycle.purgeOldErrorReports, {})).toEqual({ deleted: 1 });
    const left = await t.run((ctx) => ctx.db.query("client_errors").collect());
    expect(left.map((e) => e.message)).toEqual(["new"]);
  });
});
