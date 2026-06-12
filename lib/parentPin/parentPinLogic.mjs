// lib/parentPin/parentPinLogic.mjs
// Pure, runtime-agnostic logic for the parent/teacher PIN gate.
// crypto.subtle exists in Node 18+ and the Convex runtime, so this runs in both.

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 60_000; // 60s base lockout

export function isValidPinFormat(pin) {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

// Salted SHA-256. Salt = the user's unique id. Returns lowercase hex.
export async function hashPin(userId, pin) {
  const data = new TextEncoder().encode(`${userId}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Given the previous attempt count, return the new lockout state after a failure.
export function registerFailure(prevAttempts, now) {
  const attempts = (prevAttempts ?? 0) + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0;
  return { attempts, lockedUntil };
}

export function isLockedOut(lockedUntil, now) {
  return typeof lockedUntil === "number" && lockedUntil > now;
}
