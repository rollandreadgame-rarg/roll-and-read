// lib/parentPin/parentPinLogic.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidPinFormat,
  hashPin,
  MAX_ATTEMPTS,
  LOCKOUT_MS,
  registerFailure,
  isLockedOut,
} from "./parentPinLogic.mjs";

test("isValidPinFormat accepts exactly 4 digits", () => {
  assert.equal(isValidPinFormat("1234"), true);
  assert.equal(isValidPinFormat("0000"), true);
  assert.equal(isValidPinFormat("123"), false);
  assert.equal(isValidPinFormat("12345"), false);
  assert.equal(isValidPinFormat("12a4"), false);
  assert.equal(isValidPinFormat(""), false);
  assert.equal(isValidPinFormat(null), false);
});

test("hashPin is deterministic, salted by userId, and hides the pin", async () => {
  const a = await hashPin("user_abc", "1234");
  const b = await hashPin("user_abc", "1234");
  const c = await hashPin("user_xyz", "1234");
  const d = await hashPin("user_abc", "9999");
  assert.equal(a, b, "same inputs -> same hash");
  assert.notEqual(a, c, "different userId -> different hash");
  assert.notEqual(a, d, "different pin -> different hash");
  assert.ok(/^[0-9a-f]{64}$/.test(a), "hash is 64-char hex (sha-256)");
  assert.ok(!a.includes("1234"), "hash does not contain the pin");
});

test("registerFailure escalates and locks at MAX_ATTEMPTS", () => {
  const now = 1_000_000;
  let s = { attempts: 0, lockedUntil: 0 };
  for (let i = 1; i < MAX_ATTEMPTS; i++) {
    s = registerFailure(s.attempts, now);
    assert.equal(s.attempts, i);
    assert.equal(s.lockedUntil, 0, `no lock before ${MAX_ATTEMPTS}`);
  }
  s = registerFailure(s.attempts, now);
  assert.equal(s.attempts, MAX_ATTEMPTS);
  assert.equal(s.lockedUntil, now + LOCKOUT_MS, "locks out at threshold");
});

test("isLockedOut reflects the lock window", () => {
  const now = 1_000_000;
  assert.equal(isLockedOut(0, now), false, "no lock");
  assert.equal(isLockedOut(now + 5000, now), true, "within window");
  assert.equal(isLockedOut(now - 1, now), false, "window passed");
});
