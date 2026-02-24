import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    plan: v.union(
      v.literal("free"),
      v.literal("individual"),
      v.literal("family"),
      v.literal("classroom")
    ),
    clerkSubscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  profiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    avatarEmoji: v.string(),
    currentLevel: v.string(),
    boardsClearedAtLevel: v.number(),
    totalBoardsCleared: v.number(),
    coins: v.number(),
    lifetimeCoins: v.number(),
    streakDays: v.number(),
    lastPlayedAt: v.optional(v.number()),
    accuracyHistory: v.array(v.number()),
    wordMode: v.union(
      v.literal("real"),
      v.literal("nonsense"),
      v.literal("mixed")
    ),
    hasSeenTutorial: v.boolean(),
    selectedTheme: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  word_lists: defineTable({
    word: v.string(),
    isNonsense: v.boolean(),
    level: v.string(),
    levelNumber: v.number(),
    coinValue: v.number(),
    phonicFamily: v.string(),
    phonicPattern: v.string(),
  })
    .index("by_level", ["level"])
    .index("by_level_nonsense", ["level", "isNonsense"]),

  word_bank: defineTable({
    profileId: v.id("profiles"),
    wordId: v.id("word_lists"),
    word: v.string(),
    level: v.string(),
    isNonsense: v.boolean(),
    coinValue: v.number(),
    needsPractice: v.boolean(),
    firstEarned: v.number(),
    timesCorrect: v.number(),
  })
    .index("by_profile", ["profileId"])
    .index("by_profile_word", ["profileId", "wordId"]),

  stickers: defineTable({
    name: v.string(),
    category: v.string(),
    rarity: v.union(
      v.literal("common"),
      v.literal("uncommon"),
      v.literal("rare"),
      v.literal("legendary")
    ),
    emoji: v.string(),
    coinCost: v.number(),
    isAnimated: v.boolean(),
    isPaidOnly: v.boolean(),
  })
    .index("by_category", ["category"])
    .index("by_rarity", ["rarity"]),

  profile_stickers: defineTable({
    profileId: v.id("profiles"),
    stickerId: v.id("stickers"),
    earnedAt: v.number(),
  }).index("by_profile", ["profileId"]),

  game_sessions: defineTable({
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
    completedAt: v.number(),
  })
    .index("by_profile", ["profileId"])
    .index("by_profile_date", ["profileId", "completedAt"]),
});
