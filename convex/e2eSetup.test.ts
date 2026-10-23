// ensureTestUser is internal (pinned in visibility.test.ts), so a browser can
// never create the E2E account on a real deployment. Here: it is idempotent
// and its fixture can't be used by a real signed-in user.
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { as, setup } from "./test.helpers";

describe("ensureTestUser", () => {
  test("is idempotent", async () => {
    const t = setup();
    const first = await t.mutation(internal.e2eSetup.ensureTestUser, {});
    const second = await t.mutation(internal.e2eSetup.ensureTestUser, {});
    expect(second).toEqual(first);
    const counts = await t.run(async (ctx) => ({
      users: (await ctx.db.query("users").collect()).length,
      profiles: (await ctx.db.query("profiles").collect()).length,
    }));
    expect(counts).toEqual({ users: 1, profiles: 1 });
  });

  test("its reader is invisible to every other signed-in user", async () => {
    const t = setup();
    const { profileId } = await t.mutation(internal.e2eSetup.ensureTestUser, {});
    await t.run((ctx) =>
      ctx.db.insert("users", {
        clerkId: "user_real",
        email: "r@x.test",
        plan: "free",
        createdAt: 1,
        updatedAt: 1,
      })
    );
    const real = as(t, "user_real");
    expect(await real.query(api.profiles.get, { profileId })).toBeNull();
    await expect(
      real.mutation(api.shop.openPack, { profileId, packId: "premium" })
    ).rejects.toThrow("Forbidden");
  });
});
