// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const get = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.profileId);
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    avatarEmoji: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("profiles", {
      userId: args.userId,
      name: args.name,
      avatarEmoji: args.avatarEmoji,
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
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    profileId: v.id("profiles"),
    name: v.optional(v.string()),
    avatarEmoji: v.optional(v.string()),
    wordMode: v.optional(
      v.union(v.literal("real"), v.literal("nonsense"), v.literal("mixed"))
    ),
    selectedTheme: v.optional(v.string()),
    hasSeenTutorial: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { profileId, ...rest } = args;
    const updates = Object.fromEntries(
      Object.entries(rest).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(profileId, updates);
  },
});

export const remove = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.profileId);
  },
});

export const awardCoins = mutation({
  args: {
    profileId: v.id("profiles"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(args.profileId, {
      coins: profile.coins + args.amount,
      lifetimeCoins: profile.lifetimeCoins + args.amount,
    });
  },
});

export const spendCoins = mutation({
  args: {
    profileId: v.id("profiles"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");
    if (profile.coins < args.amount) throw new Error("Insufficient coins");

    await ctx.db.patch(args.profileId, {
      coins: profile.coins - args.amount,
    });
  },
});

export const advanceLevel = mutation({
  args: {
    profileId: v.id("profiles"),
    nextLevel: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(args.profileId, {
      currentLevel: args.nextLevel,
      boardsClearedAtLevel: 0,
      accuracyHistory: [],
      totalBoardsCleared: profile.totalBoardsCleared,
    });
  },
});

export const completedBoard = mutation({
  args: {
    profileId: v.id("profiles"),
    accuracy: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");

    const newHistory = [...profile.accuracyHistory, args.accuracy].slice(-10);

    await ctx.db.patch(args.profileId, {
      boardsClearedAtLevel: profile.boardsClearedAtLevel + 1,
      totalBoardsCleared: profile.totalBoardsCleared + 1,
      accuracyHistory: newHistory,
      lastPlayedAt: Date.now(),
    });
  },
});
