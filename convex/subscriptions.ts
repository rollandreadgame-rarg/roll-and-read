// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  PROFILE_LIMITS,
  isLevelAllowed,
  planFromLookupKey,
  isPaidStatus,
} from "./subscriptionConfig";
import { assertSyncSecret, isCallerOrTrusted, ownsProfile } from "./authHelpers";

// setStripeCustomerId / syncFromStripe MUST stay public because they're called
// from Next.js server routes via an unauthenticated ConvexHttpClient (webhook +
// checkout), which can't call internal functions and carries no ctx.auth
// identity. The trusted callers pass the shared sync secret (see authHelpers).

// Readable by the signed-in owner (billing/settings pages) or a trusted server
// route (checkout/portal) — never by an arbitrary caller with someone's clerkId.
export const getByClerkId = query({
  args: { clerkId: v.string(), syncSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!(await isCallerOrTrusted(ctx, args.clerkId, args.syncSecret))) return null;
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
    syncSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertSyncSecret(args.syncSecret);
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
    syncSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertSyncSecret(args.syncSecret);
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();
    if (!user) throw new Error(`No user for stripeCustomerId ${args.stripeCustomerId}`);

    const paid = isPaidStatus(args.subscriptionStatus);
    const plan = paid ? planFromLookupKey(args.priceLookupKey) : "free";

    // A late or retried event about an OLD subscription (e.g. the deletion of
    // an unpaid one after the customer started a new plan) must not downgrade
    // the subscription they are paying for now.
    if (
      !paid &&
      args.stripeSubscriptionId &&
      user.stripeSubscriptionId &&
      args.stripeSubscriptionId !== user.stripeSubscriptionId &&
      isPaidStatus(user.subscriptionStatus)
    ) {
      return { ignored: "stale subscription" };
    }

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
// Owner-only, like every other profile read (no peeking at other families'
// plans by profile id).
export const canAccessLevel = query({
  args: { profileId: v.id("profiles"), level: v.string() },
  handler: async (ctx, args) => {
    const owned = await ownsProfile(ctx, args.profileId);
    if (!owned) return false;
    return isLevelAllowed(owned.user.plan, args.level);
  },
});
