// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireProfileOwner, ownsProfile } from "./authHelpers";

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
    await requireProfileOwner(ctx, args.profileId);
    // Clamp rather than reject, so a client glitch never loses a real session,
    // but the dashboard never shows negative counts or accuracy above 100%.
    const n = (x: number) => (Number.isFinite(x) && x > 0 ? Math.round(x) : 0);
    const wordsAttempted = n(args.wordsAttempted);
    const wordsCorrect = Math.min(n(args.wordsCorrect), wordsAttempted);
    return await ctx.db.insert("game_sessions", {
      profileId: args.profileId,
      level: args.level,
      boardsPlayed: n(args.boardsPlayed),
      wordsAttempted,
      wordsCorrect,
      firstAttemptCorrect: Math.min(n(args.firstAttemptCorrect), wordsCorrect),
      wordsSkipped: n(args.wordsSkipped),
      hintsUsed: n(args.hintsUsed),
      coinsEarned: n(args.coinsEarned),
      stickersEarned: n(args.stickersEarned),
      duration: n(args.duration),
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
    if (!(await ownsProfile(ctx, args.profileId))) return [];
    const sessions = await ctx.db
      .query("game_sessions")
      .withIndex("by_profile_date", (q) => q.eq("profileId", args.profileId))
      .order("desc")
      .take(args.limit ?? 20);
    return sessions;
  },
});
