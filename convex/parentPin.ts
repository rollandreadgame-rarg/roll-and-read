// @ts-nocheck
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  isValidPinFormat,
  hashPin,
  registerFailure,
  isLockedOut,
} from "../lib/parentPin/parentPinLogic.mjs";

async function requireUser(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!user) throw new Error("User not found");
  return user;
}

export const setParentPin = mutation({
  args: { pin: v.string() },
  handler: async (ctx, args) => {
    if (!isValidPinFormat(args.pin)) throw new Error("PIN must be 4 digits");
    const user = await requireUser(ctx);
    const parentPinHash = await hashPin(user._id, args.pin);
    await ctx.db.patch(user._id, {
      parentPinHash,
      parentPinAttempts: 0,
      parentPinLockedUntil: 0,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const verifyParentPin = mutation({
  args: { pin: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    if (isLockedOut(user.parentPinLockedUntil, now)) {
      return { ok: false, lockedUntil: user.parentPinLockedUntil };
    }
    if (!user.parentPinHash) return { ok: false };
    const candidate = await hashPin(user._id, args.pin);
    if (candidate === user.parentPinHash) {
      await ctx.db.patch(user._id, {
        parentPinAttempts: 0,
        parentPinLockedUntil: 0,
      });
      return { ok: true };
    }
    const next = registerFailure(user.parentPinAttempts, now);
    await ctx.db.patch(user._id, {
      parentPinAttempts: next.lockedUntil ? 0 : next.attempts,
      parentPinLockedUntil: next.lockedUntil,
    });
    return { ok: false, lockedUntil: next.lockedUntil || undefined };
  },
});

export const changeParentPin = mutation({
  args: { currentPin: v.string(), newPin: v.string() },
  handler: async (ctx, args) => {
    if (!isValidPinFormat(args.newPin)) throw new Error("PIN must be 4 digits");
    const user = await requireUser(ctx);
    const current = await hashPin(user._id, args.currentPin);
    if (current !== user.parentPinHash) return { ok: false };
    const parentPinHash = await hashPin(user._id, args.newPin);
    await ctx.db.patch(user._id, {
      parentPinHash,
      parentPinAttempts: 0,
      parentPinLockedUntil: 0,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const removeParentPin = mutation({
  args: { currentPin: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const current = await hashPin(user._id, args.currentPin);
    if (current !== user.parentPinHash) return { ok: false };
    await ctx.db.patch(user._id, {
      parentPinHash: undefined,
      parentPinAttempts: 0,
      parentPinLockedUntil: 0,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const resetParentPin = mutation({
  args: { newPin: v.string() },
  handler: async (ctx, args) => {
    if (!isValidPinFormat(args.newPin)) throw new Error("PIN must be 4 digits");
    const user = await requireUser(ctx);
    const parentPinHash = await hashPin(user._id, args.newPin);
    await ctx.db.patch(user._id, {
      parentPinHash,
      parentPinAttempts: 0,
      parentPinLockedUntil: 0,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});
