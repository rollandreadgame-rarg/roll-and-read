import { test, expect } from "@playwright/test";
import { readEnvLocal } from "./env";
import { trackErrors } from "./helpers";

test.describe("billing", () => {
  test("free plan: current plan and upgrade options render", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/billing");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Billing and plan", { timeout: 30_000 });
    const current = page.locator('section[aria-labelledby="current-plan-heading"]');
    await expect(current).toContainText(/free/i);
    await expect(current).toContainText(/1 of 1 profile used/);
    for (const name of ["Individual", "Family", "Classroom"]) {
      await expect(page.getByRole("button", { name: `Choose ${name}` })).toBeEnabled();
    }
    await expect(page.getByRole("button", { name: "Manage subscription" })).toHaveCount(0);
    expect(errors, "console/page errors").toEqual([]);
  });

  test("a failed checkout start shows an error and re-enables the button", async ({ page }) => {
    await page.route("**/api/stripe/create-checkout", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Could not start checkout" }) })
    );
    await page.goto("/billing");
    const choose = page.getByRole("button", { name: "Choose Family" });
    await expect(choose).toBeEnabled({ timeout: 30_000 });
    await choose.click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Could not start checkout");
    await expect(choose).toBeEnabled();
    expect(new URL(page.url()).pathname).toBe("/billing");
  });

  test("upgrade button opens Stripe Checkout (test mode only)", async ({ page }) => {
    // Only with a Stripe TEST key — never against live billing. No card is entered.
    const key = readEnvLocal().STRIPE_SECRET_KEY ?? "";
    test.skip(!key.startsWith("sk_test_"), "STRIPE_SECRET_KEY is not a test-mode key");
    // Preflight: the local dev server can only create a session if Stripe
    // accepts the key (the key itself is never printed).
    const probe = await fetch("https://api.stripe.com/v1/prices?limit=1", {
      headers: { Authorization: `Bearer ${key}` },
    });
    test.skip(probe.status === 401, "Stripe rejects the local STRIPE_SECRET_KEY (expired/revoked test key)");
    await page.goto("/billing");
    const choose = page.getByRole("button", { name: "Choose Individual" });
    await expect(choose).toBeEnabled({ timeout: 30_000 });
    await choose.click();
    await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 45_000 });
    expect(new URL(page.url()).hostname).toBe("checkout.stripe.com");
    // Leave without paying.
    await page.goto("about:blank");
  });
});
