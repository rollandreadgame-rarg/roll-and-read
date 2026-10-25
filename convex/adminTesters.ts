// @ts-nocheck
// Admin helpers for comping testers WITHOUT Stripe.
//
// The operator's tool is scripts/testers.mjs, which calls the public,
// maintenance-key-gated versions below (a deploy key can't run internal
// functions):
//   node scripts/testers.mjs list
//   node scripts/testers.mjs comp tester@example.com family
//   node scripts/testers.mjs uncomp tester@example.com
// The internal versions stay for the Convex dashboard.
//
// The tester must SIGN UP first (so a users row exists). Comping looks them
// up by email, sets their plan + an "active" status, which unlocks the matching
// profile limit (free 1 / individual 1 / family 5 / classroom 30) and all levels
// for paid tiers — exactly as a real Stripe subscription would. Comped readers
// are also kept by the inactive-reader clean-up (dataLifecycle).
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { PROFILE_LIMITS, isPaidStatus } from "./subscriptionConfig";
import { assertMaintenanceSecret } from "./authHelpers";

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

// A real Stripe subscription that is still billing. Comping or revoking such
// an account would either keep charging a "free" tester or downgrade a
// paying customer, so both refuse.
function isPayingCustomer(user) {
  return Boolean(user.stripeSubscriptionId) && isPaidStatus(user.subscriptionStatus) && !user.compedTester;
}

async function grant(ctx, { email, plan }) {
  const user = await findUserByEmail(ctx, email);
  if (!user) {
    throw new Error(
      `No user with email "${email}". They must sign up at rollandreadgame.com first, then re-run this.`
    );
  }
  if (isPayingCustomer(user)) {
    throw new Error(
      `"${email}" already pays through Stripe. Cancel their subscription first, or leave them as they are.`
    );
  }
  await ctx.db.patch(user._id, {
    plan,
    subscriptionStatus: "active",
    compedTester: true,
    updatedAt: Date.now(),
  });
  return {
    email: user.email,
    plan,
    profileLimit: PROFILE_LIMITS[plan],
    status: "active (comped)",
  };
}

async function revoke(ctx, { email }) {
  const user = await findUserByEmail(ctx, email);
  if (!user) throw new Error(`No user with email "${email}".`);
  if (isPayingCustomer(user)) {
    throw new Error(`"${email}" pays through Stripe; their plan follows their subscription.`);
  }
  await ctx.db.patch(user._id, {
    plan: "free",
    subscriptionStatus: "canceled",
    compedTester: false,
    updatedAt: Date.now(),
  });
  return { email: user.email, plan: "free", profileLimit: PROFILE_LIMITS.free };
}

async function list(ctx) {
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
      paying: isPayingCustomer(u),
      profiles: profiles.length,
      profileLimit: PROFILE_LIMITS[u.plan],
      createdAt: u.createdAt,
    });
  }
  rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return { count: rows.length, users: rows };
}

// Comp a tester to any tier (no payment). Idempotent.
export const grantPlan = internalMutation({
  args: { email: v.string(), plan: planValidator },
  handler: (ctx, args) => grant(ctx, args),
});

// Undo a comp — back to the free tier.
export const revokeToFree = internalMutation({
  args: { email: v.string() },
  handler: (ctx, args) => revoke(ctx, args),
});

// List every signed-up user with their plan + profile usage (for managing testers).
export const listUsers = internalQuery({
  args: {},
  handler: (ctx) => list(ctx),
});

// Same three, callable with the maintenance key (scripts/testers.mjs).
export const comp = mutation({
  args: { maintenanceSecret: v.string(), email: v.string(), plan: planValidator },
  handler: async (ctx, { maintenanceSecret, ...args }) => {
    await assertMaintenanceSecret(maintenanceSecret);
    return grant(ctx, args);
  },
});

export const uncomp = mutation({
  args: { maintenanceSecret: v.string(), email: v.string() },
  handler: async (ctx, { maintenanceSecret, ...args }) => {
    await assertMaintenanceSecret(maintenanceSecret);
    return revoke(ctx, args);
  },
});

export const listAccounts = query({
  args: { maintenanceSecret: v.string() },
  handler: async (ctx, { maintenanceSecret }) => {
    await assertMaintenanceSecret(maintenanceSecret);
    return list(ctx);
  },
});
