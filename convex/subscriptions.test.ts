import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import {
  PLANS,
  PROFILE_LIMITS,
  isLevelAllowed,
  isPaidStatus,
  planFromLookupKey,
} from "./subscriptionConfig";
import { LEVEL_SEQUENCE } from "../lib/levels";
import {
  TEST_MAINTENANCE_SECRET,
  TEST_SYNC_SECRET,
  as,
  installFakeTrustedSecrets,
  seedFamily,
  seedProfile,
  seedUser,
  setup,
} from "./test.helpers";
import type { T } from "./test.helpers";
import type { Id } from "./_generated/dataModel";

afterEach(() => vi.restoreAllMocks());

const getUser = (t: T, id: Id<"users">) => t.run((ctx) => ctx.db.get(id));

describe("subscriptionConfig", () => {
  test("lookup keys map to plans; anything else is free", () => {
    expect(planFromLookupKey("individual_monthly")).toBe("individual");
    expect(planFromLookupKey("family_monthly")).toBe("family");
    expect(planFromLookupKey("classroom_monthly")).toBe("classroom");
    for (const k of [undefined, null, "", "FAMILY_MONTHLY", "family_yearly", "toString", "__proto__", "constructor"]) {
      expect(planFromLookupKey(k)).toBe("free");
    }
  });

  test("paid statuses", () => {
    for (const s of ["active", "trialing", "past_due"]) expect(isPaidStatus(s)).toBe(true);
    for (const s of [
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
      "",
      undefined,
      null,
      "ACTIVE",
    ]) {
      expect(isPaidStatus(s)).toBe(false);
    }
  });

  test("profile limits per plan", () => {
    expect(PROFILE_LIMITS).toEqual({ free: 1, individual: 1, family: 5, classroom: 30 });
    for (const p of PLANS) expect(PROFILE_LIMITS[p]).toBeGreaterThan(0);
  });

  test("free plan gets exactly the Level 1 sublevels; paid plans get all", () => {
    const freeLevels = LEVEL_SEQUENCE.filter((l) => isLevelAllowed("free", l));
    expect(freeLevels).toEqual(["1A", "1B", "1C", "1D", "1E", "1F", "1G", "1H"]);
    for (const plan of ["individual", "family", "classroom"] as const) {
      expect(LEVEL_SEQUENCE.every((l) => isLevelAllowed(plan, l))).toBe(true);
    }
  });
});

describe("getByClerkId", () => {
  test("anonymous callers and other users get null", async () => {
    const t = setup();
    await seedUser(t, "user_a", "family", { stripeCustomerId: "cus_a" });
    expect(await t.query(api.subscriptions.getByClerkId, { clerkId: "user_a" })).toBeNull();
    expect(
      await t.query(api.subscriptions.getByClerkId, { clerkId: "user_a", syncSecret: "guess" })
    ).toBeNull();
    expect(
      await as(t, "user_b").query(api.subscriptions.getByClerkId, { clerkId: "user_a" })
    ).toBeNull();
  });

  test("owner sees plan + usage and nothing secret", async () => {
    const t = setup();
    const { userId } = await seedFamily(t, "user_a", "family");
    await seedProfile(t, userId);
    await t.run((ctx) => ctx.db.patch(userId, { parentPinHash: "secret-hash" }));
    const info = await as(t, "user_a").query(api.subscriptions.getByClerkId, {
      clerkId: "user_a",
    });
    expect(info).toEqual({
      plan: "family",
      subscriptionStatus: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      comped: false,
      profileLimit: 5,
      profileCount: 2,
    });
  });

  test("comped: true only for a tester who isn't also paying through Stripe", async () => {
    const t = setup();
    const { userId } = await seedFamily(t, "user_a", "family");
    const comped = () => as(t, "user_a").query(api.subscriptions.getByClerkId, { clerkId: "user_a" });
    await t.run((ctx) => ctx.db.patch(userId, { compedTester: true, subscriptionStatus: "active" }));
    expect((await comped())?.comped).toBe(true);
    await t.run((ctx) => ctx.db.patch(userId, { stripeSubscriptionId: "sub_1" }));
    expect((await comped())?.comped).toBe(false);
  });

  test("trusted server route can read it", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    await seedUser(t, "user_a", "individual", { stripeCustomerId: "cus_a" });
    const info = await t.query(api.subscriptions.getByClerkId, {
      clerkId: "user_a",
      syncSecret: TEST_SYNC_SECRET,
    });
    expect(info?.stripeCustomerId).toBe("cus_a");
  });
});

describe("setStripeCustomerId", () => {
  test("refused without the sync secret, even for the signed-in owner", async () => {
    const t = setup();
    const id = await seedUser(t, "user_a");
    for (const client of [t, as(t, "user_a")]) {
      await expect(
        client.mutation(api.subscriptions.setStripeCustomerId, {
          clerkId: "user_a",
          stripeCustomerId: "cus_attacker",
        })
      ).rejects.toThrow("Forbidden");
    }
    installFakeTrustedSecrets();
    await expect(
      t.mutation(api.subscriptions.setStripeCustomerId, {
        clerkId: "user_a",
        stripeCustomerId: "cus_attacker",
        syncSecret: TEST_MAINTENANCE_SECRET,
      })
    ).rejects.toThrow("Forbidden");
    expect((await getUser(t, id))?.stripeCustomerId).toBeUndefined();
  });

  test("trusted route sets it; unknown user throws", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const id = await seedUser(t, "user_a");
    await t.mutation(api.subscriptions.setStripeCustomerId, {
      clerkId: "user_a",
      stripeCustomerId: "cus_1",
      syncSecret: TEST_SYNC_SECRET,
    });
    expect((await getUser(t, id))?.stripeCustomerId).toBe("cus_1");
    await expect(
      t.mutation(api.subscriptions.setStripeCustomerId, {
        clerkId: "ghost",
        stripeCustomerId: "cus_2",
        syncSecret: TEST_SYNC_SECRET,
      })
    ).rejects.toThrow("User not found");
  });
});

describe("syncFromStripe", () => {
  const base = { stripeCustomerId: "cus_a", priceLookupKey: "classroom_monthly", subscriptionStatus: "active" };

  test("refuses missing / wrong secret — including from a signed-in user", async () => {
    const t = setup();
    const id = await seedUser(t, "user_a", "free", { stripeCustomerId: "cus_a" });
    await expect(t.mutation(api.subscriptions.syncFromStripe, base)).rejects.toThrow("Forbidden");
    await expect(
      t.mutation(api.subscriptions.syncFromStripe, { ...base, syncSecret: "" })
    ).rejects.toThrow("Forbidden");
    await expect(
      t.mutation(api.subscriptions.syncFromStripe, { ...base, syncSecret: "wrong" })
    ).rejects.toThrow("Forbidden");
    await expect(
      as(t, "user_a").mutation(api.subscriptions.syncFromStripe, base)
    ).rejects.toThrow("Forbidden");
    expect((await getUser(t, id))?.plan).toBe("free");
  });

  test.each([
    ["active", "classroom_monthly", "classroom"],
    ["trialing", "family_monthly", "family"],
    ["past_due", "individual_monthly", "individual"],
    ["canceled", "classroom_monthly", "free"],
    ["unpaid", "classroom_monthly", "free"],
    ["incomplete", "classroom_monthly", "free"],
    ["incomplete_expired", "family_monthly", "free"],
    ["active", "mystery_monthly", "free"],
    ["active", undefined, "free"],
    [undefined, "family_monthly", "free"],
  ])("status %s + key %s → %s", async (status, key, plan) => {
    installFakeTrustedSecrets();
    const t = setup();
    const id = await seedUser(t, "user_a", "family", { stripeCustomerId: "cus_a" });
    await t.mutation(api.subscriptions.syncFromStripe, {
      stripeCustomerId: "cus_a",
      ...(status === undefined ? {} : { subscriptionStatus: status }),
      ...(key === undefined ? {} : { priceLookupKey: key }),
      syncSecret: TEST_SYNC_SECRET,
    });
    expect((await getUser(t, id))?.plan).toBe(plan);
  });

  test("records billing fields and defaults cancelAtPeriodEnd to false", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const id = await seedUser(t, "user_a", "free", {
      stripeCustomerId: "cus_a",
      cancelAtPeriodEnd: true,
    });
    await t.mutation(api.subscriptions.syncFromStripe, {
      ...base,
      stripeSubscriptionId: "sub_1",
      stripePriceId: "price_1",
      currentPeriodEnd: 1_900_000_000_000,
      syncSecret: TEST_SYNC_SECRET,
    });
    expect(await getUser(t, id)).toMatchObject({
      plan: "classroom",
      subscriptionStatus: "active",
      stripeSubscriptionId: "sub_1",
      stripePriceId: "price_1",
      currentPeriodEnd: 1_900_000_000_000,
      cancelAtPeriodEnd: false,
    });
  });

  test("a late event about an old subscription doesn't downgrade the current paid one", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const id = await seedUser(t, "user_a", "family", {
      stripeCustomerId: "cus_a",
      stripeSubscriptionId: "sub_new",
      subscriptionStatus: "active",
    });
    await t.mutation(api.subscriptions.syncFromStripe, {
      stripeCustomerId: "cus_a",
      stripeSubscriptionId: "sub_old",
      subscriptionStatus: "canceled",
      priceLookupKey: "family_monthly",
      syncSecret: TEST_SYNC_SECRET,
    });
    expect(await getUser(t, id)).toMatchObject({ plan: "family", stripeSubscriptionId: "sub_new" });
  });

  test("the current subscription ending still downgrades, and a new paid one replaces an unpaid one", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const id = await seedUser(t, "user_a", "family", {
      stripeCustomerId: "cus_a",
      stripeSubscriptionId: "sub_1",
      subscriptionStatus: "active",
    });
    await t.mutation(api.subscriptions.syncFromStripe, {
      stripeCustomerId: "cus_a", stripeSubscriptionId: "sub_1", subscriptionStatus: "canceled",
      priceLookupKey: "family_monthly", syncSecret: TEST_SYNC_SECRET,
    });
    expect((await getUser(t, id))?.plan).toBe("free");
    await t.mutation(api.subscriptions.syncFromStripe, {
      stripeCustomerId: "cus_a", stripeSubscriptionId: "sub_2", subscriptionStatus: "active",
      priceLookupKey: "classroom_monthly", syncSecret: TEST_SYNC_SECRET,
    });
    expect(await getUser(t, id)).toMatchObject({ plan: "classroom", stripeSubscriptionId: "sub_2" });
  });

  test("only the matching customer is changed; unknown customers throw", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const a = await seedUser(t, "user_a", "free", { stripeCustomerId: "cus_a" });
    const b = await seedUser(t, "user_b", "free", { stripeCustomerId: "cus_b" });
    await t.mutation(api.subscriptions.syncFromStripe, { ...base, syncSecret: TEST_SYNC_SECRET });
    expect((await getUser(t, a))?.plan).toBe("classroom");
    expect((await getUser(t, b))?.plan).toBe("free");
    await expect(
      t.mutation(api.subscriptions.syncFromStripe, {
        ...base,
        stripeCustomerId: "cus_nobody",
        syncSecret: TEST_SYNC_SECRET,
      })
    ).rejects.toThrow("No user for stripeCustomerId");
  });

  test("a downgrade keeps existing readers but blocks new ones and higher levels", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const userId = await seedUser(t, "user_a", "family", { stripeCustomerId: "cus_a" });
    const p1 = await seedProfile(t, userId, {
      currentLevel: "3A",
      boardsClearedAtLevel: 7,
      accuracyHistory: [0.9, 0.9, 0.9],
    });
    await seedProfile(t, userId);
    await t.mutation(api.subscriptions.syncFromStripe, {
      stripeCustomerId: "cus_a",
      subscriptionStatus: "canceled",
      syncSecret: TEST_SYNC_SECRET,
    });
    const me = as(t, "user_a");
    await expect(
      me.mutation(api.profiles.create, { userId, name: "X", avatarEmoji: "🐱" })
    ).rejects.toThrow("PROFILE_LIMIT_REACHED");
    await expect(
      me.mutation(api.profiles.advanceLevel, { profileId: p1, nextLevel: "3B" })
    ).rejects.toThrow("LEVEL_LOCKED");
    expect(await t.run((ctx) => ctx.db.query("profiles").collect())).toHaveLength(2);
  });
});

describe("canAccessLevel", () => {
  test("reflects the owner's plan", async () => {
    const t = setup();
    const free = await seedFamily(t, "user_free", "free");
    const paid = await seedFamily(t, "user_paid", "family");
    const q = (c: typeof free.client, profileId: Id<"profiles">, level: string) =>
      c.query(api.subscriptions.canAccessLevel, { profileId, level });
    expect(await q(free.client, free.profileId, "1H")).toBe(true);
    expect(await q(free.client, free.profileId, "2A")).toBe(false);
    expect(await q(paid.client, paid.profileId, "5B")).toBe(true);
  });

  test("missing profile → false", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "family");
    await t.run((ctx) => ctx.db.delete(a.profileId));
    expect(
      await a.client.query(api.subscriptions.canAccessLevel, { profileId: a.profileId, level: "1A" })
    ).toBe(false);
  });

  // Regression: it used to answer for ANY profile id, leaking whether another
  // family is on a paid plan. Like every other profile read it is owner-only.
  test("does not answer for other users' or anonymous callers", async () => {
    const t = setup();
    const paid = await seedFamily(t, "user_paid", "classroom");
    await seedUser(t, "user_b");
    for (const client of [t, as(t, "user_b")]) {
      expect(
        await client.query(api.subscriptions.canAccessLevel, {
          profileId: paid.profileId,
          level: "5B",
        })
      ).toBe(false);
    }
  });
});
