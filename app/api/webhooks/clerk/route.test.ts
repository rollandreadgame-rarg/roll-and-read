// Clerk (svix) webhook handler. Payloads are signed and verified by the real
// svix library with a throwaway test secret; Convex and email are mocked.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Webhook } from "svix";
import { NextRequest } from "next/server";
import { getFunctionName } from "convex/server";

const TEST_SECRET = "whsec_" + Buffer.from("unit-test-only-clerk-secret-0123456789").toString("base64");
const OTHER_SECRET = "whsec_" + Buffer.from("some-other-secret-abcdefghijklmnop").toString("base64");
const SYNC_SECRET = "unit-test-sync-secret";

const h = vi.hoisted(() => ({ mutation: vi.fn(), query: vi.fn(), sendEmail: vi.fn(), cancel: vi.fn() }));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    mutation = h.mutation;
    query = h.query;
  },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: h.sendEmail }));
vi.mock("@/lib/stripe", () => ({ stripe: { subscriptions: { cancel: h.cancel } } }));

import { POST } from "./route";

type Json = Record<string, unknown>;
let msgCounter = 0;

function signed(evt: Json, secret = TEST_SECRET, headerOverrides: Record<string, string | null> = {}) {
  const payload = JSON.stringify(evt);
  const msgId = `msg_${++msgCounter}`;
  const now = new Date();
  const signature = new Webhook(secret).sign(msgId, now, payload);
  const headers: Record<string, string> = {
    "svix-id": msgId,
    "svix-timestamp": String(Math.floor(now.getTime() / 1000)),
    "svix-signature": signature,
  };
  for (const [k, v] of Object.entries(headerOverrides)) {
    if (v === null) delete headers[k];
    else headers[k] = v;
  }
  return new NextRequest("https://rollandreadgame.com/api/webhooks/clerk", {
    method: "POST",
    body: payload,
    headers,
  });
}

function userCreated(data: Json = {}): Json {
  return {
    type: "user.created",
    data: {
      id: "user_abc",
      primary_email_address_id: "idn_2",
      email_addresses: [
        { id: "idn_1", email_address: "secondary@example.com" },
        { id: "idn_2", email_address: "primary@example.com" },
      ],
      ...data,
    },
  };
}

function calledFunctions() {
  return h.mutation.mock.calls.map(([ref]) => getFunctionName(ref));
}

beforeEach(() => {
  vi.stubEnv("CLERK_WEBHOOK_SECRET", TEST_SECRET);
  vi.stubEnv("CONVEX_SYNC_SECRET", SYNC_SECRET);
  h.mutation.mockReset().mockResolvedValue("users_id_1");
  h.sendEmail.mockReset().mockResolvedValue({ sent: true });
  h.query.mockReset().mockResolvedValue(null);
  h.cancel.mockReset().mockResolvedValue({ status: "canceled" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signature checks", () => {
  test("payload signed with another secret → 400, nothing written", async () => {
    const res = await POST(signed(userCreated(), OTHER_SECRET));
    expect(res.status).toBe(400);
    expect(h.mutation).not.toHaveBeenCalled();
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  test("missing svix headers → 400", async () => {
    const res = await POST(signed(userCreated(), TEST_SECRET, { "svix-signature": null, "svix-id": null }));
    expect(res.status).toBe(400);
    expect(h.mutation).not.toHaveBeenCalled();
  });

  test("tampered body → 400", async () => {
    const good = signed(userCreated());
    const forged = new NextRequest(good.url, {
      method: "POST",
      headers: good.headers,
      body: JSON.stringify(userCreated({ id: "user_attacker" })),
    });
    const res = await POST(forged);
    expect(res.status).toBe(400);
    expect(h.mutation).not.toHaveBeenCalled();
  });

  test("stale timestamp (replay older than svix tolerance) → 400", async () => {
    const res = await POST(
      signed(userCreated(), TEST_SECRET, { "svix-timestamp": String(Math.floor(Date.now() / 1000) - 3600) })
    );
    expect(res.status).toBe(400);
  });

  test("missing CLERK_WEBHOOK_SECRET fails the request (500 → Clerk retries) without writing", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SECRET", "");
    await expect(POST(signed(userCreated()))).rejects.toThrow();
    expect(h.mutation).not.toHaveBeenCalled();
  });
});

describe("user.created", () => {
  test("creates the Convex user with the PRIMARY email and sends one welcome email", async () => {
    const res = await POST(signed(userCreated()));
    expect(res.status).toBe(200);
    expect(calledFunctions()).toEqual(["users:createUser"]);
    expect(h.mutation.mock.calls[0][1]).toEqual({
      clerkId: "user_abc",
      email: "primary@example.com",
      syncSecret: SYNC_SECRET,
    });
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
    const msg = h.sendEmail.mock.calls[0][0];
    expect(msg.to).toBe("primary@example.com");
    expect(msg.idempotencyKey).toBe("welcome/user_abc");
    expect(msg.subject).toBe("Welcome to Roll & Read");
    expect(msg.text).toContain("/play");
  });

  test("never passes a plan to createUser (new users start free)", async () => {
    await POST(signed(userCreated()));
    expect(h.mutation.mock.calls[0][1]).not.toHaveProperty("plan");
  });

  test("falls back to the first email when no primary id is set", async () => {
    await POST(signed(userCreated({ primary_email_address_id: null })));
    expect(h.mutation.mock.calls[0][1].email).toBe("secondary@example.com");
    expect(h.sendEmail.mock.calls[0][0].to).toBe("secondary@example.com");
  });

  test("falls back to the first email when the primary id matches nothing", async () => {
    await POST(signed(userCreated({ primary_email_address_id: "idn_missing" })));
    expect(h.mutation.mock.calls[0][1].email).toBe("secondary@example.com");
  });

  test.each([
    ["empty list", { email_addresses: [] }],
    ["missing list", { email_addresses: undefined }],
  ])("no email addresses (%s): user is created with an empty email and no email is sent", async (_label, data) => {
    const res = await POST(signed(userCreated(data)));
    expect(res.status).toBe(200);
    expect(h.mutation.mock.calls[0][1].email).toBe("");
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  test("email failure does not fail the webhook", async () => {
    h.sendEmail.mockResolvedValue({ sent: false, reason: "resend 500" });
    const res = await POST(signed(userCreated()));
    expect(res.status).toBe(200);
  });

  test("Convex down: request fails (Clerk retries) and NO welcome email is sent", async () => {
    h.mutation.mockRejectedValueOnce(new Error("Convex unavailable"));
    await expect(POST(signed(userCreated()))).rejects.toThrow("Convex unavailable");
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  test("retry after a partial failure sends exactly one welcome email", async () => {
    const evt = userCreated();
    h.mutation.mockRejectedValueOnce(new Error("Convex unavailable"));
    await expect(POST(signed(evt))).rejects.toThrow();
    const res = await POST(signed(evt));
    expect(res.status).toBe(200);
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
  });

  test("duplicate deliveries reuse the same idempotency key (Resend dedupes)", async () => {
    const evt = userCreated();
    await POST(signed(evt));
    await POST(signed(evt));
    expect(h.sendEmail.mock.calls.map(([m]) => m.idempotencyKey)).toEqual(["welcome/user_abc", "welcome/user_abc"]);
  });
});

describe("user.updated", () => {
  test("syncs only the email — never the plan, never createUser, never an email", async () => {
    const res = await POST(
      signed({
        type: "user.updated",
        data: {
          id: "user_abc",
          primary_email_address_id: "idn_2",
          email_addresses: [
            { id: "idn_1", email_address: "old@example.com" },
            { id: "idn_2", email_address: "new@example.com" },
          ],
          public_metadata: { plan: "free" },
        },
      })
    );
    expect(res.status).toBe(200);
    expect(calledFunctions()).toEqual(["users:updateEmailFromClerk"]);
    expect(h.mutation.mock.calls[0][1]).toEqual({
      clerkId: "user_abc",
      email: "new@example.com",
      syncSecret: SYNC_SECRET,
    });
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  test("an update without any email address writes nothing", async () => {
    const res = await POST(signed({ type: "user.updated", data: { id: "user_abc", email_addresses: [] } }));
    expect(res.status).toBe(200);
    expect(h.mutation).not.toHaveBeenCalled();
  });
});

describe("other events", () => {
  test.each(["session.created", "email.created", "organization.created"])(
    "%s is acknowledged with 200 and ignored",
    async (type) => {
      const res = await POST(signed({ type, data: { id: "x" } }));
      expect(res.status).toBe(200);
      expect(h.mutation).not.toHaveBeenCalled();
      expect(h.sendEmail).not.toHaveBeenCalled();
    }
  );
});

describe("user.deleted (grown-up deleted their account)", () => {
  const deleted = (id = "user_abc") => signed({ type: "user.deleted", data: { id, deleted: true } });
  const sub = (stripeSubscriptionId: string | null, subscriptionStatus: string | null) => ({
    plan: "family",
    subscriptionStatus,
    stripeSubscriptionId,
  });

  test("cancels a live subscription, then deletes all the account's data", async () => {
    h.query.mockResolvedValue(sub("sub_123", "active"));
    const res = await POST(deleted());
    expect(res.status).toBe(200);
    expect(h.cancel).toHaveBeenCalledWith("sub_123");
    expect(calledFunctions()).toEqual(["dataLifecycle:deleteAccount"]);
    expect(h.mutation.mock.calls[0][1]).toEqual({ clerkId: "user_abc", syncSecret: SYNC_SECRET });
    expect(h.cancel.mock.invocationCallOrder[0]).toBeLessThan(h.mutation.mock.invocationCallOrder[0]);
  });

  test.each([
    ["free account", null, null],
    ["already canceled", "sub_1", "canceled"],
    ["expired checkout", "sub_1", "incomplete_expired"],
  ])("%s: nothing to cancel, data still deleted", async (_name, id, status) => {
    h.query.mockResolvedValue(id || status ? sub(id, status) : null);
    const res = await POST(deleted());
    expect(res.status).toBe(200);
    expect(h.cancel).not.toHaveBeenCalled();
    expect(calledFunctions()).toEqual(["dataLifecycle:deleteAccount"]);
  });

  test("a subscription Stripe no longer has is fine", async () => {
    h.query.mockResolvedValue(sub("sub_gone", "active"));
    h.cancel.mockRejectedValue(Object.assign(new Error("No such subscription"), { code: "resource_missing" }));
    const res = await POST(deleted());
    expect(res.status).toBe(200);
    expect(calledFunctions()).toEqual(["dataLifecycle:deleteAccount"]);
  });

  test("Stripe down: 500 so Clerk retries, and data is NOT deleted yet (billing must stop first)", async () => {
    h.query.mockResolvedValue(sub("sub_123", "active"));
    h.cancel.mockRejectedValue(new Error("Stripe unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(deleted());
    expect(res.status).toBe(500);
    expect(h.mutation).not.toHaveBeenCalled();
  });

  test("Convex down: 500 so Clerk retries", async () => {
    h.mutation.mockRejectedValue(new Error("Convex unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(deleted());
    expect(res.status).toBe(500);
  });

  test("an event without a user id is acknowledged and ignored", async () => {
    const res = await POST(signed({ type: "user.deleted", data: {} }));
    expect(res.status).toBe(200);
    expect(h.mutation).not.toHaveBeenCalled();
  });
});
