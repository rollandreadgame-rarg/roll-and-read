// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  PROFILE_LIMITS,
  isLevelAllowed,
  planFromLookupKey,
  isPaidStatus,
} from "./subscriptionConfig";

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return null;

    const profileCount = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return {
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus ?? null,
      stripeCustomerId: user.stripeCustomerId ?? null,
      stripeSubscriptionId: user.stripeSubscriptionId ?? null,
      currentPeriodEnd: user.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd ?? false,
      profileLimit: PROFILE_LIMITS[user.plan],
      profileCount: profileCount.length,
    };
  },
});

export const setStripeCustomerId = mutation({
  args: {
    clerkId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
      updatedAt: Date.now(),
    });
  },
});

// Called by the Stripe webhook handler after verifying signature.
// Maps the subscription's price lookup_key → our plan tier.
export const syncFromStripe = mutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    priceLookupKey: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();
    if (!user) throw new Error(`No user for stripeCustomerId ${args.stripeCustomerId}`);

    const paid = isPaidStatus(args.subscriptionStatus);
    const plan = paid ? planFromLookupKey(args.priceLookupKey) : "free";

    await ctx.db.patch(user._id, {
      plan,
      subscriptionStatus: args.subscriptionStatus ?? undefined,
      stripeSubscriptionId: args.stripeSubscriptionId ?? undefined,
      stripePriceId: args.stripePriceId ?? undefined,
      currentPeriodEnd: args.currentPeriodEnd ?? undefined,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? false,
      updatedAt: Date.now(),
    });
  },
});

// UI helper — does this profile's user's plan allow the requested level?
export const canAccessLevel = query({
  args: { profileId: v.id("profiles"), level: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) return false;
    const user = await ctx.db.get(profile.userId);
    if (!user) return false;
    return isLevelAllowed(user.plan, args.level);
  },
});
