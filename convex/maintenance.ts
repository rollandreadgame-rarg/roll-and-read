// @ts-nocheck
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertMaintenanceSecret } from "./authHelpers";
import { WORD_DATA } from "./seedWordLists";
import { cleanStickerName } from "./adminStickers";
import { isValidLevel, normalizeLevel } from "../lib/levels";

/**
 * Read-only diagnostic: how many words are in the table, whether the given
 * words exist (case-insensitive), and the full list of nonsense words at 1A.
 */
export const inspectWords = internalQuery({
  args: { words: v.array(v.string()) },
  handler: async (ctx, args) => {
    const targets = new Set(args.words.map((w) => w.toLowerCase()));
    const all = await ctx.db.query("word_lists").collect();
    const matches = all
      .filter((d) => targets.has(d.word.toLowerCase()))
      .map((d) => ({ word: d.word, level: d.level, isNonsense: d.isNonsense }));
    const level1ANonsense = all
      .filter((d) => d.level === "1A" && d.isNonsense)
      .map((d) => d.word)
      .sort();
    return {
      totalWordLists: all.length,
      matchesForTargets: matches,
      level1ANonsenseWords: level1ANonsense,
    };
  },
});

/**
 * Permanently remove words (by exact text, case-insensitive) from the live
 * word_lists table and any collected copies in word_bank. Used to scrub
 * inappropriate words that were seeded. Safe to re-run (no-ops if absent).
 */
export const purgeWords = internalMutation({
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

const WORD_FIELDS = ["word", "isNonsense", "level", "levelNumber", "coinValue", "phonicFamily", "phonicPattern"];

/**
 * Make the live word_lists table match WORD_DATA (the source files) exactly,
 * keyed by word text. Moved/relabelled words are patched in place so every
 * word_bank reference stays valid; duplicate rows are merged; words no longer
 * in the curriculum are deleted along with their word_bank rows.
 */
async function syncWordLists(ctx, dryRun) {
  const desired = new Map(WORD_DATA.map((w) => [w.word.toLowerCase(), w]));
  const groups = new Map();
  for (const doc of await ctx.db.query("word_lists").collect()) {
    const k = doc.word.toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(doc);
  }
  const out = { inserted: [], updated: [], merged: [], deleted: [], wordBankRepointed: 0, wordBankDeleted: 0, wordBankRelabelled: 0 };

  for (const [k, want] of desired) {
    const docs = groups.get(k) ?? [];
    if (docs.length === 0) {
      out.inserted.push(want.word);
      if (!dryRun) await ctx.db.insert("word_lists", { ...want });
      continue;
    }
    const keep = docs.find((d) => d.level === want.level) ?? docs[0];
    const changed = WORD_FIELDS.filter((f) => keep[f] !== want[f]);
    if (changed.length) {
      out.updated.push(`${want.word}: ${changed.map((f) => `${f} ${keep[f]}→${want[f]}`).join(", ")}`);
      if (!dryRun) {
        const patch = {};
        for (const f of WORD_FIELDS) patch[f] = want[f];
        await ctx.db.patch(keep._id, patch);
      }
    }
    // Merge duplicate rows of the same word into `keep`.
    for (const dup of docs.filter((d) => d._id !== keep._id)) {
      out.merged.push(`${dup.word} (${dup.level})`);
      for (const b of await ctx.db.query("word_bank").withIndex("by_word", (q) => q.eq("wordId", dup._id)).collect()) {
        const already = await ctx.db
          .query("word_bank")
          .withIndex("by_profile_word", (q) => q.eq("profileId", b.profileId).eq("wordId", keep._id))
          .first();
        if (!dryRun) {
          if (already) await ctx.db.delete(b._id);
          else await ctx.db.patch(b._id, { wordId: keep._id });
        }
        out.wordBankRepointed++;
      }
      if (!dryRun) await ctx.db.delete(dup._id);
    }
    // Keep collected copies' labels in step with the curriculum.
    if (changed.some((f) => f === "level" || f === "isNonsense" || f === "coinValue")) {
      for (const b of await ctx.db.query("word_bank").withIndex("by_word", (q) => q.eq("wordId", keep._id)).collect()) {
        if (!dryRun) await ctx.db.patch(b._id, { level: want.level, isNonsense: want.isNonsense, coinValue: want.coinValue });
        out.wordBankRelabelled++;
      }
    }
  }

  for (const [k, docs] of groups) {
    if (desired.has(k)) continue;
    for (const doc of docs) {
      out.deleted.push(`${doc.word} (${doc.level})`);
      for (const b of await ctx.db.query("word_bank").withIndex("by_word", (q) => q.eq("wordId", doc._id)).collect()) {
        if (!dryRun) await ctx.db.delete(b._id);
        out.wordBankDeleted++;
      }
      if (!dryRun) await ctx.db.delete(doc._id);
    }
  }
  return out;
}

// Readers who advanced into a sublevel that only existed in the old, wrong
// LEVEL_SEQUENCE (3E, 3F, 4D, 5C–5E) have no words; move them to a real one.
async function repairInvalidLevels(ctx, dryRun) {
  const repaired = [];
  for (const p of await ctx.db.query("profiles").collect()) {
    if (isValidLevel(p.currentLevel)) continue;
    const to = normalizeLevel(p.currentLevel);
    repaired.push(`${p._id}: ${p.currentLevel}→${to}`);
    if (!dryRun) await ctx.db.patch(p._id, { currentLevel: to, boardsClearedAtLevel: 0, accuracyHistory: [] });
  }
  return repaired;
}

async function cleanStickers(ctx, dryRun) {
  const renamed = [];
  for (const s of await ctx.db.query("stickers").collect()) {
    const clean = cleanStickerName(s.name, s.subcategory);
    if (clean !== s.name) {
      renamed.push(`${s.name} → ${clean}`);
      if (!dryRun) await ctx.db.patch(s._id, { name: clean });
    }
  }
  return renamed;
}

/**
 * One-shot data repair for the 2026-10-21 audit: word list sync, stranded
 * levels, sticker names. Idempotent. Public so it can be triggered without a
 * dashboard session, but gated on the maintenance key (see authHelpers).
 */
export const runDataFixes = mutation({
  args: { maintenanceSecret: v.string(), dryRun: v.boolean() },
  handler: async (ctx, args) => {
    await assertMaintenanceSecret(args.maintenanceSecret);
    return {
      dryRun: args.dryRun,
      words: await syncWordLists(ctx, args.dryRun),
      levels: await repairInvalidLevels(ctx, args.dryRun),
      stickers: await cleanStickers(ctx, args.dryRun),
    };
  },
});
