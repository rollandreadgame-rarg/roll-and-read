// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { isCallerOrTrusted } from "./authHelpers";

// Called by the Clerk webhook (trusted, sends the sync secret) and by the
// signed-in client as a fallback when the webhook lags. New users always start
// on "free" — only Stripe sync (or admin comping) can grant a paid plan. The
// `plan` arg is accepted for backward compatibility but ignored.
export const createUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    plan: v.optional(v.string()),
    syncSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isCallerOrTrusted(ctx, args.clerkId, args.syncSecret))) {
      throw new Error("Forbidden");
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      plan: "free",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    // Only ever return the caller's own record. Prevents enumerating other
    // users' email/plan by passing an arbitrary clerkId.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.clerkId) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return null;
    // Never expose PIN secrets to the client; expose only whether one exists.
    const { parentPinHash, parentPinAttempts, parentPinLockedUntil, ...safe } =
      user;
    return { ...safe, hasParentPin: Boolean(parentPinHash) };
  },
});

// Record that the signed-in grown-up has seen the /teacher onboarding tour, so
// it only auto-launches once. Takes no ids: the caller is resolved from
// ctx.auth, so nobody can flip another account's flag.
export const markTeacherTourSeen = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return; // user row not bootstrapped yet; nothing to mark
    if (user.hasSeenTeacherTour === true) return;
    await ctx.db.patch(user._id, {
      hasSeenTeacherTour: true,
      updatedAt: Date.now(),
    });
  },
});

// Sync a user's email when Clerk fires user.updated.
// IMPORTANT: never touches `plan` — Stripe (via subscriptions.syncFromStripe)
// is the single source of truth for billing tier. Writing plan here would
// downgrade paying customers to "free" whenever they edit their Clerk profile.
export const updateEmailFromClerk = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    syncSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isCallerOrTrusted(ctx, args.clerkId, args.syncSecret))) {
      throw new Error("Forbidden");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return; // nothing to sync yet; user.created will handle it

    await ctx.db.patch(user._id, {
      email: args.email,
      updatedAt: Date.now(),
    });
  },
});
