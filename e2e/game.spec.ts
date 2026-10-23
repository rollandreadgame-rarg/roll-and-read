import { test, expect } from "@playwright/test";
import {
  allCards,
  cardFor,
  cardWords,
  claimAllStickerPicks,
  clearActiveRow,
  clearedRowCount,
  coins,
  enabledCards,
  focused,
  getReaderLevel,
  installAudioCapture,
  newAuthedPage,
  nextSpokenWord,
  openBoard,
  playRestOfBoard,
  playedWords,
  rollAndListen,
  rollButton,
  setReaderLevel,
  statusRegion,
  tabTo,
  tabToCard,
  trackErrors,
  waitForRollReady,
  wordFromLabel,
} from "./helpers";

let startLevel: string | null = null;

test.describe("game loop", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await newAuthedPage(browser);
    startLevel = await getReaderLevel(page);
    await page.context().close();
  });

  // A perfect board can level the reader up; put them back where they were.
  test.afterAll(async ({ browser }) => {
    if (!startLevel) return;
    const page = await newAuthedPage(browser);
    await setReaderLevel(page, startLevel);
    await page.context().close();
  });

  test.beforeEach(async ({ page }) => {
    await installAudioCapture(page);
  });

  test("mouse: wrong tap, right tap, coins, row clear, next roll", async ({ page }) => {
    const errors = trackErrors(page);
    await openBoard(page);
    const coins0 = await coins(page);
    const rowsBefore = await page.getByRole("group", { name: /^Row \d/ }).count();

    const target = await rollAndListen(page);
    await expect(statusRegion(page)).toHaveText(/^Row \d\. Listen, then tap the word\.$/);
    const active = await cardWords(enabledCards(page));
    expect(active.length, "active row has 5 cards").toBe(5);
    expect(active, "spoken word is on the active row").toContain(target);
    // Cards outside the active row are not tappable.
    expect(await allCards(page).count()).toBeGreaterThan(active.length);

    // Wrong tap
    const wrong = active.find((w) => w !== target)!;
    await cardFor(page, wrong).click();
    await expect(statusRegion(page)).toHaveText("Not that one. Listen again.");
    await expect(cardFor(page, wrong), "wrong card stays").toHaveCount(1);
    expect(await coins(page), "no coins for a wrong tap").toBe(coins0);

    // Right tap
    const before = (await playedWords(page)).length;
    await cardFor(page, target).click();
    await expect(statusRegion(page)).toHaveText(`Yes! ${target}.`);
    await expect(cardFor(page, target), "correct card is cleared").toHaveCount(0);
    await expect.poll(() => coins(page), { message: "coins go up" }).toBeGreaterThan(coins0);
    const coins1 = await coins(page);

    // Finish the row
    const next = await nextSpokenWord(page, before);
    await clearActiveRow(page, next);
    await waitForRollReady(page);
    await expect(page.getByRole("group", { name: /^Row \d/ })).toHaveCount(rowsBefore - 1);
    expect(await clearedRowCount(page)).toBe(1);
    expect(await coins(page)).toBeGreaterThan(coins1);

    // The next roll works
    const target2 = await rollAndListen(page);
    expect(await cardWords(enabledCards(page))).toContain(target2);
    expect(errors, "console/page errors").toEqual([]);
  });

  test("keyboard only: focus follows the game", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/play");
    const reader = page.getByRole("button", { name: /^Dev\b/ });
    await expect(reader).toBeVisible({ timeout: 30_000 });
    await tabTo(page, (l) => /(^|\s)Dev(\s|$)/.test(l) && /Level/.test(l), 40);
    await page.keyboard.press("Enter");
    await expect(rollButton(page)).toBeVisible({ timeout: 30_000 });
    // Dismiss first-play overlays with the keyboard only.
    for (let i = 0; i < 3; i++) {
      const overlay = page.getByRole("button", { name: /^(Skip tutorial|Got it!)$/ });
      if (!(await overlay.first().isVisible().catch(() => false))) {
        await page.waitForTimeout(800);
        if (!(await overlay.first().isVisible().catch(() => false))) break;
      }
      await page.keyboard.press("Escape");
    }

    // Focus lands on Roll after picking the reader.
    await expect.poll(() => focused(page), { message: "focus on Roll after picking reader" }).toBe("Roll the dice");

    const before = (await playedWords(page)).length;
    await page.keyboard.press("Enter");
    // Focus stays on the same button while rolling and once the row is live.
    await expect(rollButton(page)).toContainText("Rolling");
    expect(await focused(page), "focus during roll").toBe("Roll the dice");
    await expect(rollButton(page)).toHaveAttribute("aria-label", "Hear the word again", { timeout: 15_000 });
    expect(await focused(page), "focus after roll").toBe("Hear the word again");
    await expect(statusRegion(page)).toHaveText(/^Row \d\. Listen, then tap the word\.$/);
    let target = await nextSpokenWord(page, before);

    // Wrong answer with Space
    const words = await cardWords(enabledCards(page));
    const wrong = words.find((w) => w !== target)!;
    await tabToCard(page, wrong);
    await page.keyboard.press("Space");
    await expect(statusRegion(page)).toHaveText("Not that one. Listen again.");
    expect(wordFromLabel(await focused(page)), "focus stays on the wrong card").toBe(wrong);

    for (let i = 0; i < 5; i++) {
      await tabToCard(page, target);
      const n = (await playedWords(page)).length;
      const remaining = await enabledCards(page).count();
      await page.keyboard.press(i % 2 ? "Space" : "Enter");
      await expect(statusRegion(page)).toHaveText(`Yes! ${target}.`);
      await expect(cardFor(page, target)).toHaveCount(0);
      if (remaining === 1) break;
      // Focus moves to the next card in the row, not to the page top.
      await expect
        .poll(() => focused(page), { message: "focus on the next enabled card" })
        .toMatch(/^Word card: /);
      expect(await page.evaluate(() => (document.activeElement as HTMLButtonElement).disabled)).toBe(false);
      target = await nextSpokenWord(page, n);
    }

    // Row done: focus returns to Roll.
    await waitForRollReady(page);
    await expect.poll(() => focused(page), { message: "focus back on Roll after row" }).toBe("Roll the dice");
    expect(errors, "console/page errors").toEqual([]);
  });

  test("full board: board-complete dialog and claiming a sticker", async ({ page }) => {
    test.setTimeout(420_000);
    const errors = trackErrors(page);
    await openBoard(page);
    const coins0 = await coins(page);
    const words = await playRestOfBoard(page);
    expect(words).toBeGreaterThan(0);

    const done = page.getByRole("dialog").filter({ hasText: "You did it!" });
    await expect(done, "board-complete dialog").toBeVisible({ timeout: 20_000 });
    // A perfect board always earns a sticker pick.
    const pickBtn = done.getByRole("button", { name: /Pick my stickers!/ });
    await expect(pickBtn).toBeVisible();
    await expect(pickBtn).toBeFocused();
    expect(await coins(page)).toBeGreaterThan(coins0);

    await pickBtn.click();
    const pick = page.getByRole("dialog").filter({ hasText: "Pick a pack!" });
    await expect(pick).toBeVisible({ timeout: 20_000 });
    await expect(pick.getByRole("button", { name: /^Pick / })).toHaveCount(3);
    await pick.getByRole("button", { name: /^Pick / }).first().click();
    const reveal = page.getByRole("dialog", { name: "Your new sticker" });
    await expect(reveal).toBeVisible({ timeout: 20_000 });
    await expect(reveal).not.toContainText("Oops");
    await expect(reveal.getByRole("button", { name: /^(Next|Done!)/ })).toBeFocused();
    await reveal.getByRole("button", { name: /^(Next|Done!)/ }).click();
    await claimAllStickerPicks(page); // any further picks (e.g. a level-up sticker)

    // A level-up celebration may follow; then a fresh board.
    const letsGo = page.getByRole("button", { name: /Let.s go!/ });
    if (await letsGo.isVisible({ timeout: 3_000 }).catch(() => false)) await letsGo.click();
    await expect(page.getByRole("group", { name: /^Row \d/ })).toHaveCount(6, { timeout: 20_000 });
    await waitForRollReady(page);
    expect(await clearedRowCount(page)).toBe(0);
    expect(errors, "console/page errors").toEqual([]);
  });

  test("every word on a board has its audio file", async ({ page, request }) => {
    await openBoard(page);
    const words = await cardWords(allCards(page));
    expect(words.length).toBe(30);
    expect(new Set(words).size, "30 unique words").toBe(30);
    const missing: string[] = [];
    for (const w of words) {
      const res = await request.get(`/audio/words/${encodeURIComponent(w)}.mp3`);
      const body = await res.body();
      if (res.status() !== 200 || !/audio\/mpeg/.test(res.headers()["content-type"] ?? "") || body.length < 1000) {
        missing.push(`${w}: HTTP ${res.status()} ${res.headers()["content-type"]} ${body.length}B`);
      }
    }
    expect(missing, "word audio files").toEqual([]);
  });

  test.describe("phone (390px, touch)", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test("roll and clear a row by tapping", async ({ page }) => {
      const errors = trackErrors(page);
      await openBoard(page);
      const coins0 = await coins(page);
      const before = (await playedWords(page)).length;
      await rollButton(page).tap();
      await expect(rollButton(page)).toHaveAttribute("aria-label", "Hear the word again", { timeout: 15_000 });
      let target = await nextSpokenWord(page, before);
      for (let i = 0; i < 5; i++) {
        const card = cardFor(page, target);
        await card.scrollIntoViewIfNeeded();
        const n = (await playedWords(page)).length;
        const remaining = await enabledCards(page).count();
        await card.tap();
        await expect(statusRegion(page)).toHaveText(`Yes! ${target}.`);
        await expect(card).toHaveCount(0);
        if (remaining === 1) break;
        target = await nextSpokenWord(page, n);
      }
      await waitForRollReady(page);
      expect(await clearedRowCount(page)).toBe(1);
      expect(await coins(page)).toBeGreaterThan(coins0);
      expect(errors, "console/page errors").toEqual([]);
    });
  });
});
