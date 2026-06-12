// @ts-nocheck
// Admin helpers for comping testers WITHOUT Stripe.
// Run from the CLI with a prod deploy key, e.g.:
//   npx convex run adminTesters:grantPlan '{"email":"tester@example.com","plan":"family"}'
//   npx convex run adminTesters:listUsers
//   npx convex run adminTesters:revokeToFree '{"email":"tester@example.com"}'
//
// The tester must SIGN UP first (so a users row exists). grantPlan looks them
// up by email, sets their plan + an "active" status, which unlocks the matching
// profile limit (free 1 / individual 1 / family 5 / classroom 30) and all levels
// for paid tiers — exactly as a real Stripe subscription would.
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { PROFILE_LIMITS } from "./subscriptionConfig";

const planValidator = v.union(
  v.literal("free"),
  v.literal("individual"),
  v.literal("family"),
  v.literal("classroom")
);

async function findUserByEmail(ctx, email) {
  const target = email.trim().toLowerCase();
  const all = await ctx.db.query("users").collect();
  return all.find((u) => (u.email ?? "").trim().toLowerCase() === target) ?? null;
}

// Comp a tester to any tier (no payment). Idempotent.
export const grantPlan = mutation({
  args: { email: v.string(), plan: planValidator },
  handler: async (ctx, args) => {
    const user = await findUserByEmail(ctx, args.email);
    if (!user) {
      throw new Error(
        `No user with email "${args.email}". They must sign up at rollandreadgame.com first, then re-run this.`
      );
    }
    await ctx.db.patch(user._id, {
      plan: args.plan,
      subscriptionStatus: "active",
      compedTester: true,
      updatedAt: Date.now(),
    });
    return {
      email: user.email,
      plan: args.plan,
      profileLimit: PROFILE_LIMITS[args.plan],
      status: "active (comped)",
    };
  },
});

// Undo a comp — back to the free tier.
export const revokeToFree = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await findUserByEmail(ctx, args.email);
    if (!user) throw new Error(`No user with email "${args.email}".`);
    await ctx.db.patch(user._id, {
      plan: "free",
      subscriptionStatus: "canceled",
      compedTester: false,
      updatedAt: Date.now(),
    });
    return { email: user.email, plan: "free", profileLimit: PROFILE_LIMITS.free };
  },
});

// List every signed-up user with their plan + profile usage (for managing testers).
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const rows = [];
    for (const u of users) {
      const profiles = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", u._id))
        .collect();
      rows.push({
        email: u.email,
        plan: u.plan,
        status: u.subscriptionStatus ?? null,
        comped: u.compedTester ?? false,
        profiles: profiles.length,
        profileLimit: PROFILE_LIMITS[u.plan],
        createdAt: u.createdAt,
      });
    }
    rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return { count: rows.length, users: rows };
  },
});
