import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";

const SYNC_SECRET = "unit-test-sync-secret";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  portalCreate: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: h.auth, currentUser: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = h.query;
    mutation = vi.fn();
  },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: { billingPortal: { sessions: { create: h.portalCreate } } },
}));

async function loadRoute() {
  return (await import("./route")).POST;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rollandreadgame.com");
  vi.stubEnv("CONVEX_SYNC_SECRET", SYNC_SECRET);
  vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "false");
  h.auth.mockReset().mockResolvedValue({ userId: "user_abc" });
  h.query.mockReset().mockResolvedValue({ stripeCustomerId: "cus_1" });
  h.portalCreate.mockReset().mockResolvedValue({ url: "https://billing.stripe.com/p/session/x" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("create-portal", () => {
  test("signed-out → 401, Stripe not called", async () => {
    h.auth.mockResolvedValue({ userId: null });
    const POST = await loadRoute();
    const res = await POST();
    expect(res.status).toBe(401);
    expect(h.query).not.toHaveBeenCalled();
    expect(h.portalCreate).not.toHaveBeenCalled();
  });

  test.each([
    ["no Convex record", null],
    ["record without a Stripe customer", { stripeCustomerId: undefined }],
  ])("%s → 400 (never opens a portal for someone else)", async (_label, sub) => {
    h.query.mockResolvedValue(sub);
    const POST = await loadRoute();
    const res = await POST();
    expect(res.status).toBe(400);
    expect(h.portalCreate).not.toHaveBeenCalled();
  });

  test("opens the portal for the caller's own customer and returns to /billing", async () => {
    const POST = await loadRoute();
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://billing.stripe.com/p/session/x" });
    const [ref, args] = h.query.mock.calls[0];
    expect(getFunctionName(ref)).toBe("subscriptions:getByClerkId");
    expect(args).toEqual({ clerkId: "user_abc", syncSecret: SYNC_SECRET });
    expect(h.portalCreate).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://rollandreadgame.com/billing",
    });
  });

  test("a trailing slash on NEXT_PUBLIC_APP_URL does not produce '//billing'", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rollandreadgame.com/");
    const POST = await loadRoute();
    await POST();
    expect(h.portalCreate.mock.calls[0][0].return_url).toBe("https://rollandreadgame.com/billing");
  });

  test("Stripe error → 500 with a generic message", async () => {
    h.portalCreate.mockRejectedValue(new Error("No configuration provided; internal detail"));
    const POST = await loadRoute();
    const res = await POST();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not open billing portal" });
  });
});
