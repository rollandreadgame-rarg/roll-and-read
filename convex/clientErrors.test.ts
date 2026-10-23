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
