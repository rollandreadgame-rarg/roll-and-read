// Route protection. Uses Clerk's real createRouteMatcher; clerkMiddleware is
// replaced by an identity wrapper so the handler can be called with a fake auth.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return {
    ...actual,
    clerkMiddleware: (handler: unknown) => handler,
  };
});

type Handler = (auth: FakeAuth, req: NextRequest) => Promise<Response | void>;
type FakeAuth = (() => Promise<{ userId: string | null }>) & { protect: ReturnType<typeof vi.fn> };

function fakeAuth(userId: string | null): FakeAuth {
  const fn = (async () => ({ userId })) as FakeAuth;
  fn.protect = vi.fn(async () => {});
  return fn;
}

async function loadMiddleware() {
  const mod = await import("../middleware");
  return { handler: mod.default as unknown as Handler, config: mod.config };
}

async function run(path: string, userId: string | null) {
  const { handler } = await loadMiddleware();
  const auth = fakeAuth(userId);
  const res = await handler(auth, new NextRequest(`https://rollandreadgame.com${path}`));
  return { res, protect: auth.protect };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "false");
});
afterEach(() => vi.unstubAllEnvs());

describe("public routes are reachable signed out", () => {
  test.each([
    "/",
    "/help",
    "/privacy",
    "/terms",
    "/sign-in",
    "/sign-in/factor-one",
    "/sign-up",
    "/sign-up/verify-email-address",
    "/api/webhooks/stripe",
    "/api/webhooks/clerk",
    "/audio/words/cat.mp3",
    "/fonts/opendyslexic/LICENSE.txt",
  ])("%s", async (path) => {
    const { res, protect } = await run(path, null);
    expect(protect).not.toHaveBeenCalled();
    expect(res).toBeUndefined();
  });
});

describe("app routes require sign-in", () => {
  test.each([
    "/play",
    "/settings",
    "/billing",
    "/billing?status=success",
    "/teacher",
    "/dashboard",
    "/practice",
    "/shop",
    "/sticker-book",
    "/word-bank",
    "/api/stripe/create-checkout",
    "/api/stripe/create-portal",
    // Look-alikes of public paths must not slip through.
    "/helpdesk",
    "/privacy-admin",
    "/terms/../play",
  ])("%s calls auth.protect() when signed out", async (path) => {
    const { protect } = await run(path, null);
    expect(protect).toHaveBeenCalledTimes(1);
  });

  test("signed-in user on a protected route passes through protect()", async () => {
    const { res, protect } = await run("/play", "user_abc");
    expect(protect).toHaveBeenCalledTimes(1);
    expect(res).toBeUndefined();
  });
});

describe("signed-in redirects", () => {
  test.each(["/", "/sign-in", "/sign-up"])("signed-in user on %s is sent to /play", async (path) => {
    const { res } = await run(path, "user_abc");
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBeGreaterThanOrEqual(300);
    expect((res as Response).status).toBeLessThan(400);
    expect((res as Response).headers.get("location")).toBe("https://rollandreadgame.com/play");
  });

  test.each(["/help", "/privacy", "/terms", "/api/webhooks/stripe"])(
    "signed-in user on %s is NOT redirected",
    async (path) => {
      const { res } = await run(path, "user_abc");
      expect(res).toBeUndefined();
    }
  );

  test("redirect target is same-origin even for odd query strings", async () => {
    const { res } = await run("/?redirect_url=https://evil.example", "user_abc");
    expect(new URL((res as Response).headers.get("location")!).origin).toBe("https://rollandreadgame.com");
  });
});

describe("E2E passthrough", () => {
  test("is ignored in production even when NEXT_PUBLIC_E2E_MODE=true", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    const { protect } = await run("/play", null);
    expect(protect).toHaveBeenCalledTimes(1);
  });

  test("is used outside production when NEXT_PUBLIC_E2E_MODE=true", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");
    const { handler } = await loadMiddleware();
    const auth = fakeAuth(null);
    const res = (await handler(auth, new NextRequest("https://rollandreadgame.com/play"))) as Response;
    expect(auth.protect).not.toHaveBeenCalled();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("matcher config", () => {
  // Next compiles these with path-to-regexp; the patterns are written as raw
  // regex groups, so an anchored RegExp is equivalent for plain paths.
  async function matches(path: string) {
    const { config } = await loadMiddleware();
    return config.matcher.some((m: string) => new RegExp(`^${m}$`).test(path));
  }

  test.each(["/", "/play", "/billing", "/api/stripe/create-checkout", "/api/webhooks/stripe", "/help", "/data.json"])(
    "runs on %s",
    async (path) => {
      expect(await matches(path)).toBe(true);
    }
  );

  test.each([
    "/_next/static/chunks/main.js",
    "/audio/words/cat.mp3",
    "/audio/tutorial/step-1.mp3",
    "/favicon.ico",
    "/next.svg",
    "/fonts/lexend.woff2",
    "/styles.css",
  ])("skips static asset %s", async (path) => {
    expect(await matches(path)).toBe(false);
  });
});
