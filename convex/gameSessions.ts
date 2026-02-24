// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const save = mutation({
  args: {
    profileId: v.id("profiles"),
    level: v.string(),
    boardsPlayed: v.number(),
    wordsCorrect: v.number(),
    firstAttemptCorrect: v.number(),
    wordsAttempted: v.number(),
    wordsSkipped: v.number(),
    hintsUsed: v.number(),
    coinsEarned: v.number(),
    stickersEarned: v.number(),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("game_sessions", {
      ...args,
      completedAt: Date.now(),
    });
  },
});

export const getForProfile = query({
  args: {
    profileId: v.id("profiles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("game_sessions")
      .withIndex("by_profile_date", (q) => q.eq("profileId", args.profileId))
      .order("desc")
      .take(args.limit ?? 20);
    return sessions;
  },
});
