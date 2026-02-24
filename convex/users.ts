// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    plan: v.optional(
      v.union(
        v.literal("free"),
        v.literal("individual"),
        v.literal("family"),
        v.literal("classroom")
      )
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      plan: args.plan ?? "free",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

export const updatePlan = mutation({
  args: {
    clerkId: v.string(),
    plan: v.union(
      v.literal("free"),
      v.literal("individual"),
      v.literal("family"),
      v.literal("classroom")
    ),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      plan: args.plan,
      clerkSubscriptionId: args.subscriptionId,
      subscriptionStatus: args.subscriptionStatus,
      updatedAt: Date.now(),
    });
  },
});
