// Gaps not covered by email.test.ts: network failure, no recipient, env
// handling, and output hygiene of the templates.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sendEmail", () => {
  test("a network failure (fetch throws) returns sent:false instead of throwing", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_unit_dummy");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("fetch failed"))));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendEmail } = await import("./send");
    await expect(
      sendEmail({ to: "a@example.com", subject: "s", html: "<p>h</p>", text: "t", idempotencyKey: "k" })
    ).resolves.toEqual({ sent: false, reason: "network" });
  });

  test("no recipient never calls Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_unit_dummy");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail } = await import("./send");
    await expect(
      sendEmail({ to: "", subject: "s", html: "h", text: "t", idempotencyKey: "k" })
    ).resolves.toEqual({ sent: false, reason: "no recipient" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("EMAIL_FROM overrides the sender", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_unit_dummy");
    vi.stubEnv("EMAIL_FROM", "Test <test@rollandreadgame.com>");
    const fetchMock = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail } = await import("./send");
    await sendEmail({ to: "a@example.com", subject: "s", html: "h", text: "t", idempotencyKey: "k" });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.from).toBe("Test <test@rollandreadgame.com>");
    expect(body.to).toEqual(["a@example.com"]);
  });

  test("the API key never ends up in the logged error body", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_unit_dummy_secret");
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("rate limited", { status: 429 }))));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendEmail } = await import("./send");
    const r = await sendEmail({ to: "a@example.com", subject: "s", html: "h", text: "t", idempotencyKey: "k" });
    expect(r).toEqual({ sent: false, reason: "resend 429" });
    expect(JSON.stringify(err.mock.calls)).not.toContain("re_unit_dummy_secret");
  });
});

describe("templates", () => {
  test("a trailing slash on NEXT_PUBLIC_APP_URL never produces '//' links", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://rollandreadgame.com/");
    const { welcomeEmail } = await import("./templates");
    const m = welcomeEmail();
    expect(m.html).not.toMatch(/rollandreadgame\.com\/\//);
    expect(m.text).not.toMatch(/rollandreadgame\.com\/\//);
    expect(m.text).toContain("https://rollandreadgame.com/play");
  });

  test("defaults to the production domain when NEXT_PUBLIC_APP_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
    const { welcomeEmail } = await import("./templates");
    expect(welcomeEmail().text).toContain("https://rollandreadgame.com/play");
  });

  test("every email has a matching plain-text twin with the support address", async () => {
    const { welcomeEmail } = await import("./templates");
    for (const m of [welcomeEmail()]) {
      expect(m.text).toContain("support@rollandreadgame.com");
      expect(m.html).toContain("mailto:support@rollandreadgame.com");
      expect(m.html).toMatch(/^<!doctype html>/);
      expect(m.html).toContain('lang="en"');
      expect(m.text).not.toMatch(/<[a-z]/i);
    }
  });
});
