import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { as, seedFamily, seedUser, setup } from "./test.helpers";

afterEach(() => vi.useRealTimers());

const session = (profileId: Id<"profiles">, extra: Record<string, number | string> = {}) => ({
  profileId,
  level: "1A",
  boardsPlayed: 1,
  wordsCorrect: 28,
  firstAttemptCorrect: 24,
  wordsAttempted: 30,
  wordsSkipped: 2,
  hintsUsed: 3,
  coinsEarned: 140,
  stickersEarned: 0,
  duration: 300,
  ...extra,
});

describe("save", () => {
  test("stores the session with a server timestamp", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-10-23T15:00:00Z"));
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const id = await a.client.mutation(api.gameSessions.save, session(a.profileId));
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row).toMatchObject({
      wordsCorrect: 28,
      firstAttemptCorrect: 24,
      wordsSkipped: 2,
      completedAt: Date.parse("2026-10-23T15:00:00Z"),
    });
  });

  test("the client can't backdate completedAt", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await expect(
      a.client.mutation(
        api.gameSessions.save,
        // @ts-expect-error completedAt is server-set
        { ...session(a.profileId), completedAt: 0 }
      )
    ).rejects.toThrow();
  });

  test("other families and anonymous callers are refused", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    await expect(
      as(t, "user_b").mutation(api.gameSessions.save, session(a.profileId))
    ).rejects.toThrow("Forbidden");
    await expect(t.mutation(api.gameSessions.save, session(a.profileId))).rejects.toThrow(
      "Not authenticated"
    );
    expect(await t.run((ctx) => ctx.db.query("game_sessions").collect())).toHaveLength(0);
  });

  test("saving for a deleted reader fails cleanly", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await t.run((ctx) => ctx.db.delete(a.profileId));
    await expect(a.client.mutation(api.gameSessions.save, session(a.profileId))).rejects.toThrow(
      "Profile not found"
    );
  });

  // Stats come from the browser; impossible values are clamped (not rejected,
  // so a client glitch never loses a real session).
  test("clamps impossible stats", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await a.client.mutation(
      api.gameSessions.save,
      session(a.profileId, { wordsCorrect: -5, firstAttemptCorrect: 999, hintsUsed: Number.NaN, duration: 12.6 })
    );
    const [row] = await t.run((ctx) => ctx.db.query("game_sessions").collect());
    expect(row).toMatchObject({ wordsAttempted: 30, wordsCorrect: 0, firstAttemptCorrect: 0, hintsUsed: 0, duration: 13 });
  });

  test("first-try and correct counts never exceed words attempted", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await a.client.mutation(
      api.gameSessions.save,
      session(a.profileId, { wordsAttempted: 10, wordsCorrect: 50, firstAttemptCorrect: 40 })
    );
    const [row] = await t.run((ctx) => ctx.db.query("game_sessions").collect());
    expect(row).toMatchObject({ wordsAttempted: 10, wordsCorrect: 10, firstAttemptCorrect: 10 });
  });
});

describe("getForProfile", () => {
  test("owner-only, newest first, default 20, honours limit", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    for (let i = 0; i < 25; i++) {
      vi.setSystemTime(1_000_000 + i * 1000);
      await a.client.mutation(api.gameSessions.save, session(a.profileId, { boardsPlayed: i }));
    }
    expect(await t.query(api.gameSessions.getForProfile, { profileId: a.profileId })).toEqual([]);
    expect(
      await as(t, "user_b").query(api.gameSessions.getForProfile, { profileId: a.profileId })
    ).toEqual([]);

    const recent = await a.client.query(api.gameSessions.getForProfile, { profileId: a.profileId });
    expect(recent).toHaveLength(20);
    expect(recent[0].boardsPlayed).toBe(24);
    expect(recent.map((s) => s.completedAt)).toEqual(
      [...recent.map((s) => s.completedAt)].sort((x, y) => y - x)
    );
    expect(
      await a.client.query(api.gameSessions.getForProfile, { profileId: a.profileId, limit: 3 })
    ).toHaveLength(3);
  });

  test("only returns this reader's sessions", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family");
    const sibling = await t.run((ctx) =>
      ctx.db.insert("profiles", {
        userId: a.userId,
        name: "Sib",
        avatarEmoji: "🐶",
        currentLevel: "1A",
        boardsClearedAtLevel: 0,
        totalBoardsCleared: 0,
        coins: 0,
        lifetimeCoins: 0,
        streakDays: 0,
        accuracyHistory: [],
        wordMode: "mixed",
        hasSeenTutorial: false,
        selectedTheme: "ocean",
        createdAt: 1,
      })
    );
    await a.client.mutation(api.gameSessions.save, session(a.profileId));
    await a.client.mutation(api.gameSessions.save, session(sibling));
    const rows = await a.client.query(api.gameSessions.getForProfile, { profileId: a.profileId });
    expect(rows.map((r) => r.profileId)).toEqual([a.profileId]);
  });
});
