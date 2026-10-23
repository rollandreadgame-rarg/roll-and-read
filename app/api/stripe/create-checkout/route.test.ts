import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { getFunctionName } from "convex/server";

const SYNC_SECRET = "unit-test-sync-secret";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  query: vi.fn(),
  mutation: vi.fn(),
  pricesList: vi.fn(),
  customersCreate: vi.fn(),
  sessionsCreate: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: h.auth, currentUser: h.currentUser }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = h.query;
    mutation = h.mutation;
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    prices: { list: h.pricesList },
    customers: { create: h.customersCreate },
    checkout: { sessions: { create: h.sessionsCreate } },
  },
}));

type Json = Record<string, unknown>;

async function loadRoute() {
  return (await import("./route")).POST;
}

function req(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://rollandreadgame.com/api/stripe/create-checkout", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rollandreadgame.com");
  vi.stubEnv("CONVEX_SYNC_SECRET", SYNC_SECRET);
  vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "false");
  h.auth.mockReset().mockResolvedValue({ userId: "user_abc" });
  h.currentUser.mockReset().mockResolvedValue({ emailAddresses: [{ emailAddress: "parent@example.com" }] });
  h.query.mockReset().mockResolvedValue(null);
  h.mutation.mockReset().mockResolvedValue(null);
  h.pricesList.mockReset().mockResolvedValue({ data: [{ id: "price_family" }] });
  h.customersCreate.mockReset().mockResolvedValue({ id: "cus_new" });
  h.sessionsCreate.mockReset().mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_1" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("auth", () => {
  test("signed-out caller gets 401 and nothing is created", async () => {
    h.auth.mockResolvedValue({ userId: null });
    const POST = await loadRoute();
    const res = await POST(req({ lookupKey: "family_monthly" }));
    expect(res.status).toBe(401);
    expect(h.pricesList).not.toHaveBeenCalled();
    expect(h.customersCreate).not.toHaveBeenCalled();
  });

  test("auth() throwing (middleware did not run) is treated as signed out", async () => {
    h.auth.mockRejectedValue(new Error("clerkMiddleware not detected"));
    const POST = await loadRoute();
    expect((await POST(req({ lookupKey: "family_monthly" }))).status).toBe(401);
  });

  test("E2E bypass is never honored in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    h.auth.mockResolvedValue({ userId: null });
    const POST = await loadRoute();
    expect((await POST(req({ lookupKey: "family_monthly" }))).status).toBe(401);
    expect(h.sessionsCreate).not.toHaveBeenCalled();
  });
});

describe("input validation", () => {
  test.each([
    ["invalid JSON", "{not json"],
    ["JSON null", "null"],
  ])("%s → 400", async (_label, body) => {
    const POST = await loadRoute();
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(h.pricesList).not.toHaveBeenCalled();
  });

  test.each([
    ["missing", {}],
    ["unknown plan", { lookupKey: "enterprise_monthly" }],
    ["free", { lookupKey: "free" }],
    ["array", { lookupKey: ["family_monthly"] }],
    ["object", { lookupKey: { toString: "family_monthly" } }],
    ["case variant", { lookupKey: "FAMILY_MONTHLY" }],
    ["empty string", { lookupKey: "" }],
  ])("lookupKey %s → 400", async (_label, body) => {
    const POST = await loadRoute();
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(h.pricesList).not.toHaveBeenCalled();
    expect(h.sessionsCreate).not.toHaveBeenCalled();
  });
});

describe("existing subscription", () => {
  test.each(["active", "trialing", "past_due"])(
    "a live (%s) subscription → 409, no second subscription",
    async (status) => {
      h.query.mockResolvedValue({ stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: status });
      const POST = await loadRoute();
      const res = await POST(req({ lookupKey: "classroom_monthly" }));
      expect(res.status).toBe(409);
      expect(h.sessionsCreate).not.toHaveBeenCalled();
    }
  );

  test.each(["canceled", "unpaid", "incomplete_expired"])(
    "a dead (%s) subscription may check out again, reusing the customer",
    async (status) => {
      h.query.mockResolvedValue({ stripeCustomerId: "cus_old", stripeSubscriptionId: "sub_1", subscriptionStatus: status });
      const POST = await loadRoute();
      const res = await POST(req({ lookupKey: "family_monthly" }));
      expect(res.status).toBe(200);
      expect(h.customersCreate).not.toHaveBeenCalled();
      expect(h.sessionsCreate.mock.calls[0][0].customer).toBe("cus_old");
    }
  );
});

describe("checkout session", () => {
  test("looks the price up by lookup key and returns the session URL", async () => {
    const POST = await loadRoute();
    const res = await POST(req({ lookupKey: "family_monthly" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_1" });
    expect(h.pricesList).toHaveBeenCalledWith(
      expect.objectContaining({ lookup_keys: ["family_monthly"], limit: 1 })
    );
    const params = h.sessionsCreate.mock.calls[0][0];
    expect(params.mode).toBe("subscription");
    expect(params.line_items).toEqual([{ price: "price_family", quantity: 1 }]);
    expect(params.client_reference_id).toBe("user_abc");
  });

  test("checks the caller's own subscription (by their Clerk id) with the sync secret", async () => {
    const POST = await loadRoute();
    await POST(req({ lookupKey: "family_monthly" }));
    const [ref, args] = h.query.mock.calls[0];
    expect(getFunctionName(ref)).toBe("subscriptions:getByClerkId");
    expect(args).toEqual({ clerkId: "user_abc", syncSecret: SYNC_SECRET });
  });

  test("unknown price in Stripe → 404, no customer/session", async () => {
    h.pricesList.mockResolvedValue({ data: [] });
    const POST = await loadRoute();
    const res = await POST(req({ lookupKey: "individual_monthly" }));
    expect(res.status).toBe(404);
    expect(h.customersCreate).not.toHaveBeenCalled();
    expect(h.sessionsCreate).not.toHaveBeenCalled();
  });

  test("new customer: created once (idempotent), saved to Convex before the session is made", async () => {
    const POST = await loadRoute();
    await POST(req({ lookupKey: "family_monthly" }));
    expect(h.customersCreate).toHaveBeenCalledWith(
      { email: "parent@example.com", metadata: { clerkId: "user_abc" } },
      { idempotencyKey: "create-customer-user_abc" }
    );
    const [ref, args] = h.mutation.mock.calls[0];
    expect(getFunctionName(ref)).toBe("subscriptions:setStripeCustomerId");
    expect(args).toEqual({ clerkId: "user_abc", stripeCustomerId: "cus_new", syncSecret: SYNC_SECRET });
    expect(h.mutation.mock.invocationCallOrder[0]).toBeLessThan(h.sessionsCreate.mock.invocationCallOrder[0]);
    expect(h.sessionsCreate.mock.calls[0][0].customer).toBe("cus_new");
  });

  test("existing customer is reused (no duplicate Stripe customer)", async () => {
    h.query.mockResolvedValue({ stripeCustomerId: "cus_existing", subscriptionStatus: null });
    const POST = await loadRoute();
    await POST(req({ lookupKey: "family_monthly" }));
    expect(h.customersCreate).not.toHaveBeenCalled();
    expect(h.mutation).not.toHaveBeenCalled();
    expect(h.sessionsCreate.mock.calls[0][0].customer).toBe("cus_existing");
  });

  test("success/cancel URLs come only from NEXT_PUBLIC_APP_URL (no open redirect from the request)", async () => {
    const POST = await loadRoute();
    await POST(
      req(
        {
          lookupKey: "family_monthly",
          successUrl: "https://evil.example/steal",
          cancelUrl: "https://evil.example/steal",
          success_url: "https://evil.example/steal",
        },
        { origin: "https://evil.example", host: "evil.example", referer: "https://evil.example/x", "x-forwarded-host": "evil.example" }
      )
    );
    const params = h.sessionsCreate.mock.calls[0][0];
    expect(params.success_url).toBe("https://rollandreadgame.com/billing?status=success");
    expect(params.cancel_url).toBe("https://rollandreadgame.com/billing?status=cancel");
    expect(JSON.stringify(params)).not.toContain("evil");
  });

  test("a trailing slash on NEXT_PUBLIC_APP_URL does not produce '//billing'", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rollandreadgame.com/");
    const POST = await loadRoute();
    await POST(req({ lookupKey: "family_monthly" }));
    const params = h.sessionsCreate.mock.calls[0][0];
    expect(params.success_url).toBe("https://rollandreadgame.com/billing?status=success");
    expect(params.cancel_url).toBe("https://rollandreadgame.com/billing?status=cancel");
  });

  test("Stripe errors → 500 with a generic message (no Stripe internals leaked)", async () => {
    h.sessionsCreate.mockRejectedValue(new Error("No such customer: 'cus_secret_internal'"));
    const POST = await loadRoute();
    const res = await POST(req({ lookupKey: "family_monthly" }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as Json;
    expect(body.error).toBe("Could not start checkout");
    expect(JSON.stringify(body)).not.toContain("cus_secret_internal");
  });

  test("Convex failure saving the new customer → 500 and no checkout session", async () => {
    h.mutation.mockRejectedValue(new Error("Convex down"));
    const POST = await loadRoute();
    const res = await POST(req({ lookupKey: "family_monthly" }));
    expect(res.status).toBe(500);
    expect(h.sessionsCreate).not.toHaveBeenCalled();
  });

  test("no email on the Clerk user still creates a customer (email undefined)", async () => {
    h.currentUser.mockResolvedValue({ emailAddresses: [] });
    const POST = await loadRoute();
    const res = await POST(req({ lookupKey: "individual_monthly" }));
    expect(res.status).toBe(200);
    expect(h.customersCreate.mock.calls[0][0].email).toBeUndefined();
  });
});
