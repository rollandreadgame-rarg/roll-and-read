import fs from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { AUTH_FILE, DEV_USER_ID, readEnvLocal } from "./env";

/**
 * Signs the dev user in without a password: mint a one-time Clerk sign-in
 * ticket with the DEV secret key, open /sign-in?__clerk_ticket=..., wait for
 * the redirect into the app and save the browser storage state.
 */
export default async function globalSetup(config: FullConfig) {
  const env = readEnvLocal();
  const secret = env.CLERK_SECRET_KEY ?? "";
  // Guard rails: the suite must only ever touch the DEV Clerk instance and the
  // DEV Convex deployment. (Values are checked, never printed.)
  if (!secret.startsWith("sk_test_")) {
    throw new Error("e2e: CLERK_SECRET_KEY in .env.local is not a Clerk DEV (sk_test_) key; refusing to run.");
  }
  if (!(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_test_")) {
    throw new Error("e2e: the app is not configured with the DEV Clerk instance; refusing to run.");
  }
  if (!(env.NEXT_PUBLIC_CONVEX_URL ?? "").includes("adamant-hound-452")) {
    throw new Error("e2e: NEXT_PUBLIC_CONVEX_URL is not the DEV Convex deployment; refusing to run.");
  }

  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: DEV_USER_ID, expires_in_seconds: 900 }),
  });
  if (!res.ok) throw new Error(`e2e: Clerk sign_in_tokens failed with HTTP ${res.status}`);
  const { token } = (await res.json()) as { token?: string };
  if (!token) throw new Error("e2e: Clerk sign_in_tokens returned no token");

  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto(`/sign-in?__clerk_ticket=${encodeURIComponent(token)}`);
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 60_000 });
    // Let Clerk finish writing its session cookies before saving them.
    await page.waitForLoadState("networkidle").catch(() => {});
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    await context.storageState({ path: AUTH_FILE });
  } finally {
    await browser.close();
  }
}
