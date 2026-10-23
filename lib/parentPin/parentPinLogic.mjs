// lib/parentPin/parentPinLogic.mjs
// Pure, runtime-agnostic logic for the parent/teacher PIN gate.
// crypto.subtle exists in Node 18+ and the Convex runtime, so this runs in both.

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 60_000; // 60s base lockout
export const MAX_LOCKOUT_MS = 60 * 60_000; // longest wait: 1 hour

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
// The count keeps growing until a correct PIN (or a reset) clears it, and each
// wrong try past the limit doubles the wait: 1, 2, 4 ... minutes, capped at an
// hour. A flat lockout would let a script try every 4-digit PIN in about a day.
export function registerFailure(prevAttempts, now) {
  const attempts = (prevAttempts ?? 0) + 1;
  if (attempts < MAX_ATTEMPTS) return { attempts, lockedUntil: 0 };
  const wait = Math.min(LOCKOUT_MS * 2 ** (attempts - MAX_ATTEMPTS), MAX_LOCKOUT_MS);
  return { attempts, lockedUntil: now + wait };
}

export function isLockedOut(lockedUntil, now) {
  return typeof lockedUntil === "number" && lockedUntil > now;
}
