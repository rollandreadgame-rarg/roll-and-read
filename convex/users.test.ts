import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import {
  TEST_SYNC_SECRET,
  as,
  installFakeTrustedSecrets,
  seedUser,
  setup,
} from "./test.helpers";

afterEach(() => vi.restoreAllMocks());

const usersByClerk = (t: ReturnType<typeof setup>, clerkId: string) =>
  t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .collect()
  );

describe("createUser", () => {
  test("anonymous callers without a valid sync secret are refused", async () => {
    const t = setup();
    await expect(
      t.mutation(api.users.createUser, { clerkId: "user_a", email: "a@x.test" })
    ).rejects.toThrow("Forbidden");
    await expect(
      t.mutation(api.users.createUser, { clerkId: "user_a", email: "a@x.test", syncSecret: "nope" })
    ).rejects.toThrow("Forbidden");
    expect(await usersByClerk(t, "user_a")).toHaveLength(0);
  });

  test("a signed-in user cannot create a row for someone else", async () => {
    const t = setup();
    await expect(
      as(t, "user_a").mutation(api.users.createUser, { clerkId: "user_b", email: "b@x.test" })
    ).rejects.toThrow("Forbidden");
    expect(await usersByClerk(t, "user_b")).toHaveLength(0);
  });

  test("self-bootstrap always starts on free, whatever plan is sent", async () => {
    const t = setup();
    const me = as(t, "user_a");
    const id = await me.mutation(api.users.createUser, {
      clerkId: "user_a",
      email: "a@x.test",
      plan: "classroom",
    });
    const user = await t.run((ctx) => ctx.db.get(id));
    expect(user?.plan).toBe("free");
    expect(user?.email).toBe("a@x.test");
  });

  test("is idempotent (webhook + client fallback race creates one row)", async () => {
    const t = setup();
    installFakeTrustedSecrets();
    const me = as(t, "user_a");
    const first = await me.mutation(api.users.createUser, { clerkId: "user_a", email: "a@x.test" });
    const second = await t.mutation(api.users.createUser, {
      clerkId: "user_a",
      email: "other@x.test",
      syncSecret: TEST_SYNC_SECRET,
    });
    expect(second).toBe(first);
    const rows = await usersByClerk(t, "user_a");
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("a@x.test");
  });

  test("re-creating never downgrades an existing paid user", async () => {
    const t = setup();
    await seedUser(t, "user_a", "family");
    await as(t, "user_a").mutation(api.users.createUser, { clerkId: "user_a", email: "a@x.test" });
    const [row] = await usersByClerk(t, "user_a");
    expect(row.plan).toBe("family");
  });
});

describe("getByClerkId", () => {
  test("returns null for anonymous callers and for other users", async () => {
    const t = setup();
    await seedUser(t, "user_a");
    expect(await t.query(api.users.getByClerkId, { clerkId: "user_a" })).toBeNull();
    expect(
      await as(t, "user_b").query(api.users.getByClerkId, { clerkId: "user_a" })
    ).toBeNull();
  });

  test("never returns PIN secrets, only whether a PIN exists", async () => {
    const t = setup();
    await seedUser(t, "user_a", "free", {
      parentPinHash: "deadbeef",
      parentPinAttempts: 3,
      parentPinLockedUntil: 123,
    });
    const me = await as(t, "user_a").query(api.users.getByClerkId, { clerkId: "user_a" });
    expect(me).not.toBeNull();
    expect(me).not.toHaveProperty("parentPinHash");
    expect(me).not.toHaveProperty("parentPinAttempts");
    expect(me).not.toHaveProperty("parentPinLockedUntil");
    expect(me?.hasParentPin).toBe(true);
    expect(JSON.stringify(me)).not.toContain("deadbeef");
  });

  test("hasParentPin is false when none is set; unknown user is null", async () => {
    const t = setup();
    await seedUser(t, "user_a");
    expect(
      (await as(t, "user_a").query(api.users.getByClerkId, { clerkId: "user_a" }))?.hasParentPin
    ).toBe(false);
    expect(await as(t, "ghost").query(api.users.getByClerkId, { clerkId: "ghost" })).toBeNull();
  });
});

describe("markTeacherTourSeen", () => {
  test("requires sign-in", async () => {
    const t = setup();
    await expect(t.mutation(api.users.markTeacherTourSeen, {})).rejects.toThrow(
      "Not authenticated"
    );
  });

  test("marks only the caller, and is idempotent", async () => {
    const t = setup();
    const a = await seedUser(t, "user_a");
    const b = await seedUser(t, "user_b");
    await as(t, "user_a").mutation(api.users.markTeacherTourSeen, {});
    const after1 = await t.run((ctx) => ctx.db.get(a));
    expect(after1?.hasSeenTeacherTour).toBe(true);
    expect((await t.run((ctx) => ctx.db.get(b)))?.hasSeenTeacherTour).toBeUndefined();

    await as(t, "user_a").mutation(api.users.markTeacherTourSeen, {});
    const after2 = await t.run((ctx) => ctx.db.get(a));
    expect(after2?.updatedAt).toBe(after1?.updatedAt);
  });

  test("is a no-op before the user row exists", async () => {
    const t = setup();
    await expect(
      as(t, "fresh").mutation(api.users.markTeacherTourSeen, {})
    ).resolves.toBeNull();
  });
});

describe("updateEmailFromClerk", () => {
  test("refuses anonymous callers without the sync secret", async () => {
    const t = setup();
    const id = await seedUser(t, "user_a");
    await expect(
      t.mutation(api.users.updateEmailFromClerk, { clerkId: "user_a", email: "evil@x.test" })
    ).rejects.toThrow("Forbidden");
    await expect(
      t.mutation(api.users.updateEmailFromClerk, {
        clerkId: "user_a",
        email: "evil@x.test",
        syncSecret: "guess",
      })
    ).rejects.toThrow("Forbidden");
    expect((await t.run((ctx) => ctx.db.get(id)))?.email).toBe("user_a@example.test");
  });

  test("a signed-in user cannot change another user's email", async () => {
    const t = setup();
    const id = await seedUser(t, "user_a");
    await expect(
      as(t, "user_b").mutation(api.users.updateEmailFromClerk, {
        clerkId: "user_a",
        email: "evil@x.test",
      })
    ).rejects.toThrow("Forbidden");
    expect((await t.run((ctx) => ctx.db.get(id)))?.email).toBe("user_a@example.test");
  });

  // Regression: the stored email is how operators find an account
  // (adminTesters.grantPlan looks users up by email). It must only come from
  // Clerk's verified webhook, not from whatever a browser sends.
  test("a signed-in user cannot set their own stored email to an arbitrary address", async () => {
    const t = setup();
    const id = await seedUser(t, "user_a");
    await expect(
      as(t, "user_a").mutation(api.users.updateEmailFromClerk, {
        clerkId: "user_a",
        email: "someone-else@x.test",
      })
    ).rejects.toThrow("Forbidden");
    expect((await t.run((ctx) => ctx.db.get(id)))?.email).toBe("user_a@example.test");
  });

  test("the webhook updates the email and never touches the plan", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    const id = await seedUser(t, "user_a", "classroom", { subscriptionStatus: "active" });
    await t.mutation(api.users.updateEmailFromClerk, {
      clerkId: "user_a",
      email: "new@x.test",
      syncSecret: TEST_SYNC_SECRET,
    });
    const user = await t.run((ctx) => ctx.db.get(id));
    expect(user?.email).toBe("new@x.test");
    expect(user?.plan).toBe("classroom");
    expect(user?.subscriptionStatus).toBe("active");
  });

  test("the webhook is a no-op for an unknown user", async () => {
    installFakeTrustedSecrets();
    const t = setup();
    await t.mutation(api.users.updateEmailFromClerk, {
      clerkId: "ghost",
      email: "g@x.test",
      syncSecret: TEST_SYNC_SECRET,
    });
    expect(await usersByClerk(t, "ghost")).toHaveLength(0);
  });
});
