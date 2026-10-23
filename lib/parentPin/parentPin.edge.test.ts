import { describe, expect, test } from "vitest";
import {
  hashPin,
  isLockedOut,
  isValidPinFormat,
  LOCKOUT_MS,
  MAX_ATTEMPTS,
  MAX_LOCKOUT_MS,
  registerFailure,
} from "./parentPinLogic.mjs";

describe("isValidPinFormat edges", () => {
  test.each([
    [1234, false],
    [null, false],
    [undefined, false],
    ["1234\n", false],
    ["\n1234", false],
    ["12 34", false],
    ["+123", false],
    ["-123", false],
    ["١٢٣٤", false], // Arabic-Indic digits
    ["１２３４", false], // full-width digits
    ["0000", true],
    ["9999", true],
  ])("%j → %s", (pin, ok) => {
    expect(isValidPinFormat(pin)).toBe(ok);
  });
});

describe("hashPin edges", () => {
  test("every pin hashes differently for one user", async () => {
    const seen = new Set<string>();
    for (const pin of ["0000", "0001", "1000", "1234", "4321", "9999"]) seen.add(await hashPin("user_1", pin));
    expect(seen.size).toBe(6);
  });

  test("the same pin hashes differently across users (salted)", async () => {
    expect(await hashPin("user_1", "1234")).not.toBe(await hashPin("user_2", "1234"));
  });
});

describe("lockout edges", () => {
  test("missing previous count starts at 1", () => {
    expect(registerFailure(undefined, 0)).toEqual({ attempts: 1, lockedUntil: 0 });
    expect(registerFailure(null, 0)).toEqual({ attempts: 1, lockedUntil: 0 });
  });

  test("locks exactly on the MAX_ATTEMPTS-th failure with the base wait", () => {
    const now = 1_000_000;
    expect(registerFailure(MAX_ATTEMPTS - 2, now).lockedUntil).toBe(0);
    expect(registerFailure(MAX_ATTEMPTS - 1, now)).toEqual({ attempts: MAX_ATTEMPTS, lockedUntil: now + LOCKOUT_MS });
  });

  test("each wrong try past the limit doubles the wait; the count keeps growing", () => {
    const now = 1_000_000;
    // prev = MAX_ATTEMPTS + k  →  attempts = MAX_ATTEMPTS + k + 1  →  wait = LOCKOUT_MS * 2^(k + 1)
    expect(registerFailure(MAX_ATTEMPTS, now)).toEqual({ attempts: MAX_ATTEMPTS + 1, lockedUntil: now + 2 * LOCKOUT_MS });
    expect(registerFailure(MAX_ATTEMPTS + 1, now).lockedUntil).toBe(now + 4 * LOCKOUT_MS);
    expect(registerFailure(MAX_ATTEMPTS + 2, now).lockedUntil).toBe(now + 8 * LOCKOUT_MS);
    expect(registerFailure(MAX_ATTEMPTS + 3, now)).toEqual({ attempts: MAX_ATTEMPTS + 4, lockedUntil: now + 16 * LOCKOUT_MS });
  });

  test("the wait is capped at MAX_LOCKOUT_MS (1 hour), even for huge counts", () => {
    const now = 1_000_000;
    expect(MAX_LOCKOUT_MS).toBe(60 * 60_000);
    expect(registerFailure(MAX_ATTEMPTS + 10, now).lockedUntil).toBe(now + MAX_LOCKOUT_MS);
    expect(registerFailure(MAX_ATTEMPTS + 5000, now).lockedUntil).toBe(now + MAX_LOCKOUT_MS);
    // Never shorter than the previous step as the count rises.
    let prevWait = 0;
    for (let prev = MAX_ATTEMPTS - 1; prev < MAX_ATTEMPTS + 20; prev++) {
      const wait = registerFailure(prev, now).lockedUntil - now;
      expect(wait).toBeGreaterThanOrEqual(prevWait);
      expect(wait).toBeLessThanOrEqual(MAX_LOCKOUT_MS);
      prevWait = wait;
    }
  });

  test("a script can't try all 10,000 PINs in a day", () => {
    let attempts = 0;
    let t = 0;
    let tries = 0;
    const day = 24 * 60 * 60_000;
    while (t < day) {
      const r = registerFailure(attempts, t);
      attempts = r.attempts;
      tries++;
      t = Math.max(t, r.lockedUntil);
      if (r.lockedUntil === 0) t += 1; // unlocked tries are instant
    }
    expect(tries).toBeLessThan(100);
  });

  test("lock ends exactly at lockedUntil", () => {
    expect(isLockedOut(5000, 4999)).toBe(true);
    expect(isLockedOut(5000, 5000)).toBe(false);
    expect(isLockedOut(0, 1)).toBe(false);
    expect(isLockedOut(undefined, 1)).toBe(false);
    expect(isLockedOut(null, 1)).toBe(false);
    expect(isLockedOut("99999999999999" as unknown as number, 1)).toBe(false);
  });
});
