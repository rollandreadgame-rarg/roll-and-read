// adminTesters is internal (see visibility.test.ts): only the operator, via the
// dashboard / an admin key, can run it. These tests cover what it does.
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { seedProfile, seedUser, setup } from "./test.helpers";

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
