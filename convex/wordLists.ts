// @ts-nocheck
import { query } from "./_generated/server";
import { v } from "convex/values";
import { getReviewLevels } from "../lib/levels";

const wordModeArg = v.union(v.literal("real"), v.literal("nonsense"), v.literal("mixed"));

async function wordsForLevel(ctx, level, wordMode) {
  if (wordMode === "real") {
    return await ctx.db
      .query("word_lists")
      .withIndex("by_level_nonsense", (q) => q.eq("level", level).eq("isNonsense", false))
      .collect();
  }
  if (wordMode === "nonsense") {
    return await ctx.db
      .query("word_lists")
      .withIndex("by_level_nonsense", (q) => q.eq("level", level).eq("isNonsense", true))
      .collect();
  }
  return await ctx.db
    .query("word_lists")
    .withIndex("by_level", (q) => q.eq("level", level))
    .collect();
}

// Deterministic pick of `n` items (queries can't use unseeded randomness
// usefully, and the client shuffles again anyway).
function pick(items, n, seed) {
  const out = [...items];
  let s = (seed * 2654435761) >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, n);
}

// Review words from earlier sublevels: mostly the two just before this one,
// some from three older ones that rotate with `seed`. The client takes a few
// per board. Silly-word readers review with real and silly words mixed.
export const getReviewPool = query({
  args: { level: v.string(), wordMode: wordModeArg, seed: v.number() },
  handler: async (ctx, args) => {
    const { recent, older } = getReviewLevels(args.level, args.seed);
    const mode = args.wordMode === "nonsense" ? "mixed" : args.wordMode;
    const out = [];
    for (const level of recent) out.push(...pick(await wordsForLevel(ctx, level, mode), 15, args.seed));
    for (const level of older) out.push(...pick(await wordsForLevel(ctx, level, mode), 8, args.seed));
    return out;
  },
});

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
