import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: h.auth, currentUser: h.currentUser }));

async function load() {
  return import("./auth-helpers");
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "false");
  h.auth.mockReset().mockResolvedValue({ userId: "user_abc" });
  h.currentUser.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("getEffectiveUserId", () => {
  test("returns the Clerk user id", async () => {
    expect(await (await load()).getEffectiveUserId()).toBe("user_abc");
  });

  test("signed out → null", async () => {
    h.auth.mockResolvedValue({ userId: null });
    expect(await (await load()).getEffectiveUserId()).toBeNull();
  });

  test("auth() throwing → null (never crashes the route)", async () => {
    h.auth.mockRejectedValue(new Error("no middleware"));
    expect(await (await load()).getEffectiveUserId()).toBeNull();
  });

  test("E2E mode outside production returns the test user when signed out", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");
    h.auth.mockResolvedValue({ userId: null });
    expect(await (await load()).getEffectiveUserId()).toBe("e2e_test_user");
  });

  test("E2E mode is ignored in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    h.auth.mockResolvedValue({ userId: null });
    expect(await (await load()).getEffectiveUserId()).toBeNull();
  });

  test("a real signed-in user wins over E2E mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(await (await load()).getEffectiveUserId()).toBe("user_abc");
  });
});

describe("getEffectiveEmail", () => {
  test("uses the PRIMARY email, not just the first one (Stripe receipts go there)", async () => {
    h.currentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "old-work@example.com" }, { emailAddress: "parent@example.com" }],
      primaryEmailAddress: { emailAddress: "parent@example.com" },
    });
    expect(await (await load()).getEffectiveEmail()).toBe("parent@example.com");
  });

  test("falls back to the first email when no primary is set", async () => {
    h.currentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: "only@example.com" }],
      primaryEmailAddress: null,
    });
    expect(await (await load()).getEffectiveEmail()).toBe("only@example.com");
  });

  test("no user / no emails / Clerk error → null", async () => {
    const mod = await load();
    h.currentUser.mockResolvedValue(null);
    expect(await mod.getEffectiveEmail()).toBeNull();
    h.currentUser.mockResolvedValue({ emailAddresses: [], primaryEmailAddress: null });
    expect(await mod.getEffectiveEmail()).toBeNull();
    h.currentUser.mockRejectedValue(new Error("clerk down"));
    expect(await mod.getEffectiveEmail()).toBeNull();
  });

  test("E2E email is never used in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    h.currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress: "real@example.com" }] });
    expect(await (await load()).getEffectiveEmail()).toBe("real@example.com");
  });
});
