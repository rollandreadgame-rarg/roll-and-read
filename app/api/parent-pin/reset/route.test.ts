import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getFunctionName } from "convex/server";

const SYNC_SECRET = "unit-test-sync-secret";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  has: vi.fn(),
  mutation: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", async () => {
  const real = await vi.importActual<typeof import("@clerk/nextjs/server")>("@clerk/nextjs/server");
  return { auth: h.auth, reverificationError: real.reverificationError };
});
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    mutation = h.mutation;
    query = vi.fn();
  },
}));

async function post(body: unknown, raw = false) {
  const { POST } = await import("./route");
  return POST(
    new Request("https://rollandreadgame.com/api/parent-pin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ? (body as string) : JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("CONVEX_SYNC_SECRET", SYNC_SECRET);
  h.has.mockReset().mockReturnValue(true);
  h.auth.mockReset().mockResolvedValue({ userId: "user_abc", has: h.has });
  h.mutation.mockReset().mockResolvedValue({ ok: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("parent-pin reset route", () => {
  test("signed out → 401, nothing reset", async () => {
    h.auth.mockResolvedValue({ userId: null, has: h.has });
    const res = await post({ newPin: "1234" });
    expect(res.status).toBe(401);
    expect(h.mutation).not.toHaveBeenCalled();
  });

  test("not recently re-verified → Clerk's reverification error, nothing reset", async () => {
    h.has.mockReturnValue(false);
    const res = await post({ newPin: "1234" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.clerk_error).toMatchObject({ type: "forbidden", reason: "reverification-error" });
    expect(h.has).toHaveBeenCalledWith({ reverification: "strict" });
    expect(h.mutation).not.toHaveBeenCalled();
  });

  test.each([
    ["too short", { newPin: "12" }],
    ["letters", { newPin: "12ab" }],
    ["a number, not text", { newPin: 1234 }],
    ["missing", {}],
  ])("bad PIN (%s) → 400", async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(h.mutation).not.toHaveBeenCalled();
  });

  test("a body that isn't JSON → 400", async () => {
    const res = await post("{not json", true);
    expect(res.status).toBe(400);
    expect(h.mutation).not.toHaveBeenCalled();
  });

  test("verified → resets the CALLER's PIN with the sync secret", async () => {
    const res = await post({ newPin: "4321", clerkId: "user_victim" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(h.mutation).toHaveBeenCalledTimes(1);
    const [fn, args] = h.mutation.mock.calls[0];
    expect(getFunctionName(fn)).toBe("parentPin:resetParentPin");
    expect(args).toEqual({ clerkId: "user_abc", newPin: "4321", syncSecret: SYNC_SECRET });
  });

  test("Convex failure → 500 without leaking the error", async () => {
    h.mutation.mockRejectedValue(new Error("internal detail"));
    const res = await post({ newPin: "4321" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("internal detail");
  });
});
