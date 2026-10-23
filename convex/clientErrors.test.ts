import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { modules } from "./test.setup";

const report = { message: "boom", path: "/play?__clerk_ticket=secret", userAgent: "test" };

test("anonymous reports are dropped", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.clientErrors.report, report);
  const rows = await t.run((ctx) => ctx.db.query("client_errors").collect());
  expect(rows).toHaveLength(0);
});

test("signed-in report is stored without the query string", async () => {
  const t = convexTest(schema, modules);
  await t.withIdentity({ subject: "user_1" }).mutation(api.clientErrors.report, report);
  const rows = await t.run((ctx) => ctx.db.query("client_errors").collect());
  expect(rows).toHaveLength(1);
  expect(rows[0].path).toBe("/play");
  expect(rows[0].clerkId).toBe("user_1");
});

test("a user is capped at 5 reports a minute", async () => {
  const t = convexTest(schema, modules).withIdentity({ subject: "user_1" });
  for (let i = 0; i < 8; i++) await t.mutation(api.clientErrors.report, report);
  const rows = await t.run((ctx) => ctx.db.query("client_errors").collect());
  expect(rows).toHaveLength(5);
});

test("long fields are clipped", async () => {
  const t = convexTest(schema, modules).withIdentity({ subject: "user_1" });
  await t.mutation(api.clientErrors.report, { ...report, message: "x".repeat(5000), stack: "y".repeat(9000) });
  const [row] = await t.run((ctx) => ctx.db.query("client_errors").collect());
  expect(row.message).toHaveLength(500);
  expect(row.stack).toHaveLength(2000);
});

test("the operator view needs the maintenance key", async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.clientErrors.recent, { maintenanceSecret: "wrong" })).rejects.toThrow();
});

test("with the maintenance key the operator sees newest first, capped at 200", async () => {
  const { installFakeTrustedSecrets, TEST_MAINTENANCE_SECRET, TEST_SYNC_SECRET } = await import(
    "./test.helpers"
  );
  const spy = installFakeTrustedSecrets();
  try {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (let i = 0; i < 205; i++) {
        await ctx.db.insert("client_errors", {
          message: `e${i}`,
          path: "/play",
          userAgent: "ua",
          clerkId: "user_1",
          at: i,
        });
      }
    });
    const rows = await t.query(api.clientErrors.recent, {
      maintenanceSecret: TEST_MAINTENANCE_SECRET,
      limit: 10_000,
    });
    expect(rows).toHaveLength(200);
    expect(rows[0].message).toBe("e204");
    expect(
      await t.query(api.clientErrors.recent, { maintenanceSecret: TEST_MAINTENANCE_SECRET })
    ).toHaveLength(50);
    // The webhook sync key is not an operator key.
    await expect(
      t.query(api.clientErrors.recent, { maintenanceSecret: TEST_SYNC_SECRET })
    ).rejects.toThrow("Forbidden");
  } finally {
    spy.mockRestore();
  }
});
