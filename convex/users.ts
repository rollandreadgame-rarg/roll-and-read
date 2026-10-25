// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSyncSecret, isCallerOrTrusted } from "./authHelpers";

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
    // The webhook's email comes from Clerk. A signed-in browser's comes from
    // its verified token (the "convex" JWT template's email claim), never
    // from the request, so nobody can file an account under someone else's
    // address. The webhook fills it in later if the token has none.
    const identity = await ctx.auth.getUserIdentity();
    const trusted = !identity;
    const email = trusted ? args.email : typeof identity.email === "string" ? identity.email : "";

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      if (trusted && email && existing.email !== email) {
        await ctx.db.patch(existing._id, { email, updatedAt: Date.now() });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email,
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
    // Webhook only. A signed-in browser must not be able to rewrite its own
    // stored email (it is how operators find accounts, e.g. adminTesters).
    await assertSyncSecret(args.syncSecret);
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
