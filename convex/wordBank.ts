// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getForProfile = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("word_bank")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .order("desc")
      .collect();
  },
});

export const addWord = mutation({
  args: {
    profileId: v.id("profiles"),
    wordId: v.id("word_lists"),
    word: v.string(),
    level: v.string(),
    isNonsense: v.boolean(),
    coinValue: v.number(),
    needsPractice: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("word_bank")
      .withIndex("by_profile_word", (q) =>
        q.eq("profileId", args.profileId).eq("wordId", args.wordId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        timesCorrect: existing.timesCorrect + 1,
        needsPractice: args.needsPractice,
      });
      return existing._id;
    }

    return await ctx.db.insert("word_bank", {
      profileId: args.profileId,
      wordId: args.wordId,
      word: args.word,
      level: args.level,
      isNonsense: args.isNonsense,
      coinValue: args.coinValue,
      needsPractice: args.needsPractice,
      firstEarned: Date.now(),
      timesCorrect: 1,
    });
  },
});

export const getTotalValue = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    const words = await ctx.db
      .query("word_bank")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();
    return words.reduce((sum, w) => sum + w.coinValue, 0);
  },
});

// Mark a single word as no-longer-needing-practice (Practice mode "Got it" tap).
export const markPracticed = mutation({
  args: {
    wordBankId: v.id("word_bank"),
    stillNeedsPractice: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.wordBankId);
    if (!existing) throw new Error("Word bank entry not found");
    await ctx.db.patch(args.wordBankId, {
      needsPractice: args.stillNeedsPractice,
      timesCorrect: args.stillNeedsPractice
        ? existing.timesCorrect
        : existing.timesCorrect + 1,
    });
  },
});
