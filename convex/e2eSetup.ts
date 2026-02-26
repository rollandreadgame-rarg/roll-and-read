// @ts-nocheck
import { mutation } from "./_generated/server";

/**
 * E2E test setup — ensures a test user and profile exist.
 * Safe to call multiple times (idempotent).
 */
export const ensureTestUser = mutation({
  args: {},
  handler: async (ctx) => {
    const clerkId = "e2e_test_user";

    // Check if user exists
    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        clerkId,
        email: "e2e@rollnread.test",
        plan: "individual",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      user = await ctx.db.get(userId);
    }

    // Check if profile exists
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    let profile = profiles[0];

    if (!profile) {
      const profileId = await ctx.db.insert("profiles", {
        userId: user._id,
        name: "E2E Tester",
        avatarEmoji: "🤖",
        currentLevel: "1A",
        boardsClearedAtLevel: 2,
        totalBoardsCleared: 5,
        coins: 2500,
        lifetimeCoins: 5000,
        streakDays: 3,
        lastPlayedAt: Date.now(),
        accuracyHistory: [0.85, 0.9, 0.78, 0.92, 0.88],
        wordMode: "mixed",
        hasSeenTutorial: true,
        selectedTheme: "ocean",
        createdAt: Date.now(),
      });
      profile = await ctx.db.get(profileId);
    }

    return { userId: user._id, profileId: profile._id };
  },
});
