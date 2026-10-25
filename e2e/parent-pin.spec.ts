import { test, expect, type Page } from "@playwright/test";
import { snap } from "./helpers";

// Grown-up PIN: create, lock, forgot-PIN reset (server-checked through Clerk
// reverification), and removal so the dev account is left without a PIN.

async function typePin(page: Page, label: string, pin: string) {
  const first = page.getByRole("textbox", { name: `${label} digit 1`, exact: true });
  await expect(first).toBeVisible();
  await first.click();
  await page.keyboard.type(pin, { delay: 60 });
}

async function openSettings(page: Page) {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
}

const gate = (page: Page) => page.getByRole("dialog", { name: "Grown-ups only" }).or(page.getByLabel("Grown-ups only"));

/** Leaves the account with no PIN, whichever of `pins` is set. */
async function removePin(page: Page, pins: string[]) {
  for (const pin of pins) {
    await openSettings(page);
    await page.waitForTimeout(1500);
    if (await gate(page).first().isVisible().catch(() => false)) {
      await typePin(page, "Unlock PIN", pin);
      await page.waitForTimeout(1500);
      if (await gate(page).first().isVisible().catch(() => false)) continue; // wrong one
    }
    const confirm = page.getByRole("textbox", { name: "Remove PIN confirmation digit 1" });
    if (!(await confirm.isVisible().catch(() => false))) return; // no PIN set
    await typePin(page, "Remove PIN confirmation", pin);
    await page.getByRole("button", { name: "Remove PIN", exact: true }).click();
    await expect(page.getByText("Create a grown-up PIN")).toBeVisible();
    return;
  }
}

test("forgot PIN: a new PIN needs Clerk's re-check before the server accepts it", async ({ page }) => {
  test.setTimeout(240_000);
  // Start from no PIN (an interrupted earlier run may have left one).
  await removePin(page, ["1111", "2222"]);
  await openSettings(page);
  await expect(page.getByText("Create a grown-up PIN")).toBeVisible({ timeout: 15_000 });
  await typePin(page, "New PIN", "1111");
  await typePin(page, "Confirm PIN", "1111");
  let pin = "1111";
  try {
    await page.getByRole("button", { name: "Lock grown-up areas" }).click();
    await expect(gate(page).first()).toBeVisible();

    await page.getByRole("button", { name: "Forgot PIN?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your PIN" })).toBeVisible();
    const resetCall = page.waitForResponse((r) => r.url().includes("/api/parent-pin/reset"));
    await typePin(page, "New PIN", "2222");
    const first = await resetCall;

    if (first.status() === 200) {
      // This session signed in moments ago, which counts as verified.
      pin = "2222";
      await expect(gate(page).first()).toBeHidden({ timeout: 10_000 });
    } else {
      // Older session: the server refused until the grown-up re-verifies, and
      // Clerk's prompt is showing. The PIN is unchanged.
      expect(first.status()).toBe(403);
      expect((await first.json()).clerk_error?.reason).toBe("reverification-error");
      const prompt = page.getByRole("dialog").filter({ hasText: /verif/i });
      await expect(prompt.first()).toBeVisible({ timeout: 15_000 });
      await snap(page, "pin-reset-reverification-prompt");
      await page.keyboard.press("Escape");
      await expect(page.getByText("PIN not changed. Confirm it's you to set a new one.")).toBeVisible({
        timeout: 10_000,
      });
    }

    // The PIN that's now set opens the gate; the other one doesn't.
    await openSettings(page);
    const lock = page.getByRole("button", { name: "Lock grown-up areas" });
    if (await lock.isVisible().catch(() => false)) await lock.click();
    await expect(gate(page).first()).toBeVisible();
    await typePin(page, "Unlock PIN", pin === "1111" ? "2222" : "1111");
    await expect(gate(page).first()).toBeVisible();
    await page.reload();
    await expect(gate(page).first()).toBeVisible({ timeout: 30_000 });
    await typePin(page, "Unlock PIN", pin);
    await expect(gate(page).first()).toBeHidden({ timeout: 10_000 });
  } finally {
    await removePin(page, [pin, pin === "1111" ? "2222" : "1111"]);
  }
});

// Slow (11+ minutes), so opt-in: E2E_SLOW=1 npx playwright test e2e/parent-pin.spec.ts
test("forgot PIN on a session older than 10 minutes: Clerk asks first, PIN unchanged until then", async ({ page }) => {
  test.skip(!process.env.E2E_SLOW, "set E2E_SLOW=1 to run (waits 11 minutes)");
  test.setTimeout(20 * 60_000);
  await removePin(page, ["1111", "2222"]);
  await openSettings(page);
  await expect(page.getByText("Create a grown-up PIN")).toBeVisible({ timeout: 15_000 });
  await typePin(page, "New PIN", "1111");
  await typePin(page, "Confirm PIN", "1111");
  try {
    // Let the sign-in age past Clerk's "strict" 10-minute window.
    await page.waitForTimeout(11 * 60_000);
    await openSettings(page);
    await expect(gate(page).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Forgot PIN?" }).click();
    const resetCall = page.waitForResponse((r) => r.url().includes("/api/parent-pin/reset"));
    await typePin(page, "New PIN", "2222");
    const first = await resetCall;
    expect(first.status()).toBe(403);
    expect((await first.json()).clerk_error?.reason).toBe("reverification-error");
    const prompt = page.getByRole("dialog").filter({ hasText: /verif/i });
    await expect(prompt.first()).toBeVisible({ timeout: 15_000 });
    await snap(page, "pin-reset-reverification-prompt");
    await page.keyboard.press("Escape");
    await expect(page.getByText("PIN not changed. Confirm it's you to set a new one.")).toBeVisible({
      timeout: 10_000,
    });
    // Still the old PIN.
    await openSettings(page);
    await typePin(page, "Unlock PIN", "1111");
    await expect(gate(page).first()).toBeHidden({ timeout: 10_000 });
  } finally {
    await removePin(page, ["1111", "2222"]);
  }
});
