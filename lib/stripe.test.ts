import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({ ctor: vi.fn() }));

vi.mock("stripe", () => {
  class FakeStripe {
    key: string;
    subscriptions = {
      owner: null as unknown,
      retrieve(this: { owner: unknown }) {
        return this;
      },
    };
    constructor(key: string, opts: unknown) {
      h.ctor(key, opts);
      this.key = key;
    }
    whoAmI() {
      return this;
    }
  }
  return { default: FakeStripe };
});

async function load() {
  return (await import("./stripe")).stripe;
}

beforeEach(() => {
  vi.resetModules();
  h.ctor.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("lazy Stripe client", () => {
  test("importing the module never constructs the client (builds work without a key)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    await load();
    expect(h.ctor).not.toHaveBeenCalled();
  });

  test("using it without STRIPE_SECRET_KEY throws a helpful error", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const stripe = await load();
    expect(() => stripe.subscriptions).toThrow(/STRIPE_SECRET_KEY is not set/);
    expect(h.ctor).not.toHaveBeenCalled();
  });

  test("constructs once on first use with the pinned API version, then reuses it", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit_dummy");
    const stripe = await load();
    void stripe.subscriptions;
    void stripe.subscriptions;
    void stripe.webhooks;
    expect(h.ctor).toHaveBeenCalledTimes(1);
    expect(h.ctor).toHaveBeenCalledWith("sk_test_unit_dummy", expect.objectContaining({ apiVersion: "2026-04-22.dahlia" }));
  });

  test("a failed first use (no key) is not cached: setting the key later works", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const stripe = await load();
    expect(() => stripe.subscriptions).toThrow();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_later");
    expect(() => stripe.subscriptions).not.toThrow();
    expect(h.ctor).toHaveBeenCalledWith("sk_test_later", expect.anything());
  });

  test("awaiting / resolving the client is safe without a key (not treated as a thenable)", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const { stripe } = await import("./stripe");
    await expect(Promise.resolve(stripe)).resolves.toBe(stripe);
    expect(h.ctor).not.toHaveBeenCalled();
  });

  test("methods on the client are bound to the real client, even when detached", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit_dummy");
    const stripe = await load();
    const { whoAmI } = stripe as unknown as { whoAmI: () => { key: string } };
    expect(whoAmI().key).toBe("sk_test_unit_dummy");
  });

  test("nested resources keep their own `this`", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit_dummy");
    const stripe = await load();
    const subs = stripe.subscriptions as unknown as { retrieve: () => unknown };
    expect(subs.retrieve()).toBe(subs);
  });
});
