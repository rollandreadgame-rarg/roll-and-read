// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  PROFILE_LIMITS,
  isLevelAllowed,
  planFromLookupKey,
  isPaidStatus,
} from "./subscriptionConfig";

// These two mutations MUST stay public because they're called from Next.js
// server routes via an unauthenticated ConvexHttpClient (webhook + checkout),
// which can't call internal functions and carries no ctx.auth identity. To
// stop anyone from calling them from a browser console to grant themselves a
// paid plan, the trusted callers pass a shared secret.
//
// The trusted callers (the Vercel webhook + checkout routes) send the raw
// secret from their own CONVEX_SYNC_SECRET env var. We verify it by comparing
// its SHA-256 against a baked-in hash — a hash is not a credential, so it's
// safe to keep in source, and Convex never has to store the secret itself.
const SYNC_SECRET_SHA256 =
  "55f872a2c31c47ce8dc5e7dc5ecc89784b2ec424fe468e35ff490a54b664e05f";

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function assertSyncSecret(provided) {
  if (typeof provided !== "string" || provided.length === 0) {
    throw new Error("Forbidden");
  }
  const h = await sha256Hex(provided);
  if (h !== SYNC_SECRET_SHA256) throw new Error("Forbidden");
}

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
