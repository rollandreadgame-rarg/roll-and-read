import { test, expect, type Page } from "@playwright/test";
import { focused, trackErrors } from "./helpers";

const popover = (page: Page) => page.locator(".driver-popover");
const progress = (page: Page) => popover(page).locator(".driver-popover-progress-text");
const tourLive = (page: Page) => page.locator("p.sr-only[aria-live=polite]");

/** Opens /teacher (closing a first-visit auto tour) and starts the tour from the button by keyboard. */
async function startTourByKeyboard(page: Page) {
  await page.goto("/teacher");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Teacher dashboard/, { timeout: 30_000 });
  // First visit auto-starts the tour; close it so we start from the button.
  await page.waitForTimeout(1500);
  if (await popover(page).isVisible()) {
    await page.keyboard.press("Escape");
    await expect(popover(page)).toBeHidden();
  }
  const how = page.getByRole("button", { name: "How this works" });
  await how.focus();
  await page.keyboard.press("Enter");
  await expect(popover(page)).toBeVisible({ timeout: 10_000 });
  await expect(progress(page)).toHaveText("Step 1 of 8");
}

test.describe("teacher dashboard tour", () => {
  test("'How this works': 8 steps, Next moves focus, Escape closes and returns focus", async ({ page }) => {
    const errors = trackErrors(page);
    await startTourByKeyboard(page);
    const next = popover(page).locator(".driver-popover-next-btn");
    await expect(next, "focus starts on Next").toBeFocused();
    const title1 = await popover(page).locator(".driver-popover-title").innerText();

    await next.click();
    await expect(progress(page)).toHaveText("Step 2 of 8");
    await expect(popover(page).locator(".driver-popover-title")).not.toHaveText(title1);
    await expect(popover(page).locator(".driver-popover-next-btn"), "focus moves to the new step's Next").toBeFocused();

    await page.keyboard.press("Enter");
    await expect(progress(page)).toHaveText("Step 3 of 8");
    await expect(popover(page).locator(".driver-popover-next-btn")).toBeFocused();
    // Screen readers hear each step.
    await expect(tourLive(page)).toHaveText(/^Step 3 of 8: /);

    // Give the step's spotlight animation a moment, as a person reading it would.
    await page.waitForTimeout(800);
    await page.keyboard.press("Escape");
    await expect(popover(page)).toBeHidden();
    await expect(tourLive(page)).toHaveText("Tour closed.");
    await expect.poll(() => focused(page), { message: "focus returns to the button" }).toBe("How this works");
    expect(errors, "console/page errors").toEqual([]);
  });

  test("Escape mid-animation still announces the close and returns focus", async ({ page }) => {
    // driver.js skips onDestroyed when closed mid-transition; this used to
    // leave focus on <body> about 1 time in 6. Repeat to catch the race.
    const errors = trackErrors(page);
    await startTourByKeyboard(page);
    const how = page.getByRole("button", { name: "How this works" });
    for (let i = 0; i < 6; i++) {
      if (i > 0) {
        await how.focus();
        await page.keyboard.press("Enter");
        await expect(popover(page)).toBeVisible({ timeout: 10_000 });
      }
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Escape");
      await expect(popover(page)).toBeHidden();
      await expect(tourLive(page), `round ${i + 1}`).toHaveText("Tour closed.");
      await expect.poll(() => focused(page), { message: `round ${i + 1}: focus returns` }).toBe("How this works");
      await expect(page.locator(".driver-overlay"), "no overlay left behind").toHaveCount(0);
    }
    expect(errors, "console/page errors").toEqual([]);
  });
});
