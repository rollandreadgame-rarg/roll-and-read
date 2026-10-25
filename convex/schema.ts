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
    parentPinHash: v.optional(v.string()),
    parentPinAttempts: v.optional(v.number()),
    parentPinLockedUntil: v.optional(v.number()),
    compedTester: v.optional(v.boolean()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    // Grown-up dashboard welcome tour (on the adult, not the child profile).
    hasSeenTeacherTour: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

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
    // Player's local calendar day (YYYY-MM-DD) of lastPlayedAt, for streaks.
    lastPlayedLocalDate: v.optional(v.string()),
    accuracyHistory: v.array(v.number()),
    wordMode: v.union(
      v.literal("real"),
      v.literal("nonsense"),
      v.literal("mixed")
    ),
    hasSeenTutorial: v.boolean(),
    selectedTheme: v.string(),
    createdAt: v.number(),
    // Server-side record of the board in progress (wordBank.addWord counts
    // answers; completedBoard needs a full board and resets them). Undefined
    // on readers who haven't played since this was added.
    boardWords: v.optional(v.number()),
    boardFirstTry: v.optional(v.number()),
    lastCoinAt: v.optional(v.number()),
    // Sticker picks earned by finished boards and not yet claimed.
    pendingRewards: v.optional(
      v.array(v.object({ type: v.string(), rarity: v.string(), label: v.string() }))
    ),
  })
    .index("by_user", ["userId"])
    // Retention clean-up (dataLifecycle.purgeInactiveReaders).
    .index("by_last_played", ["lastPlayedAt"]),

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
    .index("by_profile_word", ["profileId", "wordId"])
    .index("by_profile_practice", ["profileId", "needsPractice"])
    .index("by_word", ["wordId"]),

  stickers: defineTable({
    name: v.string(),
    category: v.string(),
    subcategory: v.optional(v.string()),
    rarity: v.union(
      v.literal("common"),
      v.literal("uncommon"),
      v.literal("rare"),
      v.literal("legendary")
    ),
    emoji: v.optional(v.string()),
    imageThumbUrl: v.optional(v.string()),
    imageFullUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    coinCost: v.number(),
    isAnimated: v.boolean(),
    isPaidOnly: v.boolean(),
  })
    .index("by_category", ["category"])
    .index("by_rarity", ["rarity"])
    .index("by_subcategory", ["subcategory"]),

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

  // Client-side crashes reported by signed-in browsers (no child data: just
  // the error text, page path and browser).
  client_errors: defineTable({
    message: v.string(),
    stack: v.optional(v.string()),
    path: v.string(),
    userAgent: v.string(),
    clerkId: v.string(),
    at: v.number(),
  })
    .index("by_at", ["at"])
    .index("by_clerk_at", ["clerkId", "at"]),
});
