// The internal versions are for the Convex dashboard; comp / uncomp /
// listAccounts are public but need the maintenance key (scripts/testers.mjs).
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
  TEST_MAINTENANCE_SECRET,
  TEST_SYNC_SECRET,
  as,
  installFakeTrustedSecrets,
  seedProfile,
  seedUser,
  setup,
} from "./test.helpers";

afterEach(() => vi.restoreAllMocks());

describe("grantPlan / revokeToFree", () => {
  test("comps the matching email (case/space-insensitive) and nobody else", async () => {
    const t = setup();
    const a = await seedUser(t, "user_a", "free", { email: "Tester@Example.com" });
    const b = await seedUser(t, "user_b", "free", { email: "other@example.com" });
    const r = await t.mutation(internal.adminTesters.grantPlan, {
      email: "  tester@example.COM ",
      plan: "family",
    });
    expect(r).toMatchObject({ plan: "family", profileLimit: 5 });
    const [ua, ub] = await t.run(async (ctx) => [await ctx.db.get(a), await ctx.db.get(b)]);
    expect(ua).toMatchObject({ plan: "family", subscriptionStatus: "active", compedTester: true });
    expect(ub?.plan).toBe("free");

    await t.mutation(internal.adminTesters.revokeToFree, { email: "tester@example.com" });
    expect(await t.run((ctx) => ctx.db.get(a))).toMatchObject({
      plan: "free",
      subscriptionStatus: "canceled",
      compedTester: false,
    });
  });

  test("unknown email throws instead of silently doing nothing", async () => {
    const t = setup();
    await expect(
      t.mutation(internal.adminTesters.grantPlan, { email: "nobody@x.test", plan: "classroom" })
    ).rejects.toThrow("No user with email");
    await expect(
      t.mutation(internal.adminTesters.revokeToFree, { email: "nobody@x.test" })
    ).rejects.toThrow("No user with email");
  });

  test("rejects a made-up plan", async () => {
    const t = setup();
    await seedUser(t, "user_a", "free", { email: "a@x.test" });
    await expect(
      t.mutation(internal.adminTesters.grantPlan, {
        email: "a@x.test",
        // @ts-expect-error not a plan
        plan: "platinum",
      })
    ).rejects.toThrow();
  });
});

describe("listUsers", () => {
  test("lists newest first with profile usage", async () => {
    const t = setup();
    const old = await seedUser(t, "user_old", "family", { createdAt: 100, email: "old@x.test" });
    await seedUser(t, "user_new", "free", { createdAt: 200, email: "new@x.test" });
    await seedProfile(t, old);
    await seedProfile(t, old);
    const r = await t.query(internal.adminTesters.listUsers, {});
    expect(r.count).toBe(2);
    expect(r.users.map((u) => u.email)).toEqual(["new@x.test", "old@x.test"]);
    expect(r.users[1]).toMatchObject({ plan: "family", profiles: 2, profileLimit: 5 });
    expect(JSON.stringify(r)).not.toContain("parentPin");
  });
});

describe("paying customers are protected", () => {
  test("comping or revoking a live Stripe subscriber refuses and changes nothing", async () => {
    const t = setup();
    const paying = await seedUser(t, "user_p", "family", {
      email: "payer@x.test",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      subscriptionStatus: "active",
    });
    await expect(
      t.mutation(internal.adminTesters.grantPlan, { email: "payer@x.test", plan: "classroom" })
    ).rejects.toThrow("already pays through Stripe");
    await expect(t.mutation(internal.adminTesters.revokeToFree, { email: "payer@x.test" })).rejects.toThrow(
      "pays through Stripe"
    );
    expect(await t.run((ctx) => ctx.db.get(paying))).toMatchObject({ plan: "family", subscriptionStatus: "active" });
    const r = await t.query(internal.adminTesters.listUsers, {});
    expect(r.users[0]).toMatchObject({ paying: true, comped: false });
  });

  test("a canceled former subscriber can be comped", async () => {
    const t = setup();
    await seedUser(t, "user_c", "free", {
      email: "former@x.test",
      stripeSubscriptionId: "sub_old",
      subscriptionStatus: "canceled",
    });
    await expect(
      t.mutation(internal.adminTesters.grantPlan, { email: "former@x.test", plan: "individual" })
    ).resolves.toMatchObject({ plan: "individual" });
  });
});

describe("maintenance-key versions (scripts/testers.mjs)", () => {
  test("refuse without the key, with a wrong key, or with the sync secret, even when signed in", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const u = await seedUser(t, "user_a", "free", { email: "a@x.test" });
    for (const client of [t, as(t, "user_a")]) {
      for (const maintenanceSecret of ["", "guess", TEST_SYNC_SECRET]) {
        await expect(
          client.mutation(api.adminTesters.comp, { maintenanceSecret, email: "a@x.test", plan: "classroom" })
        ).rejects.toThrow("Forbidden");
        await expect(client.mutation(api.adminTesters.uncomp, { maintenanceSecret, email: "a@x.test" })).rejects.toThrow(
          "Forbidden"
        );
        await expect(client.query(api.adminTesters.listAccounts, { maintenanceSecret })).rejects.toThrow("Forbidden");
      }
    }
    expect((await t.run((ctx) => ctx.db.get(u)))?.plan).toBe("free");
  });

  test("with the key: comp, list, uncomp", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const u = await seedUser(t, "user_a", "free", { email: "a@x.test" });
    const key = { maintenanceSecret: TEST_MAINTENANCE_SECRET };
    await expect(t.mutation(api.adminTesters.comp, { ...key, email: "A@x.test", plan: "classroom" })).resolves.toMatchObject({
      plan: "classroom",
      profileLimit: 30,
    });
    const listed = await t.query(api.adminTesters.listAccounts, key);
    expect(listed.users[0]).toMatchObject({ email: "a@x.test", plan: "classroom", comped: true, paying: false });
    await t.mutation(api.adminTesters.uncomp, { ...key, email: "a@x.test" });
    expect(await t.run((ctx) => ctx.db.get(u))).toMatchObject({ plan: "free", compedTester: false });
  });
});
