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
