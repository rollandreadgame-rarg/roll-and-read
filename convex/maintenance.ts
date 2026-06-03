// @ts-nocheck
import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Permanently remove words (by exact text, case-insensitive) from the live
 * word_lists table and any collected copies in word_bank. Used to scrub
 * inappropriate words that were seeded. Safe to re-run (no-ops if absent).
 */
export const purgeWords = mutation({
  args: { words: v.array(v.string()) },
  handler: async (ctx, args) => {
    const targets = new Set(args.words.map((w) => w.toLowerCase()));
    const removed: Record<string, number> = {};
    let wordBankRemoved = 0;

    const all = await ctx.db.query("word_lists").collect();
    for (const doc of all) {
      if (targets.has(doc.word.toLowerCase())) {
        // delete any word_bank entries pointing at this word doc
        const banked = await ctx.db
          .query("word_bank")
          .filter((q) => q.eq(q.field("wordId"), doc._id))
          .collect();
        for (const b of banked) {
          await ctx.db.delete(b._id);
          wordBankRemoved++;
        }
        await ctx.db.delete(doc._id);
        removed[doc.word] = (removed[doc.word] ?? 0) + 1;
      }
    }

    // sweep word_bank for any stragglers matching by text (defensive)
    const banks = await ctx.db.query("word_bank").collect();
    for (const b of banks) {
      if (targets.has(b.word.toLowerCase())) {
        await ctx.db.delete(b._id);
        wordBankRemoved++;
      }
    }

    return { wordListsRemoved: removed, wordBankRemoved };
  },
});
