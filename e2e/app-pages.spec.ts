import { test, expect, type Page } from "@playwright/test";
import {
  axeViolations,
  expectNoErrorBoundary,
  horizontalOverflow,
  newAuthedPage,
  openBoard,
  snap,
  trackErrors,
} from "./helpers";

const APP_PAGES = [
  "/play",
  "/practice",
  "/word-bank",
  "/sticker-book",
  "/shop",
  "/dashboard",
  "/teacher",
  "/settings",
  "/billing",
  "/help",
];

/** Load a signed-in page and wait until it shows real content (an h1). */
async function loadAppPage(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.status(), `${path} HTTP status`).toBeLessThan(400);
  expect(new URL(page.url()).pathname, `${path} must not redirect`).toBe(path);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  // The teacher dashboard auto-starts its tour on a first visit: close it.
  if (await page.locator(".driver-popover").isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect(page.locator(".driver-popover")).toBeHidden();
  }
  // Let entrance animations finish before measuring.
  await page.waitForTimeout(1200);
}

test.describe("signed-in app pages", () => {
  for (const path of APP_PAGES) {
    test(`${path} renders without errors, fits, axe clean at 390 and 1280`, async ({ page }, testInfo) => {
      const errors = trackErrors(page);
      const a11y: string[] = [];
      const overflow: string[] = [];
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 860 });
        await loadAppPage(page, path);
        await expectNoErrorBoundary(page);
        await expect(page.getByText(/^Loading/)).toHaveCount(0);
        const extra = await horizontalOverflow(page);
        if (extra > 1) {
          overflow.push(`${width}px: ${extra}px horizontal overflow`);
          await snap(page, `overflow${path.replace(/\//g, "_")}-${width}`);
        }
        for (const v of await axeViolations(page, testInfo, `axe-${width}`)) a11y.push(`${width}px ${v}`);
      }
      expect(overflow, "no horizontal scroll").toEqual([]);
      expect(a11y, "axe WCAG 2.2 A/AA violations").toEqual([]);
      expect(errors, "console/page errors").toEqual([]);
    });
  }

  test("game board (after picking the reader) is axe clean at 390 and 1280", async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    const a11y: string[] = [];
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 860 });
      await openBoard(page);
      await page.waitForTimeout(1200);
      await expectNoErrorBoundary(page);
      expect(await horizontalOverflow(page), `${width}px horizontal overflow`).toBeLessThanOrEqual(1);
      for (const v of await axeViolations(page, testInfo, `axe-board-${width}`)) a11y.push(`${width}px ${v}`);
    }
    expect(a11y, "axe WCAG 2.2 A/AA violations").toEqual([]);
    expect(errors, "console/page errors").toEqual([]);
  });

  test("Settings shows the reader's saved theme on a new device", async ({ page, browser }) => {
    // Settings shows the reader's saved theme, not the browser's default.
    await openBoard(page);
    const originalId = (await page.locator("html").getAttribute("data-theme")) ?? "ocean";
    const classic = page.getByRole("button", { name: /^Classic classroom/ });
    try {
      await loadAppPage(page, "/settings");
      await classic.click();
      await expect(classic).toHaveAttribute("aria-pressed", "true");
      await page.waitForTimeout(1500);

      const fresh = await newAuthedPage(browser); // empty localStorage = new device
      try {
        await loadAppPage(fresh, "/settings");
        await expect(
          fresh.getByRole("button", { name: /^Classic classroom/ }),
          "reader's saved theme is the selected one"
        ).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });
      } finally {
        await snap(fresh, "settings-theme-new-device");
        await fresh.context().close();
      }
    } finally {
      if (originalId !== "classic") {
        await loadAppPage(page, "/settings");
        const restore = page.getByRole("button", { name: originalId === "ocean" ? /^Ocean adventure/ : new RegExp(originalId, "i") }).first();
        await restore.click();
        await expect(restore).toHaveAttribute("aria-pressed", "true");
        await page.waitForTimeout(1500);
      }
    }
  });

  test("Classic and Ocean themes: pages stay axe clean, theme is restored", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const errors = trackErrors(page);
    // The play page applies the reader's saved theme; remember it.
    await openBoard(page);
    const LABELS: Record<string, string> = {
      ocean: "Ocean adventure",
      space: "Space explorer",
      forest: "Enchanted forest",
      candy: "Candy land",
      classic: "Classic classroom",
    };
    const originalId = (await page.locator("html").getAttribute("data-theme")) ?? "ocean";
    const original = LABELS[originalId];
    expect(original, `known theme id ${originalId}`).toBeTruthy();

    const a11y: string[] = [];
    try {
      for (const [label, id] of [
        ["Classic classroom", "classic"],
        ["Ocean adventure", "ocean"],
      ] as const) {
        await loadAppPage(page, "/settings");
        const btn = page.getByRole("button", { name: new RegExp(`^${label}`) });
        await btn.click();
        await expect(btn).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("html")).toHaveAttribute("data-theme", id);
        // The choice is also saved on the reader (async mutation): give it a
        // moment before leaving, as a grown-up naturally would. /play goes
        // first because it re-applies the reader's saved theme.
        await page.waitForTimeout(1500);
        for (const path of ["/play", "/settings", "/word-bank", "/dashboard", "/sticker-book"]) {
          for (const width of [1280, 390]) {
            await page.setViewportSize({ width, height: 860 });
            if (path === "/play") {
              await openBoard(page);
              await page.waitForTimeout(1200);
            } else {
              await loadAppPage(page, path);
            }
            await expect(page.locator("html")).toHaveAttribute("data-theme", id);
            for (const v of await axeViolations(page, testInfo, `axe-${id}${path.replace(/\//g, "_")}-${width}`)) {
              a11y.push(`[${id}] ${path} ${width}px ${v}`);
            }
          }
        }
      }
    } finally {
      // Leave the reader on the theme it had.
      await page.setViewportSize({ width: 1280, height: 860 });
      await loadAppPage(page, "/settings");
      const restore = page.getByRole("button", { name: new RegExp(`^${original}`) });
      await restore.click();
      await expect(restore).toHaveAttribute("aria-pressed", "true");
      await page.waitForTimeout(1500);
    }
    expect(a11y, "axe WCAG 2.2 A/AA violations").toEqual([]);
    expect(errors, "console/page errors").toEqual([]);
  });
});
