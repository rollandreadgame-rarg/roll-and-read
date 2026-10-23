import { afterEach, describe, expect, test, vi } from "vitest";
import {
  assertMaintenanceSecret,
  assertSyncSecret,
  getCallerUser,
  isCallerOrTrusted,
  isValidSyncSecret,
  ownsProfile,
  requireProfileOwner,
  requireUser,
} from "./authHelpers";
import {
  TEST_MAINTENANCE_SECRET,
  TEST_SYNC_SECRET,
  as,
  installFakeTrustedSecrets,
  seedFamily,
  seedUser,
  setup,
} from "./test.helpers";

afterEach(() => vi.restoreAllMocks());

describe("sync secret", () => {
  test.each([undefined, null, "", "wrong", " ", 123, {}, "x".repeat(10_000)])(
    "rejects %s",
    async (value) => {
      expect(await isValidSyncSecret(value)).toBe(false);
      await expect(assertSyncSecret(value)).rejects.toThrow("Forbidden");
    }
  );

  test("the fake test secret is accepted only while the test digest hook is installed", async () => {
    expect(await isValidSyncSecret(TEST_SYNC_SECRET)).toBe(false);
    installFakeTrustedSecrets();
    expect(await isValidSyncSecret(TEST_SYNC_SECRET)).toBe(true);
    // The maintenance key is a different credential and must not pass as a sync key.
    expect(await isValidSyncSecret(TEST_MAINTENANCE_SECRET)).toBe(false);
  });
});

describe("maintenance secret", () => {
  test.each([undefined, null, "", "wrong", 0])("rejects %s", async (value) => {
    await expect(assertMaintenanceSecret(value)).rejects.toThrow("Forbidden");
  });

  test("a valid sync secret is not a maintenance secret", async () => {
    installFakeTrustedSecrets();
    await expect(assertMaintenanceSecret(TEST_SYNC_SECRET)).rejects.toThrow("Forbidden");
    await expect(assertMaintenanceSecret(TEST_MAINTENANCE_SECRET)).resolves.toBeUndefined();
  });
});

describe("isCallerOrTrusted", () => {
  test("signed-in caller is trusted only for their own clerkId", async () => {
    const t = setup();
    const me = as(t, "user_a");
    expect(await me.run((ctx) => isCallerOrTrusted(ctx, "user_a", undefined))).toBe(true);
    expect(await me.run((ctx) => isCallerOrTrusted(ctx, "user_b", undefined))).toBe(false);
  });

  test("a signed-in caller cannot borrow server trust with a secret for someone else", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    expect(
      await as(t, "user_a").run((ctx) => isCallerOrTrusted(ctx, "user_b", TEST_SYNC_SECRET))
    ).toBe(false);
  });

  test("anonymous callers need the sync secret", async () => {
    const t = setup();
    expect(await t.run((ctx) => isCallerOrTrusted(ctx, "user_a", undefined))).toBe(false);
    expect(await t.run((ctx) => isCallerOrTrusted(ctx, "user_a", "guess"))).toBe(false);
    installFakeTrustedSecrets();
    expect(await t.run((ctx) => isCallerOrTrusted(ctx, "user_a", TEST_SYNC_SECRET))).toBe(true);
  });
});

describe("user / profile resolvers", () => {
  test("requireUser throws for anonymous and for a signed-in user with no row", async () => {
    const t = setup();
    await expect(t.run((ctx) => requireUser(ctx))).rejects.toThrow("Not authenticated");
    await expect(as(t, "ghost").run((ctx) => requireUser(ctx))).rejects.toThrow("User not found");
  });

  test("requireProfileOwner rejects other users and missing profiles", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    const b = await seedFamily(t, "user_b");
    await expect(a.client.run((ctx) => requireProfileOwner(ctx, b.profileId))).rejects.toThrow(
      "Forbidden"
    );
    const owned = await a.client.run((ctx) => requireProfileOwner(ctx, a.profileId));
    expect(owned.profile._id).toBe(a.profileId);

    await t.run((ctx) => ctx.db.delete(a.profileId));
    await expect(a.client.run((ctx) => requireProfileOwner(ctx, a.profileId))).rejects.toThrow(
      "Profile not found"
    );
  });

  test("soft resolvers return null instead of throwing", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    expect(await t.run((ctx) => getCallerUser(ctx))).toBeNull();
    expect(await t.run((ctx) => ownsProfile(ctx, a.profileId))).toBeNull();
    expect(await as(t, "user_b").run((ctx) => ownsProfile(ctx, a.profileId))).toBeNull();
    expect(await as(t, "nobody").run((ctx) => ownsProfile(ctx, a.profileId))).toBeNull();
    expect((await a.client.run((ctx) => ownsProfile(ctx, a.profileId)))?.profile._id).toBe(
      a.profileId
    );
  });
});
