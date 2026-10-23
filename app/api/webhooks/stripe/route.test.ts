// Stripe webhook handler. Signatures are produced and checked by the real
// Stripe SDK (no network); only the Stripe API, Convex and email are mocked.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { getFunctionName } from "convex/server";

const WEBHOOK_SECRET = "whsec_unit_test_only";
const SYNC_SECRET = "unit-test-sync-secret";

const h = vi.hoisted(() => ({
  retrieve: vi.fn(),
  mutation: vi.fn(),
  sendEmail: vi.fn(),
}));

// Real webhook helpers from an offline Stripe instance (dummy key, never used
// for a request), so constructEvent really verifies the HMAC.
const offlineStripe = new Stripe("sk_test_unit_dummy_never_sent");

vi.mock("@/lib/stripe", async () => {
  const { default: StripeSdk } = await import("stripe");
  const real = new StripeSdk("sk_test_unit_dummy_never_sent");
  return {
    stripe: {
      webhooks: real.webhooks,
      subscriptions: { retrieve: h.retrieve },
    },
  };
});

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    mutation = h.mutation;
    query = vi.fn();
  },
}));

vi.mock("@/lib/email/send", () => ({ sendEmail: h.sendEmail }));

import { POST } from "./route";

type Json = Record<string, unknown>;

function event(type: string, object: Json, id = "evt_1"): Json {
  return { id, object: "event", type, data: { object } };
}

function signedRequest(body: Json | string, opts: { secret?: string; header?: string | null } = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  const headers: Record<string, string> = {};
  if (opts.header !== null) {
    headers["stripe-signature"] =
      opts.header ??
      offlineStripe.webhooks.generateTestHeaderString({
        payload,
        secret: opts.secret ?? WEBHOOK_SECRET,
      });
  }
  return new NextRequest("https://rollandreadgame.com/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers,
  });
}

function subscription(overrides: Json = {}, item: Json = {}): Json {
  return {
    id: "sub_123",
    object: "subscription",
    customer: "cus_123",
    status: "active",
    cancel_at_period_end: false,
    items: {
      data: [
        {
          id: "si_1",
          current_period_end: 1_900_000_000,
          price: { id: "price_family", lookup_key: "family_monthly" },
          ...item,
        },
      ],
    },
    ...overrides,
  };
}

function invoice(overrides: Json = {}): Json {
  return {
    id: "in_123",
    object: "invoice",
    attempt_count: 1,
    customer_email: "parent@example.com",
    amount_due: 1299,
    currency: "usd",
    hosted_invoice_url: "https://invoice.stripe.com/i/abc",
    parent: { subscription_details: { subscription: "sub_123" } },
    ...overrides,
  };
}

function syncCalls() {
  return h.mutation.mock.calls.filter(
    ([ref]) => getFunctionName(ref) === "subscriptions:syncFromStripe"
  );
}

function lastSyncArgs() {
  const calls = syncCalls();
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][1] as Json;
}

beforeEach(() => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  vi.stubEnv("CONVEX_SYNC_SECRET", SYNC_SECRET);
  h.retrieve.mockReset();
  h.mutation.mockReset().mockResolvedValue(null);
  h.sendEmail.mockReset().mockResolvedValue({ sent: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("signature checks", () => {
  test("missing stripe-signature header is rejected with 400", async () => {
    const res = await POST(signedRequest(event("customer.subscription.updated", subscription()), { header: null }));
    expect(res.status).toBe(400);
    expect(h.retrieve).not.toHaveBeenCalled();
    expect(h.mutation).not.toHaveBeenCalled();
  });

  test("missing STRIPE_WEBHOOK_SECRET is rejected with 400", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const res = await POST(signedRequest(event("customer.subscription.updated", subscription())));
    expect(res.status).toBe(400);
    expect(h.mutation).not.toHaveBeenCalled();
  });

  test("a payload signed with a different secret is rejected with 400", async () => {
    const res = await POST(
      signedRequest(event("customer.subscription.updated", subscription()), { secret: "whsec_attacker" })
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as Json).error).toMatch(/Invalid signature/);
    expect(h.retrieve).not.toHaveBeenCalled();
    expect(h.mutation).not.toHaveBeenCalled();
  });

  test("a tampered payload (signature for a different body) is rejected", async () => {
    const original = JSON.stringify(event("customer.subscription.updated", subscription()));
    const header = offlineStripe.webhooks.generateTestHeaderString({ payload: original, secret: WEBHOOK_SECRET });
    const forged = original.replace("cus_123", "cus_victim");
    const res = await POST(signedRequest(forged, { header }));
    expect(res.status).toBe(400);
    expect(h.mutation).not.toHaveBeenCalled();
  });

  test("garbage signature header is rejected", async () => {
    const res = await POST(signedRequest(event("invoice.payment_failed", invoice()), { header: "t=1,v1=deadbeef" }));
    expect(res.status).toBe(400);
  });
});

describe("event routing", () => {
  test.each(["customer.created", "invoice.paid", "payment_intent.succeeded", "charge.refunded"])(
    "irrelevant event %s is acknowledged and ignored",
    async (type) => {
      const res = await POST(signedRequest(event(type, { id: "obj_1" })));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ received: true, ignored: type });
      expect(h.retrieve).not.toHaveBeenCalled();
      expect(h.mutation).not.toHaveBeenCalled();
      expect(h.sendEmail).not.toHaveBeenCalled();
    }
  );

  test("checkout.session.completed for a one-off payment is skipped", async () => {
    const res = await POST(
      signedRequest(event("checkout.session.completed", { id: "cs_1", mode: "payment", subscription: null }))
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as Json).skipped).toBe("non-subscription checkout");
    expect(h.retrieve).not.toHaveBeenCalled();
    expect(h.mutation).not.toHaveBeenCalled();
  });

  test("checkout.session.completed in subscription mode but without a subscription id is skipped", async () => {
    const res = await POST(
      signedRequest(event("checkout.session.completed", { id: "cs_1", mode: "subscription", subscription: null }))
    );
    expect(res.status).toBe(200);
    expect(h.mutation).not.toHaveBeenCalled();
  });

  test("checkout.session.completed fetches the subscription and syncs it", async () => {
    h.retrieve.mockResolvedValue(subscription());
    const res = await POST(
      signedRequest(event("checkout.session.completed", { id: "cs_1", mode: "subscription", subscription: "sub_123" }))
    );
    expect(res.status).toBe(200);
    expect(h.retrieve).toHaveBeenCalledWith("sub_123", { expand: ["items.data.price"] });
    expect(lastSyncArgs()).toEqual({
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_family",
      priceLookupKey: "family_monthly",
      subscriptionStatus: "active",
      currentPeriodEnd: 1_900_000_000,
      cancelAtPeriodEnd: false,
      syncSecret: SYNC_SECRET,
    });
    expect(h.sendEmail).not.toHaveBeenCalled();
  });
});

describe("subscription events", () => {
  test.each(["customer.subscription.created", "customer.subscription.updated"])(
    "%s re-fetches the subscription and syncs the fetched (fresh) state, not the payload",
    async (type) => {
      // Payload is stale: says active / individual. Fresh copy is past_due / classroom.
      h.retrieve.mockResolvedValue(
        subscription({ status: "past_due", cancel_at_period_end: true }, {
          price: { id: "price_class", lookup_key: "classroom_monthly" },
        })
      );
      const res = await POST(
        signedRequest(event(type, subscription({}, { price: { id: "price_ind", lookup_key: "individual_monthly" } })))
      );
      expect(res.status).toBe(200);
      expect(h.retrieve).toHaveBeenCalledWith("sub_123", { expand: ["items.data.price"] });
      const args = lastSyncArgs();
      expect(args.subscriptionStatus).toBe("past_due");
      expect(args.priceLookupKey).toBe("classroom_monthly");
      expect(args.stripePriceId).toBe("price_class");
      expect(args.cancelAtPeriodEnd).toBe(true);
    }
  );

  test("customer.subscription.deleted always syncs status 'canceled'", async () => {
    // Even if the re-fetched object still says active (eventual consistency).
    h.retrieve.mockResolvedValue(subscription({ status: "active" }));
    const res = await POST(signedRequest(event("customer.subscription.deleted", subscription({ status: "canceled" }))));
    expect(res.status).toBe(200);
    expect(lastSyncArgs().subscriptionStatus).toBe("canceled");
  });

  test("period end falls back to the subscription when the item has none", async () => {
    h.retrieve.mockResolvedValue(
      subscription({ current_period_end: 1_850_000_000 }, { current_period_end: undefined })
    );
    await POST(signedRequest(event("customer.subscription.updated", subscription())));
    expect(lastSyncArgs().currentPeriodEnd).toBe(1_850_000_000);
  });

  test("item period end wins over the legacy subscription field", async () => {
    h.retrieve.mockResolvedValue(subscription({ current_period_end: 1_000 }, { current_period_end: 2_000 }));
    await POST(signedRequest(event("customer.subscription.updated", subscription())));
    expect(lastSyncArgs().currentPeriodEnd).toBe(2_000);
  });

  test("missing period end, lookup key and cancel flag are sent as undefined/false", async () => {
    h.retrieve.mockResolvedValue(
      subscription({ cancel_at_period_end: undefined }, {
        current_period_end: undefined,
        price: { id: "price_x", lookup_key: null },
      })
    );
    await POST(signedRequest(event("customer.subscription.updated", subscription())));
    const args = lastSyncArgs();
    expect(args.currentPeriodEnd).toBeUndefined();
    expect(args.priceLookupKey).toBeUndefined();
    expect(args.cancelAtPeriodEnd).toBe(false);
  });

  test("a subscription with no items still syncs (plan resolves to free downstream)", async () => {
    h.retrieve.mockResolvedValue(subscription({ items: { data: [] } }));
    const res = await POST(signedRequest(event("customer.subscription.updated", subscription())));
    expect(res.status).toBe(200);
    const args = lastSyncArgs();
    expect(args.stripePriceId).toBeUndefined();
    expect(args.priceLookupKey).toBeUndefined();
  });

  test("Convex failure returns 500 so Stripe retries", async () => {
    h.retrieve.mockResolvedValue(subscription());
    h.mutation.mockRejectedValue(new Error("Convex unavailable"));
    const res = await POST(signedRequest(event("customer.subscription.updated", subscription())));
    expect(res.status).toBe(500);
  });

  test("Stripe API failure while re-fetching returns 500 so Stripe retries", async () => {
    h.retrieve.mockRejectedValue(new Error("Stripe 503"));
    const res = await POST(signedRequest(event("customer.subscription.updated", subscription())));
    expect(res.status).toBe(500);
    expect(h.mutation).not.toHaveBeenCalled();
  });
});

describe("invoice.payment_failed", () => {
  test("resolves the subscription from parent.subscription_details (basil+ API)", async () => {
    h.retrieve.mockResolvedValue(subscription({ status: "past_due" }));
    const res = await POST(signedRequest(event("invoice.payment_failed", invoice())));
    expect(res.status).toBe(200);
    expect(h.retrieve).toHaveBeenCalledWith("sub_123", { expand: ["items.data.price"] });
    expect(lastSyncArgs().subscriptionStatus).toBe("past_due");
  });

  test("resolves the subscription from lines[0].parent.subscription_item_details", async () => {
    h.retrieve.mockResolvedValue(subscription({ id: "sub_lines" }));
    await POST(
      signedRequest(
        event(
          "invoice.payment_failed",
          invoice({
            parent: null,
            lines: { data: [{ parent: { subscription_item_details: { subscription: "sub_lines" } } }] },
          })
        )
      )
    );
    expect(h.retrieve).toHaveBeenCalledWith("sub_lines", { expand: ["items.data.price"] });
    expect(lastSyncArgs().stripeSubscriptionId).toBe("sub_lines");
  });

  test("falls back to the legacy top-level invoice.subscription", async () => {
    h.retrieve.mockResolvedValue(subscription({ id: "sub_legacy" }));
    await POST(signedRequest(event("invoice.payment_failed", invoice({ parent: null, subscription: "sub_legacy" }))));
    expect(h.retrieve).toHaveBeenCalledWith("sub_legacy", { expand: ["items.data.price"] });
  });

  test("ignores a non-string legacy subscription field and skips when nothing resolves", async () => {
    const res = await POST(
      signedRequest(
        event(
          "invoice.payment_failed",
          invoice({ parent: null, lines: { data: [] }, subscription: { id: "sub_obj" } })
        )
      )
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as Json).skipped).toBe("invoice has no subscription");
    expect(h.retrieve).not.toHaveBeenCalled();
    expect(h.mutation).not.toHaveBeenCalled();
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  test("first failed attempt emails the customer with plan, amount, pay link and an idempotency key", async () => {
    h.retrieve.mockResolvedValue(subscription({ status: "past_due" }));
    await POST(signedRequest(event("invoice.payment_failed", invoice())));
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
    const msg = h.sendEmail.mock.calls[0][0];
    expect(msg.to).toBe("parent@example.com");
    expect(msg.idempotencyKey).toBe("payment-failed/in_123");
    expect(msg.subject).toMatch(/payment didn't go through/);
    expect(msg.text).toContain("Family plan");
    expect(msg.text).toContain("($12.99)");
    expect(msg.text).toContain("https://invoice.stripe.com/i/abc");
    expect(msg.html).toContain("Family plan");
  });

  test("email is sent only after the Convex sync succeeded", async () => {
    h.retrieve.mockResolvedValue(subscription({ status: "past_due" }));
    await POST(signedRequest(event("invoice.payment_failed", invoice())));
    const syncOrder = h.mutation.mock.invocationCallOrder[0];
    const emailOrder = h.sendEmail.mock.invocationCallOrder[0];
    expect(syncOrder).toBeLessThan(emailOrder);
  });

  test.each([2, 3, 4])("retry attempt %i does not email again", async (attempt) => {
    h.retrieve.mockResolvedValue(subscription({ status: "past_due" }));
    const res = await POST(signedRequest(event("invoice.payment_failed", invoice({ attempt_count: attempt }))));
    expect(res.status).toBe(200);
    expect(syncCalls()).toHaveLength(1);
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  test("no customer_email means no email (but still syncs)", async () => {
    h.retrieve.mockResolvedValue(subscription({ status: "past_due" }));
    const res = await POST(signedRequest(event("invoice.payment_failed", invoice({ customer_email: null }))));
    expect(res.status).toBe(200);
    expect(syncCalls()).toHaveLength(1);
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  test("missing amount/currency and unknown lookup key still produce a readable email", async () => {
    h.retrieve.mockResolvedValue(subscription({}, { price: { id: "p", lookup_key: null } }));
    await POST(
      signedRequest(
        event("invoice.payment_failed", invoice({ amount_due: null, currency: null, hosted_invoice_url: null }))
      )
    );
    const msg = h.sendEmail.mock.calls[0][0];
    expect(msg.text).toContain("your Roll & Read subscription.");
    expect(msg.text).not.toContain("undefined");
    expect(msg.text).not.toContain("null");
    expect(msg.html).not.toContain("pay invoice");
  });

  test("an email delivery failure does not fail the webhook", async () => {
    h.retrieve.mockResolvedValue(subscription({ status: "past_due" }));
    h.sendEmail.mockResolvedValue({ sent: false, reason: "resend 500" });
    const res = await POST(signedRequest(event("invoice.payment_failed", invoice())));
    expect(res.status).toBe(200);
  });

  test("Convex down: 500, no email; Stripe's retry of the same event then emails exactly once", async () => {
    h.retrieve.mockResolvedValue(subscription({ status: "past_due" }));
    const evt = event("invoice.payment_failed", invoice(), "evt_retry");

    h.mutation.mockRejectedValueOnce(new Error("Convex unavailable"));
    const first = await POST(signedRequest(evt));
    expect(first.status).toBe(500);
    expect(h.sendEmail).not.toHaveBeenCalled();

    // Stripe redelivers the identical event (attempt_count is still 1 in it).
    const second = await POST(signedRequest(evt));
    expect(second.status).toBe(200);
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
  });

  test("a duplicate delivery after success re-sends with the SAME idempotency key (Resend dedupes)", async () => {
    h.retrieve.mockResolvedValue(subscription({ status: "past_due" }));
    const evt = event("invoice.payment_failed", invoice(), "evt_dup");
    await POST(signedRequest(evt));
    await POST(signedRequest(evt));
    const keys = h.sendEmail.mock.calls.map(([m]) => m.idempotencyKey);
    expect(keys).toEqual(["payment-failed/in_123", "payment-failed/in_123"]);
  });
});
