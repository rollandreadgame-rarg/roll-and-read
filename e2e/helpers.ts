import fs from "node:fs";
import path from "node:path";
import { expect, type Browser, type Locator, type Page, type Response, type TestInfo } from "@playwright/test";
import { ARTIFACTS_DIR, AUTH_FILE, BASE_URL } from "./env";

export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

// ---------------------------------------------------------------- errors

/**
 * Clerk's own background POST to the current page (its cache-invalidation
 * server action) is answered 404 by the middleware when it races the 60-second
 * session-token refresh: Clerk cannot refresh a token on a non-GET request
 * (x-clerk-auth-reason "session-token-expired-refresh-non-eligible-non-get"),
 * so `auth.protect()` treats it as signed out. The page itself is unaffected.
 * Reported as a low-severity finding; only that exact case is excluded.
 */
function isClerkExpiredNonGet404(r: Response): boolean {
  return (
    r.status() === 404 &&
    r.request().method() !== "GET" &&
    /session-token-expired-refresh-non-eligible-non-get/.test(r.headers()["x-clerk-auth-reason"] ?? "")
  );
}

/** Collects console errors and uncaught page errors for the page's lifetime. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  const ignoredUrls = new Set<string>();
  const failedLoad = (url: string) => `console.error: Failed to load resource: the server responded with a status of 404 (Not Found) [${url}]`;
  page.on("response", (r) => {
    if (!isClerkExpiredNonGet404(r)) return;
    ignoredUrls.add(r.url());
    const i = errors.indexOf(failedLoad(r.url()));
    if (i >= 0) errors.splice(i, 1);
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    // "Failed to load resource" carries the URL only in its location.
    const isLoad = msg.text().startsWith("Failed to load resource");
    const url = msg.location().url;
    if (isLoad && ignoredUrls.has(url) && msg.text().includes("404")) return;
    errors.push(`console.error: ${msg.text().slice(0, 500)}${isLoad ? ` [${url}]` : ""}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message.slice(0, 500)}`));
  return errors;
}

export async function expectNoErrorBoundary(page: Page) {
  await expect(page.getByText("Something went wrong", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Application error|Unhandled Runtime Error/)).toHaveCount(0);
}

// ---------------------------------------------------------------- layout / a11y

export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * Waits (up to 6s) until no finite animation is running, so axe never
 * measures a card half-way through a fade-in. Endless decorative loops
 * (pulses, spinners) are ignored.
 */
export async function waitForAnimations(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.getAnimations().filter((a) => {
              const end = a.effect?.getComputedTiming().endTime;
              return a.playState === "running" && typeof end === "number" && Number.isFinite(end);
            }).length
        ),
      { timeout: 6_000, intervals: [100, 200, 300] }
    )
    .toBe(0)
    .catch(() => {});
  await page.waitForTimeout(150);
}

const AXE_URL = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";
let axeSource: Promise<string> | null = null;
function getAxeSource(): Promise<string> {
  axeSource ??= fetch(AXE_URL).then((r) => {
    if (!r.ok) throw new Error(`axe-core download failed: HTTP ${r.status}`);
    return r.text();
  });
  return axeSource;
}

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[]; failureSummary?: string }[];
}

/** Runs axe (WCAG 2.0-2.2 A/AA) and returns readable violation summaries. */
export async function axeViolations(page: Page, testInfo?: TestInfo, label = "axe"): Promise<string[]> {
  await waitForAnimations(page);
  if (!(await page.evaluate(() => "axe" in window))) {
    await page.addScriptTag({ content: await getAxeSource() });
  }
  const violations: AxeViolation[] = await page.evaluate(async (tags) => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<{ violations: AxeViolation[] }> } }).axe;
    const res = await axe.run(document, { runOnly: { type: "tag", values: tags } });
    return res.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({ target: n.target.map(String), failureSummary: n.failureSummary })),
    }));
  }, WCAG_TAGS);
  if (testInfo && violations.length) {
    await testInfo.attach(`${label}.json`, {
      body: JSON.stringify(violations, null, 2),
      contentType: "application/json",
    });
  }
  return violations.map(
    (v) =>
      `${v.id} [${v.impact}] ${v.help} — ${v.nodes
        .slice(0, 4)
        .map((n) => `${n.target.join(" ")}${n.failureSummary ? ` (${n.failureSummary.replace(/\s+/g, " ").slice(0, 160)})` : ""}`)
        .join("; ")}`
  );
}

/** Saves a full-page screenshot under e2e/artifacts/ and returns its path. */
export async function snap(page: Page, name: string): Promise<string> {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const file = path.join(ARTIFACTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  return file;
}

// ---------------------------------------------------------------- audio capture

/**
 * The spoken target word is not in the DOM. Record every media src the page
 * plays (the shared <audio> element's `src` is set right before play()).
 */
export async function installAudioCapture(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __played: string[] };
    w.__played = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      try {
        w.__played.push(this.src);
      } catch {
        /* ignore */
      }
      return orig.call(this);
    };
  });
}

/** Words played so far, decoded from /audio/words/<word>.mp3 sources. */
export async function playedWords(page: Page): Promise<string[]> {
  const srcs = await page.evaluate(() => (window as unknown as { __played?: string[] }).__played ?? []);
  return srcs
    .map((s) => /\/audio\/words\/([^/?#]+)\.mp3/.exec(s)?.[1])
    .filter((x): x is string => !!x)
    .map((x) => decodeURIComponent(x));
}

/** Waits until more than `after` words have been played; returns the latest. */
export async function nextSpokenWord(page: Page, after: number, timeout = 15_000): Promise<string> {
  let words: string[] = [];
  await expect
    .poll(async () => (words = await playedWords(page)).length, { timeout, message: "a word to be spoken" })
    .toBeGreaterThan(after);
  return words[words.length - 1];
}

// ---------------------------------------------------------------- game board

export const rollButton = (page: Page) => page.locator("[data-roll-button]");
export const statusRegion = (page: Page) => page.locator("p.sr-only[role=status]");
export const allCards = (page: Page) => page.locator('button[aria-label^="Word card: "]');
export const enabledCards = (page: Page) => page.locator('button[aria-label^="Word card: "]:not([disabled])');
/** The enabled card for `word` (real or silly). */
export const cardFor = (page: Page, word: string) => {
  const w = word.replace(/["\\]/g, "\\$&");
  return page.locator(
    `button[aria-label="Word card: ${w}"]:not([disabled]), button[aria-label="Word card: ${w} — silly word, sound it out"]:not([disabled])`
  );
};

export function wordFromLabel(label: string | null): string {
  const m = /^Word card: (.+?)(?: — silly word, sound it out)?$/.exec(label ?? "");
  if (!m) throw new Error(`Unexpected word card label: ${label}`);
  return m[1];
}

export async function cardWords(cards: Locator): Promise<string[]> {
  const labels = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  return labels.map(wordFromLabel);
}

export async function coins(page: Page): Promise<number> {
  const label = await page.locator('[role="img"][aria-label$=" coins"]').first().getAttribute("aria-label");
  const n = Number(/^(-?\d+) coins$/.exec(label ?? "")?.[1]);
  if (Number.isNaN(n)) throw new Error(`Unexpected coin label: ${label}`);
  return n;
}

/** Dismiss the first-play tutorial / silly-word coachmark / leftover reward picks if they show. */
export async function dismissOverlays(page: Page) {
  for (let i = 0; i < 6; i++) {
    const tutorial = page.getByRole("button", { name: "Skip tutorial" });
    const coach = page.getByRole("button", { name: "Got it!" });
    const pick = page.getByRole("dialog").filter({ hasText: "Pick a pack!" });
    const levelUp = page.getByRole("button", { name: /Let.s go!/ });
    const upgrade = page.getByRole("dialog").filter({ hasText: /Upgrade|unlock/i });
    if (await tutorial.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await expect(tutorial).toBeHidden();
    } else if (await coach.isVisible().catch(() => false)) {
      await coach.click();
      await expect(coach).toBeHidden();
    } else if (await pick.isVisible().catch(() => false)) {
      await claimAllStickerPicks(page);
    } else if (await levelUp.isVisible().catch(() => false)) {
      await levelUp.click();
    } else if (await upgrade.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    } else {
      // Overlays can appear a moment after the board renders.
      await page.waitForTimeout(700);
      if (
        !(await tutorial.isVisible().catch(() => false)) &&
        !(await coach.isVisible().catch(() => false)) &&
        !(await pick.isVisible().catch(() => false))
      ) {
        return;
      }
    }
  }
}

/** Opens /play, picks the "Dev" reader and waits for a ready board. */
export async function openBoard(page: Page) {
  await page.goto("/play");
  const reader = page.getByRole("button", { name: /^Dev\b/ });
  await expect(reader).toBeVisible({ timeout: 30_000 });
  await reader.click();
  await expect(rollButton(page)).toBeVisible({ timeout: 30_000 });
  await expect(allCards(page).first()).toBeVisible();
  await dismissOverlays(page);
}

/** Claims every pending sticker pick (pick a pack -> Next/Done). */
export async function claimAllStickerPicks(page: Page) {
  for (let i = 0; i < 10; i++) {
    const pickDialog = page.getByRole("dialog").filter({ hasText: "Pick a pack!" });
    if (!(await pickDialog.isVisible().catch(() => false))) return;
    await pickDialog.getByRole("button", { name: /^Pick / }).first().click();
    const reveal = page.getByRole("dialog", { name: "Your new sticker" });
    await expect(reveal).toBeVisible({ timeout: 20_000 });
    const next = reveal.getByRole("button", { name: /^(Next|Done!)/ });
    await expect(next).toBeVisible();
    await next.click();
    await expect(reveal).toBeHidden();
    await page.waitForTimeout(400);
  }
}

/**
 * Rolls (if no row is active) and waits for the row to activate.
 * Returns the word spoken for the new row.
 */
export async function rollAndListen(page: Page): Promise<string> {
  const before = (await playedWords(page)).length;
  const roll = rollButton(page);
  await expect(roll).toHaveAttribute("aria-label", "Roll the dice");
  await expect(roll).toHaveAttribute("aria-disabled", "false");
  await roll.click();
  await expect(roll).toHaveAttribute("aria-label", "Hear the word again", { timeout: 15_000 });
  return nextSpokenWord(page, before);
}

/**
 * Answers the active row correctly until it is cleared. `firstTarget` is the
 * word already spoken for the row. Returns the words read.
 */
export async function clearActiveRow(
  page: Page,
  firstTarget: string
): Promise<{ read: string[]; playedBeforeLastClick: number }> {
  const read: string[] = [];
  let target = firstTarget;
  let before = 0;
  for (let i = 0; i < 5; i++) {
    const card = cardFor(page, target);
    await expect(card, `card for spoken word "${target}"`).toHaveCount(1);
    before = (await playedWords(page)).length;
    const remaining = await enabledCards(page).count();
    await card.click();
    read.push(target);
    await expect(card).toHaveCount(0);
    if (remaining === 1) break;
    target = await nextSpokenWord(page, before);
  }
  return { read, playedBeforeLastClick: before };
}

/** aria-label (or text) of the focused element. */
export async function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "<body>";
    return el.getAttribute("aria-label") ?? el.innerText?.trim() ?? el.tagName;
  });
}

/** Presses Tab until `match` is focused (keyboard-only navigation). */
export async function tabTo(page: Page, match: (label: string) => boolean, max = 60, key = "Tab") {
  for (let i = 0; i < max; i++) {
    if (match(await focused(page))) return;
    await page.keyboard.press(key);
  }
  throw new Error(`Could not reach the wanted control with ${key} (focused: ${await focused(page)})`);
}

/** Moves keyboard focus to the enabled card for `word` with Tab / Shift+Tab. */
export async function tabToCard(page: Page, word: string) {
  const isCard = (l: string) => l.startsWith("Word card: ");
  if (!isCard(await focused(page))) await tabTo(page, isCard, 15);
  const order = await cardWords(enabledCards(page));
  const want = order.indexOf(word);
  if (want < 0) throw new Error(`"${word}" is not an enabled card (${order.join(", ")})`);
  const at = order.indexOf(wordFromLabel(await focused(page)));
  const key = want > at ? "Tab" : "Shift+Tab";
  for (let i = 0; i < Math.abs(want - at); i++) await page.keyboard.press(key);
  expect(wordFromLabel(await focused(page)), "focused card").toBe(word);
}

/** Rows already cleared on this board (from the dice face tracker). */
export async function clearedRowCount(page: Page): Promise<number> {
  return page.locator('[role="img"][aria-label^="Row "][aria-label$=": done"]').count();
}

/**
 * Plays every remaining row of the current board perfectly (first try).
 * Returns the number of words read.
 */
export async function playRestOfBoard(page: Page): Promise<number> {
  let words = 0;
  let pending: string | null = null;
  for (let guard = 0; guard < 8; guard++) {
    const cleared = await clearedRowCount(page);
    if (cleared >= 6) break;
    const label = await rollButton(page).getAttribute("aria-label");
    let target: string;
    if (pending) target = pending;
    else if (label === "Hear the word again") target = (await playedWords(page)).at(-1)!;
    else target = await rollAndListen(page);
    pending = null;
    const { read, playedBeforeLastClick } = await clearActiveRow(page, target);
    words += read.length;
    if (cleared + 1 === 5) {
      // The last row turns on by itself — no roll needed.
      await expect(rollButton(page)).toHaveAttribute("aria-label", "Hear the word again", { timeout: 15_000 });
      pending = await nextSpokenWord(page, playedBeforeLastClick);
    } else if (cleared + 1 < 5) {
      await waitForRollReady(page);
    } else {
      break;
    }
  }
  return words;
}

// ---------------------------------------------------------------- settings: reading level

export const levelSelect = (page: Page) => page.locator("#reader-level");
export const levelStatus = (page: Page) =>
  page.locator('section[aria-labelledby="reading-level-title"] p[role="status"]');

export async function getReaderLevel(page: Page): Promise<string> {
  await page.goto("/settings");
  await expect(levelSelect(page)).toBeVisible({ timeout: 30_000 });
  return levelSelect(page).inputValue();
}

/** Moves the reader to `level` via Settings. Returns false if already there. */
export async function setReaderLevel(page: Page, level: string): Promise<boolean> {
  const current = await getReaderLevel(page);
  if (current === level) return false;
  await levelSelect(page).selectOption(level);
  await page.getByRole("button", { name: "Save level" }).click();
  await expect(levelStatus(page)).toContainText(`now plays ${level}`);
  return true;
}

/** Waits until the board is idle again (Roll available) after a row clears. */
export async function waitForRollReady(page: Page) {
  const roll = rollButton(page);
  await expect(roll).toHaveAttribute("aria-label", "Roll the dice", { timeout: 15_000 });
  await expect(roll).toHaveAttribute("aria-disabled", "false");
}

/** A signed-in page for beforeAll/afterAll hooks (outside a test's own page). */
export async function newAuthedPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: AUTH_FILE, baseURL: BASE_URL });
  return context.newPage();
}
