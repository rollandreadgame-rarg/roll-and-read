import { test, expect } from "@playwright/test";
import {
  cardFor,
  cardWords,
  enabledCards,
  installAudioCapture,
  nextSpokenWord,
  openBoard,
  playedWords,
  rollAndListen,
  statusRegion,
  tabTo,
  trackErrors,
} from "./helpers";

test("3 misses show a hint and send the word to Practice; Got it by keyboard", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installAudioCapture(page);
  await openBoard(page);

  const target = await rollAndListen(page);
  const wrong = (await cardWords(enabledCards(page))).find((w) => w !== target)!;
  for (let miss = 1; miss <= 3; miss++) {
    await cardFor(page, wrong).click();
    if (miss < 3) {
      await expect(statusRegion(page)).toHaveText("Not that one. Listen again.");
    } else {
      await expect(statusRegion(page)).toHaveText(`Hint: the word is ${target}.`);
    }
    // Let the wrong-card shake and the slower re-speak finish.
    await page.waitForTimeout(1000);
  }
  await cardFor(page, target).click();
  await expect(statusRegion(page)).toHaveText(`Yes! ${target}.`);
  await page.waitForTimeout(2000); // word-bank save is async

  // Practice: find the word in the drill, mark it "Got it" with the keyboard,
  // skip anything else, and land on the results.
  await page.goto("/practice");
  const progress = page.getByRole("status").filter({ hasText: /^Word \d+ of \d+$/ });
  await expect(progress, "practice queue is not empty").toBeVisible({ timeout: 30_000 });
  const total = Number(/of (\d+)/.exec((await progress.innerText()) ?? "")?.[1]);
  expect(total).toBeGreaterThan(0);

  const seen: string[] = [];
  let played = 0;
  for (let i = 1; i <= total; i++) {
    await expect(progress).toHaveText(`Word ${i} of ${total}`);
    const word = await nextSpokenWord(page, played);
    played = (await playedWords(page)).length;
    await expect(page.getByText(word, { exact: true }).first(), "word card shows the spoken word").toBeVisible();
    seen.push(word);
    if (word === target) {
      await tabTo(page, (l) => /Got it/.test(l), 30);
    } else {
      await tabTo(page, (l) => /^Skip for now$/.test(l), 30);
    }
    await page.keyboard.press("Enter");
  }
  expect(seen, `"${target}" is in the practice queue`).toContain(target);
  const doneHeading = page.getByRole("heading", { level: 1, name: "Practice complete!" });
  await expect(doneHeading).toBeVisible();
  await expect(doneHeading).toBeFocused();
  expect(errors, "console/page errors").toEqual([]);
});
