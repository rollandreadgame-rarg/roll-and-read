// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("stickers").collect();
  },
});

export const getForProfile = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profile_stickers")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();
  },
});

export const grantSticker = mutation({
  args: {
    profileId: v.id("profiles"),
    stickerId: v.id("stickers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("profile_stickers", {
      profileId: args.profileId,
      stickerId: args.stickerId,
      earnedAt: Date.now(),
    });
  },
});

// Pick a random unowned sticker matching the requested rarity and grant it.
// Falls back through rarity tiers (rare → uncommon → common) if the preferred
// tier is fully owned. Returns the granted sticker (or null if every sticker
// of every tier is already owned).
export const awardMilestoneSticker = mutation({
  args: {
    profileId: v.id("profiles"),
    preferredRarity: v.union(
      v.literal("common"),
      v.literal("uncommon"),
      v.literal("rare"),
      v.literal("legendary")
    ),
  },
  handler: async (ctx, args) => {
    const owned = await ctx.db
      .query("profile_stickers")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();
    const ownedIds = new Set(owned.map((ps) => String(ps.stickerId)));

    // Try preferred rarity first, then degrade. Common sits at the bottom so
    // milestones never silently no-op while plenty of common stickers remain.
    const tiers = ["legendary", "rare", "uncommon", "common"];
    const startIdx = tiers.indexOf(args.preferredRarity);
    const order = [...tiers.slice(startIdx), ...tiers.slice(0, startIdx)];

    for (const rarity of order) {
      const candidates = await ctx.db
        .query("stickers")
        .withIndex("by_rarity", (q) => q.eq("rarity", rarity))
        .collect();
      const unowned = candidates.filter((s) => !ownedIds.has(String(s._id)));
      if (unowned.length === 0) continue;

      const picked = unowned[Math.floor(Math.random() * unowned.length)];
      await ctx.db.insert("profile_stickers", {
        profileId: args.profileId,
        stickerId: picked._id,
        earnedAt: Date.now(),
      });
      return picked;
    }

    return null;
  },
});

// Grant a random UNOWNED sticker from a chosen category, preferring the requested
// rarity and falling through tiers within that category, then any unowned in it.
// Returns the granted sticker, or null if the category is fully collected.
export const awardStickerFromCategory = mutation({
  args: {
    profileId: v.id("profiles"),
    category: v.string(),
    preferredRarity: v.union(
      v.literal("common"),
      v.literal("uncommon"),
      v.literal("rare"),
      v.literal("legendary")
    ),
  },
  handler: async (ctx, args) => {
    const owned = await ctx.db
      .query("profile_stickers")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();
    const ownedIds = new Set(owned.map((ps) => String(ps.stickerId)));

    const inCategory = await ctx.db
      .query("stickers")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
    const unowned = inCategory.filter((s) => !ownedIds.has(String(s._id)));
    if (unowned.length === 0) return null;

    // Prefer the requested rarity, then degrade, then upgrade — so a high-tier
    // milestone still grants *something* from this category.
    const tiers = ["legendary", "rare", "uncommon", "common"];
    const startIdx = tiers.indexOf(args.preferredRarity);
    const order = [...tiers.slice(startIdx), ...tiers.slice(0, startIdx)];

    let pickPool = [];
    for (const rarity of order) {
      pickPool = unowned.filter((s) => s.rarity === rarity);
      if (pickPool.length) break;
    }
    if (!pickPool.length) pickPool = unowned;

    const picked = pickPool[Math.floor(Math.random() * pickPool.length)];
    await ctx.db.insert("profile_stickers", {
      profileId: args.profileId,
      stickerId: picked._id,
      earnedAt: Date.now(),
    });
    return picked;
  },
});
