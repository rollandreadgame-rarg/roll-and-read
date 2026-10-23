import { test, expect } from "@playwright/test";
import {
  getReaderLevel,
  levelSelect,
  levelStatus,
  newAuthedPage,
  openBoard,
  setReaderLevel,
  trackErrors,
} from "./helpers";

let startLevel: string | null = null;

test.describe("settings: reading level", () => {
  // Leave the reader on the level they started on, even if the test fails.
  test.afterAll(async ({ browser }) => {
    if (!startLevel) return;
    const page = await newAuthedPage(browser);
    await setReaderLevel(page, startLevel);
    await page.context().close();
  });

  test("change the reading level, see the status, and change it back", async ({ page }) => {
    const errors = trackErrors(page);
    startLevel = await getReaderLevel(page);
    const save = page.getByRole("button", { name: "Save level" });
    await expect(save, "nothing to save yet").toBeDisabled();

    const allowed = await levelSelect(page)
      .locator("option:not([disabled])")
      .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    const other = allowed.find((l) => l !== startLevel);
    expect(other, "another allowed level exists").toBeTruthy();
    // Paid-only levels are listed but locked for a free account.
    expect(await levelSelect(page).locator("option[disabled]").count()).toBeGreaterThan(0);

    await levelSelect(page).selectOption(other!);
    await expect(save).toBeEnabled();
    await save.click();
    await expect(levelStatus(page)).toHaveText(new RegExp(`^Dev now plays ${other}: .+\\.$`));
    await expect(page.locator('section[aria-labelledby="reading-level-title"]')).toContainText(`Dev is on ${other}`);
    await expect(save).toBeDisabled();

    // Persisted: a fresh load shows it, and the game uses it.
    expect(await getReaderLevel(page)).toBe(other);
    await openBoard(page);
    await expect(page.getByText(`Level ${other}`, { exact: true }).first()).toBeVisible();

    // Change it back.
    await page.goto("/settings");
    await levelSelect(page).selectOption(startLevel);
    await save.click();
    await expect(levelStatus(page)).toHaveText(new RegExp(`^Dev now plays ${startLevel}: .+\\.$`));
    expect(await getReaderLevel(page)).toBe(startLevel);
    expect(errors, "console/page errors").toEqual([]);
  });
});
