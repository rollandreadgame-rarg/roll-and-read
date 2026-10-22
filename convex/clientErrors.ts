// @ts-nocheck
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertMaintenanceSecret } from "./authHelpers";

const MAX_PER_MINUTE = 5;
const clip = (s, n) => (typeof s === "string" ? s.slice(0, n) : undefined);

// Signed-in browsers report crashes here (see lib/errorReporting.ts). Only the
// error text, page path and browser are kept: never names, words or answers.
export const report = mutation({
  args: {
    message: v.string(),
    stack: v.optional(v.string()),
    path: v.string(),
    userAgent: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const now = Date.now();
    const recent = await ctx.db
      .query("client_errors")
      .withIndex("by_clerk_at", (q) => q.eq("clerkId", identity.subject).gt("at", now - 60_000))
      .take(MAX_PER_MINUTE);
    if (recent.length >= MAX_PER_MINUTE) return;
    await ctx.db.insert("client_errors", {
      message: clip(args.message, 500),
      stack: clip(args.stack, 2000),
      path: clip(args.path.split("?")[0], 200),
      userAgent: clip(args.userAgent, 300),
      clerkId: identity.subject,
      at: now,
    });
  },
});

// Operator view of recent crashes, gated on the maintenance key.
export const recent = query({
  args: { maintenanceSecret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await assertMaintenanceSecret(args.maintenanceSecret);
    return await ctx.db
      .query("client_errors")
      .withIndex("by_at")
      .order("desc")
      .take(Math.min(args.limit ?? 50, 200));
  },
});
