// @ts-nocheck
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getForLevel = query({
  args: {
    level: v.string(),
    wordMode: v.union(v.literal("real"), v.literal("nonsense"), v.literal("mixed")),
  },
  handler: async (ctx, args) => {
    if (args.wordMode === "real") {
      return await ctx.db
        .query("word_lists")
        .withIndex("by_level_nonsense", (q) =>
          q.eq("level", args.level).eq("isNonsense", false)
        )
        .collect();
    } else if (args.wordMode === "nonsense") {
      return await ctx.db
        .query("word_lists")
        .withIndex("by_level_nonsense", (q) =>
          q.eq("level", args.level).eq("isNonsense", true)
        )
        .collect();
    }
    return await ctx.db
      .query("word_lists")
      .withIndex("by_level", (q) => q.eq("level", args.level))
      .collect();
  },
});

export const getForLevels = query({
  args: {
    levels: v.array(v.string()),
    wordMode: v.union(v.literal("real"), v.literal("nonsense"), v.literal("mixed")),
  },
  handler: async (ctx, args) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    for (const level of args.levels) {
      let words;
      if (args.wordMode === "real") {
        words = await ctx.db
          .query("word_lists")
          .withIndex("by_level_nonsense", (q) =>
            q.eq("level", level).eq("isNonsense", false)
          )
          .collect();
      } else if (args.wordMode === "nonsense") {
        words = await ctx.db
          .query("word_lists")
          .withIndex("by_level_nonsense", (q) =>
            q.eq("level", level).eq("isNonsense", true)
          )
          .collect();
      } else {
        words = await ctx.db
          .query("word_lists")
          .withIndex("by_level", (q) => q.eq("level", level))
          .collect();
      }
      results.push(...words);
    }
    return results;
  },
});
