// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireProfileOwner, ownsProfile } from "./authHelpers";
import { levelIndex, normalizeLevel } from "../lib/levels";
import { BOARD_SIZE } from "../lib/game/levelUp";

// Answers closer together than this earn no coins: a child has to hear the
// word (the game itself waits ~600ms between words), so faster is a script.
export const MIN_ANSWER_GAP_MS = 400;
// Coins for a practice word read correctly (Practice "Got it").
export const PRACTICE_COIN_REWARD = 3;

// Counts one answer toward the board in progress and pays the word's coins.
// Coins need: a correct read, a word within the reader's reach (current level,
// the next one, or review/practice below), a board not already full, and a
// human pace between answers.
async function recordAnswer(ctx, profile, wordDoc, { correct, firstTry }) {
  const now = Date.now();
  const boardWords = profile.boardWords ?? 0;
  const reach = levelIndex(normalizeLevel(profile.currentLevel)) + 1;
  const inReach = levelIndex(normalizeLevel(wordDoc.level)) <= reach;
  if (!inReach || boardWords >= BOARD_SIZE) return;
  const patch = {
    boardWords: boardWords + 1,
    boardFirstTry: (profile.boardFirstTry ?? 0) + (correct && firstTry ? 1 : 0),
  };
  if (correct && now - (profile.lastCoinAt ?? 0) >= MIN_ANSWER_GAP_MS) {
    patch.coins = profile.coins + wordDoc.coinValue;
    patch.lifetimeCoins = profile.lifetimeCoins + wordDoc.coinValue;
    patch.lastCoinAt = now;
  }
  await ctx.db.patch(profile._id, patch);
}

export const getForProfile = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    if (!(await ownsProfile(ctx, args.profileId))) return [];
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
    // Wrong taps before the right one. Optional for older clients.
    missesBeforeCorrect: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfileOwner(ctx, args.profileId);
    // Word text, level and coin value come from the curriculum, never from
    // the client. A word removed from the curriculum mid-game is not banked.
    const wordDoc = await ctx.db.get(args.wordId);
    if (!wordDoc) return null;
    await recordAnswer(ctx, profile, wordDoc, {
      correct: !args.needsPractice,
      firstTry: !args.missesBeforeCorrect,
    });
    const existing = await ctx.db
      .query("word_bank")
      .withIndex("by_profile_word", (q) =>
        q.eq("profileId", args.profileId).eq("wordId", args.wordId)
      )
      .first();

    // Practice status: skipped (7 misses) or needed the hint (3+ misses) →
    // practise it; read on the first try → done practising; one or two misses
    // → no change. Older clients send only needsPractice.
    const misses = args.missesBeforeCorrect;
    const needsPractice = args.needsPractice
      ? true
      : misses === undefined || misses === 0
        ? false
        : misses >= 3
          ? true
          : (existing?.needsPractice ?? false);

    // A word skipped after 7 misses is recorded for practice but NOT counted
    // as read correctly — it isn't "learned" yet.
    if (existing) {
      await ctx.db.patch(existing._id, {
        timesCorrect: existing.timesCorrect + (args.needsPractice ? 0 : 1),
        needsPractice,
      });
      return existing._id;
    }

    return await ctx.db.insert("word_bank", {
      profileId: args.profileId,
      wordId: args.wordId,
      word: wordDoc.word,
      level: wordDoc.level,
      isNonsense: wordDoc.isNonsense,
      coinValue: wordDoc.coinValue,
      needsPractice,
      firstEarned: Date.now(),
      timesCorrect: args.needsPractice ? 0 : 1,
    });
  },
});

export const getTotalValue = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    if (!(await ownsProfile(ctx, args.profileId))) return 0;
    const words = await ctx.db
      .query("word_bank")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();
    return words.reduce((sum, w) => sum + (w.timesCorrect > 0 ? w.coinValue : 0), 0);
  },
});

// Words this reader is still practising, as full word-list entries, so the
// game can put them back on the board. Only levels up to the reader's current
// one, and no silly words for a real-words-only reader.
export const getPracticeWords = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    const owned = await ownsProfile(ctx, args.profileId);
    if (!owned) return [];
    const { profile } = owned;
    const maxIdx = levelIndex(normalizeLevel(profile.currentLevel));
    const entries = await ctx.db
      .query("word_bank")
      .withIndex("by_profile_practice", (q) =>
        q.eq("profileId", args.profileId).eq("needsPractice", true)
      );
    // Cap AFTER filtering, so words above the reader's level (e.g. after a
    // grown-up moved them down) don't crowd out the eligible ones.
    const words = [];
    for await (const e of entries) {
      const w = await ctx.db.get(e.wordId);
      if (!w || levelIndex(w.level) > maxIdx) continue;
      if (profile.wordMode === "real" && w.isNonsense) continue;
      words.push(w);
      if (words.length >= 40) break;
    }
    return words;
  },
});

// Learned-word count + total value for the in-game status bar, so the play
// page doesn't download the whole word bank on every correct tap.
export const getStats = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    if (!(await ownsProfile(ctx, args.profileId))) return { count: 0, value: 0 };
    const words = await ctx.db
      .query("word_bank")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();
    let count = 0;
    let value = 0;
    for (const w of words) {
      if (w.timesCorrect > 0) {
        count++;
        value += w.coinValue;
      }
    }
    return { count, value };
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
    const { profile } = await requireProfileOwner(ctx, existing.profileId);
    // Reading a word that was waiting for practice pays a small reward, once.
    if (existing.needsPractice && !args.stillNeedsPractice) {
      await ctx.db.patch(profile._id, {
        coins: profile.coins + PRACTICE_COIN_REWARD,
        lifetimeCoins: profile.lifetimeCoins + PRACTICE_COIN_REWARD,
      });
    }
    await ctx.db.patch(args.wordBankId, {
      needsPractice: args.stillNeedsPractice,
      timesCorrect: args.stillNeedsPractice
        ? existing.timesCorrect
        : existing.timesCorrect + 1,
    });
  },
});
