// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { PROFILE_LIMITS, isLevelAllowed } from "./subscriptionConfig";
import { getNextLevel, isValidLevel, normalizeLevel } from "../lib/levels";
import { MIN_BOARD_ANSWERS, checkLevelAdvancement } from "../lib/game/levelUp";
import { getMilestonesForBoard } from "../lib/game/milestones";
import {
  requireUser,
  requireProfileOwner,
  getCallerUser,
  ownsProfile,
} from "./authHelpers";

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await getCallerUser(ctx);
    if (!user || String(user._id) !== String(args.userId)) return [];
    return await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const get = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    const owned = await ownsProfile(ctx, args.profileId);
    return owned ? owned.profile : null;
  },
});

// Reader names show on cards and reports; keep them short and non-blank.
export const MAX_NAME_LENGTH = 30;
function cleanName(name: string): string {
  const n = name.replace(/\s+/g, " ").trim();
  if (!n || n.length > MAX_NAME_LENGTH) throw new Error(`INVALID_NAME: 1-${MAX_NAME_LENGTH} characters`);
  return n;
}
function cleanAvatar(avatar: string): string {
  if (!avatar || avatar.length > 16) throw new Error("INVALID_AVATAR");
  return avatar;
}
const THEMES = ["ocean", "space", "forest", "candy", "classic"];

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    avatarEmoji: v.string(),
    // Grown-up's chosen starting sublevel (defaults to 1A).
    startingLevel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (String(user._id) !== String(args.userId)) throw new Error("Forbidden");

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const limit = PROFILE_LIMITS[user.plan];
    if (existing.length >= limit) {
      throw new Error(
        `PROFILE_LIMIT_REACHED: Your ${user.plan} plan allows ${limit} profile${limit === 1 ? "" : "s"}. Upgrade to add more.`
      );
    }

    const startingLevel = args.startingLevel ?? "1A";
    if (!isValidLevel(startingLevel)) throw new Error(`Invalid level ${startingLevel}`);
    if (!isLevelAllowed(user.plan, startingLevel)) {
      throw new Error(
        `LEVEL_LOCKED: Your ${user.plan} plan only includes Level 1. Upgrade to unlock ${startingLevel}.`
      );
    }

    return await ctx.db.insert("profiles", {
      userId: args.userId,
      name: cleanName(args.name),
      avatarEmoji: cleanAvatar(args.avatarEmoji),
      currentLevel: startingLevel,
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
    await requireProfileOwner(ctx, profileId);
    if (rest.name !== undefined) rest.name = cleanName(rest.name);
    if (rest.avatarEmoji !== undefined) rest.avatarEmoji = cleanAvatar(rest.avatarEmoji);
    if (rest.selectedTheme !== undefined && !THEMES.includes(rest.selectedTheme)) {
      throw new Error("INVALID_THEME");
    }
    const updates = Object.fromEntries(
      Object.entries(rest).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(profileId, updates);
  },
});

export const remove = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    await requireProfileOwner(ctx, args.profileId);
    // Cascade delete related records
    const wordBankEntries = await ctx.db
      .query("word_bank")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();
    for (const entry of wordBankEntries) {
      await ctx.db.delete(entry._id);
    }

    const stickers = await ctx.db
      .query("profile_stickers")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();
    for (const sticker of stickers) {
      await ctx.db.delete(sticker._id);
    }

    const sessions = await ctx.db
      .query("game_sessions")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    await ctx.db.delete(args.profileId);
  },
});

// Coins are awarded by the server when a word is read (wordBank.addWord) or
// practised (wordBank.markPracticed). Kept so older browsers that still call
// it don't error; it no longer changes anything.
export const awardCoins = mutation({
  args: {
    profileId: v.id("profiles"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    await requireProfileOwner(ctx, args.profileId);
    return null;
  },
});

// A fresh board starts: forget answers from a board that was abandoned.
export const startBoard = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    await requireProfileOwner(ctx, args.profileId);
    await ctx.db.patch(args.profileId, { boardWords: 0, boardFirstTry: 0 });
  },
});

export const spendCoins = mutation({
  args: {
    profileId: v.id("profiles"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    // A negative "spend" would mint coins; NaN would corrupt the balance.
    if (!Number.isFinite(args.amount) || args.amount < 0) {
      throw new Error("Invalid coin amount");
    }
    const { profile } = await requireProfileOwner(ctx, args.profileId);
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
    const { user, profile } = await requireProfileOwner(ctx, args.profileId);

    // Only the real next sublevel — or, for a reader stranded on a retired
    // sublevel, the level it maps to — is a legal move.
    const legal = isValidLevel(profile.currentLevel)
      ? getNextLevel(profile.currentLevel)
      : normalizeLevel(profile.currentLevel);
    if (!isValidLevel(args.nextLevel) || args.nextLevel !== legal) {
      throw new Error(`Invalid level advance ${profile.currentLevel} → ${args.nextLevel}`);
    }
    // Moving up is earned on the server's record of finished boards. (A
    // grown-up can still place a reader anywhere their plan allows: setLevel.)
    if (
      isValidLevel(profile.currentLevel) &&
      !checkLevelAdvancement(profile.boardsClearedAtLevel, profile.accuracyHistory ?? [])
    ) {
      throw new Error("NOT_READY: this reader hasn't met the level-up goal yet");
    }

    if (!isLevelAllowed(user.plan, args.nextLevel)) {
      throw new Error(
        `LEVEL_LOCKED: Your ${user.plan} plan only includes Level 1. Upgrade to unlock ${args.nextLevel}.`
      );
    }

    await ctx.db.patch(args.profileId, {
      currentLevel: args.nextLevel,
      boardsClearedAtLevel: 0,
      accuracyHistory: [],
    });
  },
});

// A grown-up places a reader at any sublevel their plan includes (up for a
// reader who already knows the early patterns, down for one who needs more
// practice). Progress toward the next level starts over.
export const setLevel = mutation({
  args: {
    profileId: v.id("profiles"),
    level: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, profile } = await requireProfileOwner(ctx, args.profileId);
    if (!isValidLevel(args.level)) throw new Error(`Invalid level ${args.level}`);
    if (!isLevelAllowed(user.plan, args.level)) {
      throw new Error(
        `LEVEL_LOCKED: Your ${user.plan} plan only includes Level 1. Upgrade to unlock ${args.level}.`
      );
    }
    if (profile.currentLevel === args.level) return;
    await ctx.db.patch(args.profileId, {
      currentLevel: args.level,
      boardsClearedAtLevel: 0,
      accuracyHistory: [],
    });
  },
});

// Most sticker picks a reader can have waiting at once.
const MAX_PENDING_REWARDS = 10;

export const completedBoard = mutation({
  args: {
    profileId: v.id("profiles"),
    // Ignored once the server has counted the board's answers (see addWord);
    // used only for readers mid-board when that counting was added.
    accuracy: v.number(),
    // Player's local calendar day "YYYY-MM-DD". Streaks follow the family's
    // day, not UTC (UTC flips at 7pm US Central). Optional for old clients.
    localDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, profile } = await requireProfileOwner(ctx, args.profileId);

    // A board counts only once (nearly) every word on it was answered.
    const counted = typeof profile.boardWords === "number";
    if (counted && profile.boardWords < MIN_BOARD_ANSWERS) {
      throw new Error("BOARD_NOT_FINISHED");
    }
    const clientAccuracy = Number.isFinite(args.accuracy) ? Math.min(1, Math.max(0, args.accuracy)) : 0;
    const accuracy = counted
      ? Math.min(1, (profile.boardFirstTry ?? 0) / profile.boardWords)
      : clientAccuracy;
    const newHistory = [...(profile.accuracyHistory ?? []), accuracy].slice(-10);

    const now = Date.now();
    const MS_PER_DAY = 86_400_000;
    const validDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const utcDate = (ts) => new Date(ts).toISOString().slice(0, 10);
    const today = validDate(args.localDate) ? args.localDate : utcDate(now);
    const lastDay = validDate(profile.lastPlayedLocalDate)
      ? profile.lastPlayedLocalDate
      : profile.lastPlayedAt
        ? utcDate(profile.lastPlayedAt)
        : null;

    let newStreak = profile.streakDays;
    if (!lastDay) {
      newStreak = 1;
    } else {
      const dayDiff = Math.round((Date.parse(today) - Date.parse(lastDay)) / MS_PER_DAY);
      if (dayDiff <= 0) {
        // Already played today (or the clock/timezone moved back) — keep streak
        newStreak = Math.max(profile.streakDays, 1);
      } else if (dayDiff === 1) {
        // Consecutive day — extend streak
        newStreak = profile.streakDays + 1;
      } else {
        // Gap of 2+ days — reset
        newStreak = 1;
      }
    }

    const boardsAtLevel = profile.boardsClearedAtLevel + 1;
    const totalBoardsCleared = profile.totalBoardsCleared + 1;
    const next = isValidLevel(profile.currentLevel) ? getNextLevel(profile.currentLevel) : null;
    const passed = !!next && checkLevelAdvancement(boardsAtLevel, newHistory);
    const levelUp = passed && isLevelAllowed(user.plan, next) ? next : null;

    const milestones = getMilestonesForBoard({
      totalBoardsCleared,
      accuracy,
      previousStreakDays: profile.streakDays,
      newStreakDays: newStreak,
      isLevelUp: !!levelUp,
    });
    const pendingRewards = [...(profile.pendingRewards ?? []), ...milestones]
      .slice(-MAX_PENDING_REWARDS)
      .map(({ type, rarity, label }) => ({ type, rarity, label }));

    await ctx.db.patch(args.profileId, {
      boardsClearedAtLevel: boardsAtLevel,
      totalBoardsCleared,
      accuracyHistory: newHistory,
      streakDays: newStreak,
      lastPlayedAt: now,
      lastPlayedLocalDate: today,
      boardWords: 0,
      boardFirstTry: 0,
      pendingRewards,
    });

    return {
      newStreakDays: newStreak,
      previousStreakDays: profile.streakDays,
      totalBoardsCleared,
      accuracy,
      milestones,
      // The next sublevel when this board earned it and the plan includes it.
      levelUp,
      // Earned, but the plan doesn't include the next level.
      levelLocked: passed && !levelUp,
    };
  },
});
