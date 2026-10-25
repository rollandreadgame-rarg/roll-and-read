import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { LOCKOUT_MS, MAX_ATTEMPTS } from "../lib/parentPin/parentPinLogic.mjs";
import { as, installFakeTrustedSecrets, seedUser, setup, TEST_SYNC_SECRET } from "./test.helpers";
import type { T } from "./test.helpers";

const START = Date.parse("2026-10-23T12:00:00Z");

function clock() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(START);
  return (ms: number) => vi.setSystemTime(Date.now() + ms);
}

afterEach(() => vi.useRealTimers());

const userRow = (t: T, id: Id<"users">) => t.run((ctx) => ctx.db.get(id));

async function withPin(pin = "1234", clerkId = "user_a") {
  const t = setup();
  const id = await seedUser(t, clerkId);
  const me = as(t, clerkId);
  await me.mutation(api.parentPin.setParentPin, { pin });
  return { t, id, me };
}

describe("setParentPin", () => {
  test.each(["123", "12345", "abcd", " 1234", "1234 ", "12a4", "", "１２３４", "-123", "1.23"])(
    "rejects malformed PIN %j",
    async (pin) => {
      const t = setup();
      const id = await seedUser(t, "user_a");
      await expect(
        as(t, "user_a").mutation(api.parentPin.setParentPin, { pin })
      ).rejects.toThrow("PIN must be 4 digits");
      expect((await userRow(t, id))?.parentPinHash).toBeUndefined();
    }
  );

  test("requires sign-in", async () => {
    const t = setup();
    await expect(t.mutation(api.parentPin.setParentPin, { pin: "1234" })).rejects.toThrow(
      "Not authenticated"
    );
  });

  test("stores a salted hash, never the PIN, and returns nothing secret", async () => {
    const t = setup();
    const a = await seedUser(t, "user_a");
    const b = await seedUser(t, "user_b");
    const res = await as(t, "user_a").mutation(api.parentPin.setParentPin, { pin: "1234" });
    await as(t, "user_b").mutation(api.parentPin.setParentPin, { pin: "1234" });
    expect(res).toEqual({ ok: true });
    const ua = await userRow(t, a);
    const ub = await userRow(t, b);
    expect(ua?.parentPinHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ua?.parentPinHash).not.toContain("1234");
    // Same PIN, different accounts → different hashes (salted by user id).
    expect(ua?.parentPinHash).not.toBe(ub?.parentPinHash);
  });

  test("can't overwrite an existing PIN without the current one", async () => {
    const { t, id, me } = await withPin("1234");
    const before = (await userRow(t, id))?.parentPinHash;
    await expect(me.mutation(api.parentPin.setParentPin, { pin: "0000" })).rejects.toThrow(
      "already set"
    );
    expect((await userRow(t, id))?.parentPinHash).toBe(before);
  });
});

describe("verifyParentPin", () => {
  test("right PIN passes, wrong PIN fails", async () => {
    const { me } = await withPin("4321");
    expect(await me.mutation(api.parentPin.verifyParentPin, { pin: "4321" })).toEqual({ ok: true });
    expect(await me.mutation(api.parentPin.verifyParentPin, { pin: "1234" })).toMatchObject({
      ok: false,
    });
  });

  test("no PIN set → never ok", async () => {
    const t = setup();
    await seedUser(t, "user_a");
    expect(
      await as(t, "user_a").mutation(api.parentPin.verifyParentPin, { pin: "0000" })
    ).toEqual({ ok: false });
  });

  test(`locks for ${LOCKOUT_MS / 1000}s after ${MAX_ATTEMPTS} wrong tries; even the right PIN fails while locked`, async () => {
    const advance = clock();
    const { t, id, me } = await withPin("1111");
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      const r = await me.mutation(api.parentPin.verifyParentPin, { pin: "0000" });
      expect(r.lockedUntil).toBeUndefined();
    }
    const locking = await me.mutation(api.parentPin.verifyParentPin, { pin: "0000" });
    expect(locking).toEqual({ ok: false, lockedUntil: START + LOCKOUT_MS });

    advance(LOCKOUT_MS - 1000);
    expect(await me.mutation(api.parentPin.verifyParentPin, { pin: "1111" })).toEqual({
      ok: false,
      lockedUntil: START + LOCKOUT_MS,
    });

    advance(1001);
    expect(await me.mutation(api.parentPin.verifyParentPin, { pin: "1111" })).toEqual({ ok: true });
    expect(await userRow(t, id)).toMatchObject({ parentPinAttempts: 0, parentPinLockedUntil: 0 });
  });

  test("a correct PIN resets the failure count", async () => {
    const { t, id, me } = await withPin("1111");
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      await me.mutation(api.parentPin.verifyParentPin, { pin: "0000" });
    }
    await me.mutation(api.parentPin.verifyParentPin, { pin: "1111" });
    expect((await userRow(t, id))?.parentPinAttempts).toBe(0);
    const r = await me.mutation(api.parentPin.verifyParentPin, { pin: "0000" });
    expect(r.lockedUntil).toBeUndefined();
  });

  test("failures across verify / change / remove share one counter", async () => {
    clock();
    const { me } = await withPin("1111");
    await me.mutation(api.parentPin.verifyParentPin, { pin: "0000" });
    await me.mutation(api.parentPin.verifyParentPin, { pin: "0000" });
    await me.mutation(api.parentPin.changeParentPin, { currentPin: "0000", newPin: "2222" });
    await me.mutation(api.parentPin.removeParentPin, { currentPin: "0000" });
    const r = await me.mutation(api.parentPin.changeParentPin, {
      currentPin: "0000",
      newPin: "2222",
    });
    expect(r.lockedUntil).toBe(START + LOCKOUT_MS);
    // Locked: the right PIN can't change or remove it either.
    expect(
      (await me.mutation(api.parentPin.changeParentPin, { currentPin: "1111", newPin: "2222" })).ok
    ).toBe(false);
    expect((await me.mutation(api.parentPin.removeParentPin, { currentPin: "1111" })).ok).toBe(
      false
    );
    expect((await me.mutation(api.parentPin.verifyParentPin, { pin: "2222" })).ok).toBe(false);
  });

  test("one account's failures never lock another account", async () => {
    clock();
    const t = setup();
    await seedUser(t, "user_a");
    await seedUser(t, "user_b");
    await as(t, "user_a").mutation(api.parentPin.setParentPin, { pin: "1111" });
    await as(t, "user_b").mutation(api.parentPin.setParentPin, { pin: "2222" });
    for (let i = 0; i < MAX_ATTEMPTS + 2; i++) {
      await as(t, "user_b").mutation(api.parentPin.verifyParentPin, { pin: "1111" });
    }
    expect(
      await as(t, "user_a").mutation(api.parentPin.verifyParentPin, { pin: "1111" })
    ).toEqual({ ok: true });
  });

  // A flat 60s lockout would let a script cover all 10,000 PINs in ~33 hours.
  test("repeated lockouts escalate (brute-force resistance)", async () => {
    const advance = clock();
    const { me } = await withPin("9999");
    const lockFor = async () => {
      let r: { lockedUntil?: number } = {};
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        r = await me.mutation(api.parentPin.verifyParentPin, { pin: "0000" });
      }
      return (r.lockedUntil ?? 0) - Date.now();
    };
    const first = await lockFor();
    advance(first + 1);
    const second = await lockFor();
    expect(second).toBeGreaterThan(first);
  });
});

describe("changeParentPin", () => {
  test("needs the current PIN; the new one then works and the old one doesn't", async () => {
    const { me } = await withPin("1111");
    expect(
      (await me.mutation(api.parentPin.changeParentPin, { currentPin: "9999", newPin: "2222" })).ok
    ).toBe(false);
    expect(
      await me.mutation(api.parentPin.changeParentPin, { currentPin: "1111", newPin: "2222" })
    ).toEqual({ ok: true });
    expect((await me.mutation(api.parentPin.verifyParentPin, { pin: "1111" })).ok).toBe(false);
    expect((await me.mutation(api.parentPin.verifyParentPin, { pin: "2222" })).ok).toBe(true);
  });

  test("rejects a malformed new PIN before checking anything", async () => {
    const { t, id, me } = await withPin("1111");
    await expect(
      me.mutation(api.parentPin.changeParentPin, { currentPin: "1111", newPin: "22" })
    ).rejects.toThrow("PIN must be 4 digits");
    await expect(
      me.mutation(api.parentPin.changeParentPin, { currentPin: "0000", newPin: "abcd" })
    ).rejects.toThrow("PIN must be 4 digits");
    expect((await userRow(t, id))?.parentPinAttempts).toBe(0);
  });

  test("with no PIN set, change fails (can't sneak one in)", async () => {
    const t = setup();
    const id = await seedUser(t, "user_a");
    const r = await as(t, "user_a").mutation(api.parentPin.changeParentPin, {
      currentPin: "0000",
      newPin: "2222",
    });
    expect(r.ok).toBe(false);
    expect((await userRow(t, id))?.parentPinHash).toBeUndefined();
  });
});

describe("removeParentPin", () => {
  test("needs the current PIN, then clears it", async () => {
    const { t, id, me } = await withPin("1111");
    expect((await me.mutation(api.parentPin.removeParentPin, { currentPin: "0000" })).ok).toBe(
      false
    );
    expect((await userRow(t, id))?.parentPinHash).toBeDefined();
    expect(await me.mutation(api.parentPin.removeParentPin, { currentPin: "1111" })).toEqual({
      ok: true,
    });
    expect((await userRow(t, id))?.parentPinHash).toBeUndefined();
    expect(
      (await me.query(api.users.getByClerkId, { clerkId: "user_a" }))?.hasParentPin
    ).toBe(false);
    // And a fresh PIN can be set again.
    await me.mutation(api.parentPin.setParentPin, { pin: "3333" });
    expect((await me.mutation(api.parentPin.verifyParentPin, { pin: "3333" })).ok).toBe(true);
  });

  test("requires sign-in", async () => {
    const t = setup();
    await expect(
      t.mutation(api.parentPin.removeParentPin, { currentPin: "1111" })
    ).rejects.toThrow("Not authenticated");
  });
});

describe("resetParentPin", () => {
  // Only the site's server route may reset (after Clerk re-verifies the
  // grown-up); it proves itself with the sync secret.
  const reset = (t: T, newPin: string, clerkId = "user_a", syncSecret?: string) =>
    t.mutation(api.parentPin.resetParentPin, { clerkId, newPin, syncSecret });

  test("with the server's secret: sets a new PIN and clears any lockout", async () => {
    clock();
    const spy = installFakeTrustedSecrets();
    try {
      const { t, id, me } = await withPin("1111");
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await me.mutation(api.parentPin.verifyParentPin, { pin: "0000" });
      }
      await reset(t, "5555", "user_a", TEST_SYNC_SECRET);
      expect(await userRow(t, id)).toMatchObject({ parentPinAttempts: 0, parentPinLockedUntil: 0 });
      expect((await me.mutation(api.parentPin.verifyParentPin, { pin: "5555" })).ok).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  // Regression: a signed-in browser (a child on the grown-up's device) could
  // replace the PIN from the console with no proof at all.
  test("a signed-in browser can't reset the PIN itself, with or without a guessed secret", async () => {
    const { t, me } = await withPin("1111");
    await expect(
      me.mutation(api.parentPin.resetParentPin, { clerkId: "user_a", newPin: "0000" })
    ).rejects.toThrow();
    await expect(reset(t, "0000", "user_a", "guess")).rejects.toThrow("Forbidden");
    await expect(reset(t, "0000")).rejects.toThrow("Forbidden");
    expect((await me.mutation(api.parentPin.verifyParentPin, { pin: "1111" })).ok).toBe(true);
  });

  test("rejects malformed PINs and unknown users even from the server", async () => {
    const spy = installFakeTrustedSecrets();
    try {
      const t = setup();
      await seedUser(t, "user_a");
      await expect(reset(t, "12", "user_a", TEST_SYNC_SECRET)).rejects.toThrow("PIN must be 4 digits");
      await expect(reset(t, "1234", "user_nobody", TEST_SYNC_SECRET)).rejects.toThrow("User not found");
    } finally {
      spy.mockRestore();
    }
  });
});
