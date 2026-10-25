// @ts-nocheck
// Deleting data: when a grown-up deletes a reader or their whole account, and
// the scheduled clean-up that carries out the data retention policy published
// in the Privacy Policy (app/privacy, "How long we keep information").
import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSyncSecret } from "./authHelpers";

const DAY_MS = 86_400_000;
/** A reader nobody has played for this long is deleted, unless the account is paying. */
export const INACTIVE_READER_DAYS = 730;
/** Crash reports are kept this long. */
export const ERROR_REPORT_DAYS = 90;
// Bounded work per scheduled run; the next run continues.
const BATCH = 100;

/** Removes a reader and everything recorded about them. */
export async function deleteProfileData(ctx, profileId) {
  for (const table of ["word_bank", "profile_stickers", "game_sessions"]) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_profile", (q) => q.eq("profileId", profileId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }
  await ctx.db.delete(profileId);
}

// Clerk webhook (user.deleted): the grown-up deleted their account. Every
// reader and their data, the account's crash reports, and the account row go.
// Billing records stay with Stripe, which must keep them for tax and
// accounting; the Clerk route cancels any live subscription first.
export const deleteAccount = mutation({
  args: { clerkId: v.string(), syncSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await assertSyncSecret(args.syncSecret);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    const errors = await ctx.db
      .query("client_errors")
      .withIndex("by_clerk_at", (q) => q.eq("clerkId", args.clerkId))
      .collect();
    for (const e of errors) await ctx.db.delete(e._id);
    if (!user) return { deleted: false, readers: 0 };
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const p of profiles) await deleteProfileData(ctx, p._id);
    await ctx.db.delete(user._id);
    return { deleted: true, readers: profiles.length };
  },
});

const isPaying = (user) =>
  !!user &&
  user.plan !== "free" &&
  ["active", "trialing", "past_due"].includes(user.subscriptionStatus ?? (user.compedTester ? "active" : ""));

// Daily (crons.ts). Readers not played for INACTIVE_READER_DAYS (counted from
// when they were created if they never played) are deleted with all their
// data, unless the account is on an active paid plan.
export const purgeInactiveReaders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - INACTIVE_READER_DAYS * DAY_MS;
    const candidates = await ctx.db
      .query("profiles")
      .withIndex("by_last_played", (q) => q.lt("lastPlayedAt", cutoff))
      .take(BATCH * 5);
    let deleted = 0;
    for (const p of candidates) {
      if (deleted >= BATCH) break;
      const lastActive = p.lastPlayedAt ?? p.createdAt;
      if (lastActive >= cutoff) continue; // never played, but created recently
      if (isPaying(await ctx.db.get(p.userId))) continue;
      await deleteProfileData(ctx, p._id);
      deleted++;
    }
    return { deleted };
  },
});

// Daily (crons.ts). Crash reports older than ERROR_REPORT_DAYS are deleted.
export const purgeOldErrorReports = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ERROR_REPORT_DAYS * DAY_MS;
    const old = await ctx.db
      .query("client_errors")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(BATCH * 5);
    for (const e of old) await ctx.db.delete(e._id);
    return { deleted: old.length };
  },
});
