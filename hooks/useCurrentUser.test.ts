// useCurrentUser is a thin wrapper around Clerk's useUser(); with useUser
// mocked it can be called as a plain function (no React rendering needed).
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({ useUser: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({ useUser: h.useUser }));

const realUser = { isLoaded: true, isSignedIn: true, user: { id: "user_real" } };

async function load() {
  return (await import("./useCurrentUser")).useCurrentUser;
}

beforeEach(() => {
  vi.resetModules();
  h.useUser.mockReset().mockReturnValue(realUser);
});
afterEach(() => vi.unstubAllEnvs());

describe("useCurrentUser", () => {
  test("returns Clerk's user normally", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "false");
    const useCurrentUser = await load();
    expect(useCurrentUser()).toBe(realUser);
    expect(h.useUser).toHaveBeenCalledTimes(1);
  });

  test("E2E mode (dev/test) returns the mock user but still calls useUser (rules of hooks)", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");
    const useCurrentUser = await load();
    expect(useCurrentUser().user?.id).toBe("e2e_test_user");
    expect(h.useUser).toHaveBeenCalledTimes(1);
  });

  // BUG (not fixed — hooks/ is outside this change's scope): middleware.ts and
  // lib/auth-helpers.ts ignore NEXT_PUBLIC_E2E_MODE in production, but this
  // hook does not. A stray NEXT_PUBLIC_E2E_MODE=true on Vercel prod would make
  // every signed-in browser act as "e2e_test_user" (Convex calls then fail as
  // Forbidden). Fix: gate IS_E2E with `process.env.NODE_ENV !== "production"`.
  test("E2E mode is ignored in production (same rule as middleware/auth-helpers)", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    const useCurrentUser = await load();
    expect(useCurrentUser()).toBe(realUser);
  });
});
