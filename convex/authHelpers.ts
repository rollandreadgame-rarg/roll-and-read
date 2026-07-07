// @ts-nocheck
// Shared auth guards for Convex functions.
//
// Every exported mutation/query is reachable by anyone who knows the (public)
// deployment URL, so any handler that mutates or returns a user's data MUST
// verify the caller via ctx.auth rather than trusting a client-supplied
// userId/profileId. The client authenticates through ConvexProviderWithClerk,
// so ctx.auth.getUserIdentity() carries the verified Clerk identity.

export async function requireUser(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!user) throw new Error("User not found");
  return user;
}

// Resolve the caller and assert they own `profileId`. Returns { user, profile }.
// Throws on unauthenticated / not-owner — use in MUTATIONS, which are always
// user-triggered after auth is established.
export async function requireProfileOwner(ctx, profileId) {
  const user = await requireUser(ctx);
  const profile = await ctx.db.get(profileId);
  if (!profile) throw new Error("Profile not found");
  if (String(profile.userId) !== String(user._id)) {
    throw new Error("Forbidden");
  }
  return { user, profile };
}

// Soft resolvers for QUERIES: return null instead of throwing when the caller
// is unauthenticated (the Clerk token can lag briefly on first load, and a
// thrown query error would surface to the ErrorBoundary) or not the owner.
// Callers return a safe empty value in that case, so no data leaks.
export async function getCallerUser(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

export async function ownsProfile(ctx, profileId) {
  const user = await getCallerUser(ctx);
  if (!user) return null;
  const profile = await ctx.db.get(profileId);
  if (!profile || String(profile.userId) !== String(user._id)) return null;
  return { user, profile };
}
