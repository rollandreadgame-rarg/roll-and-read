import { test, expect, type Page } from "@playwright/test";
import {
  allCards,
  nextSpokenWord,
  playedWords,
  cardFor,
  cardWords,
  claimAllStickerPicks,
  coins,
  getReaderLevel,
  installAudioCapture,
  newAuthedPage,
  openBoard,
  playRestOfBoard,
  rollAndListen,
  rollButton,
  setReaderLevel,
  snap,
  statusRegion,
  trackErrors,
} from "./helpers";

const wordBankCount = async (page: Page) => {
  const label = await page.getByRole("button", { name: /^Word bank: \d+ words/ }).getAttribute("aria-label");
  return Number(/Word bank: (\d+) words/.exec(label ?? "")?.[1]);
};

/** Reload /play and pick the reader again, without dismissing any dialogs. */
async function reloadAndPickReader(page: Page) {
  await page.reload();
  const reader = page.getByRole("button", { name: /^Dev\b/ });
  await expect(reader).toBeVisible({ timeout: 30_000 });
  await reader.click();
  await expect(rollButton(page)).toBeVisible({ timeout: 30_000 });
  await expect(allCards(page).first()).toBeVisible();
}

/** Answers the first word of a freshly rolled row; returns it. */
async function answerOneWord(page: Page) {
  const target = await rollAndListen(page);
  await cardFor(page, target).click();
  await expect(statusRegion(page)).toHaveText(`Yes! ${target}.`);
  return target;
}

let startLevel: string | null = null;

test.describe("reload resilience", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await newAuthedPage(browser);
    startLevel = await getReaderLevel(page);
    await page.context().close();
  });
  test.afterAll(async ({ browser }) => {
    if (!startLevel) return;
    const page = await newAuthedPage(browser);
    await setReaderLevel(page, startLevel);
    await page.context().close();
  });
  test.beforeEach(async ({ page }) => {
    await installAudioCapture(page);
  });

  test("reload mid-row keeps coins and word bank exactly (no lost or duplicate rewards)", async ({ page }) => {
    const errors = trackErrors(page);
    await openBoard(page);
    const coins0 = await coins(page);
    await answerOneWord(page);
    await expect.poll(() => coins(page)).toBeGreaterThan(coins0);
    const coins1 = await coins(page);
    // Wait until the server has the new word before reloading.
    await page.waitForTimeout(2500);
    const bank1 = await wordBankCount(page);

    await reloadAndPickReader(page);
    await expect.poll(() => coins(page), { message: "coins after reload" }).toBe(coins1);
    expect(await wordBankCount(page), "word bank after reload").toBe(bank1);
    // The row is still live and its word can be heard again.
    const roll = rollButton(page);
    await expect(roll).toHaveAttribute("aria-label", "Hear the word again");
    const before = (await playedWords(page)).length;
    await roll.click();
    const target = await nextSpokenWord(page, before);
    expect(await cardWords(page.locator('button[aria-label^="Word card: "]:not([disabled])'))).toContain(target);
    expect(errors, "console/page errors").toEqual([]);
  });

  test("reload mid-row restores the same board and active row", async ({ page }) => {
    // The board in progress is saved per reader on the device
    // (lib/game/savedBoard.ts), so a reload keeps the reader's place.
    await openBoard(page);
    const boardBefore = new Set(await cardWords(allCards(page)));
    const answered = await answerOneWord(page);
    await page.waitForTimeout(1500);
    await reloadAndPickReader(page);
    await snap(page, "reload-mid-row-same-board");
    const boardAfter = await cardWords(allCards(page));
    expect(boardAfter, "answered card stays cleared").not.toContain(answered);
    expect(
      boardAfter.filter((w) => boardBefore.has(w)).length,
      "same board after reload"
    ).toBe(boardAfter.length);
    await expect(rollButton(page), "row still active").toHaveAttribute("aria-label", "Hear the word again");
  });

  test("reload while a sticker pick is pending brings the pick screen back, once", async ({ page }) => {
    test.setTimeout(420_000);
    const errors = trackErrors(page);
    await openBoard(page);
    await playRestOfBoard(page);
    const done = page.getByRole("dialog").filter({ hasText: "You did it!" });
    await expect(done).toBeVisible({ timeout: 20_000 });
    await done.getByRole("button", { name: /Pick my stickers!/ }).click();
    const pick = page.getByRole("dialog").filter({ hasText: "Pick a pack!" });
    await expect(pick).toBeVisible({ timeout: 20_000 });

    // Reload before picking.
    await reloadAndPickReader(page);
    await expect(pick, "pick screen returns after reload").toBeVisible({ timeout: 20_000 });
    await expect(pick.getByRole("button", { name: /^Pick / })).toHaveCount(3);
    await claimAllStickerPicks(page);
    await expect(pick).toBeHidden();

    // Claimed picks are not offered again.
    await reloadAndPickReader(page);
    await page.waitForTimeout(2500);
    await expect(pick, "no duplicate pick after claiming").toBeHidden();
    expect(errors, "console/page errors").toEqual([]);
  });
});
