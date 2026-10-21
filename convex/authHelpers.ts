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

// ── Trusted server callers ──────────────────────────────────────────────────
// Next.js server routes (Clerk/Stripe webhooks, checkout/portal) reach Convex
// through an unauthenticated ConvexHttpClient, so they prove themselves with
// the shared CONVEX_SYNC_SECRET (a Vercel env var). We compare its SHA-256
// against a baked-in hash — a hash is not a credential, so it's safe in source
// and Convex never has to store the secret itself.
const SYNC_SECRET_SHA256 =
  "55f872a2c31c47ce8dc5e7dc5ecc89784b2ec424fe468e35ff490a54b664e05f";

// Unauthenticated callers must present the sync secret. (Was false only while
// the backend deployed ahead of the Vercel routes that send it — 2026-10-21.)
const ENFORCE_TRUSTED_CALLERS = true;

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidSyncSecret(provided) {
  if (typeof provided !== "string" || provided.length === 0) return false;
  return (await sha256Hex(provided)) === SYNC_SECRET_SHA256;
}

export async function assertSyncSecret(provided) {
  if (!(await isValidSyncSecret(provided))) throw new Error("Forbidden");
}

// Separate key for one-off maintenance (data repairs). The raw key lives only
// in the operator's local .env.local (MAINTENANCE_SECRET); this is its SHA-256.
const MAINTENANCE_SECRET_SHA256 =
  "d9d0a0fcd5a5a90404141191a50a41b3b83989eb61657b75a9e969a4f99d04fb";

export async function assertMaintenanceSecret(provided) {
  if (typeof provided !== "string" || provided.length === 0) throw new Error("Forbidden");
  if ((await sha256Hex(provided)) !== MAINTENANCE_SECRET_SHA256) throw new Error("Forbidden");
}

// True when the caller is signed in as `clerkId`, or is a trusted server route.
export async function isCallerOrTrusted(ctx, clerkId, syncSecret) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) return identity.subject === clerkId;
  if (await isValidSyncSecret(syncSecret)) return true;
  return !ENFORCE_TRUSTED_CALLERS;
}
