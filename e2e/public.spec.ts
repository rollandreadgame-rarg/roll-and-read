import { test, expect } from "@playwright/test";
import { axeViolations, horizontalOverflow, snap, trackErrors } from "./helpers";

// Signed-out visitor: no saved session.
test.use({ storageState: { cookies: [], origins: [] } });

const PUBLIC_PAGES: { path: string; title: RegExp; h1: RegExp }[] = [
  { path: "/", title: /^Roll and Read — Structured Phonics Game$/, h1: /Roll the dice\. Read the words\./ },
  { path: "/help", title: /^Help and FAQ — Roll & Read$/, h1: /Help/i },
  { path: "/privacy", title: /^Privacy Policy — Roll & Read$/, h1: /Privacy/i },
  { path: "/terms", title: /^Terms of Service — Roll & Read$/, h1: /Terms/i },
  { path: "/sign-in", title: /Roll (and|&) Read/, h1: /sign in/i },
  { path: "/sign-up", title: /Roll (and|&) Read/, h1: /(create|sign up)/i },
];

const WIDTHS = [360, 390, 1280];

test.describe("signed-out public pages", () => {
  for (const p of PUBLIC_PAGES) {
    test(`${p.path} loads, has title/h1, no errors, fits 360/390/1280, axe clean`, async ({ page }, testInfo) => {
      const errors = trackErrors(page);
      const res = await page.goto(p.path);
      expect(res?.status(), "HTTP status").toBe(200);
      expect(new URL(page.url()).pathname).toBe(p.path);
      await expect(page).toHaveTitle(p.title);
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1.first()).toBeVisible({ timeout: 20_000 });
      await expect(h1.first()).toHaveText(p.h1);
      await page.waitForLoadState("networkidle").catch(() => {});

      const overflow: string[] = [];
      const a11y: string[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        await page.waitForTimeout(400);
        const extra = await horizontalOverflow(page);
        if (extra > 1) {
          overflow.push(`${width}px: page is ${extra}px wider than the viewport`);
          await snap(page, `overflow${p.path.replace(/\//g, "_") || "_home"}-${width}`);
        }
        if (width !== 360) {
          for (const v of await axeViolations(page, testInfo, `axe-${width}`)) a11y.push(`${width}px ${v}`);
        }
      }
      expect(overflow, "no horizontal scroll").toEqual([]);
      expect(a11y, "axe WCAG 2.2 A/AA violations").toEqual([]);
      expect(errors, "console/page errors").toEqual([]);
    });
  }

  for (const path of ["/play", "/settings", "/billing", "/teacher", "/dashboard", "/practice"]) {
    test(`${path} redirects signed-out users to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in/, { timeout: 20_000 });
      await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(/sign in/i, { timeout: 20_000 });
    });
  }

  test("internal links on public pages are not broken", async ({ page, request }) => {
    const hrefs = new Map<string, string>(); // url -> found on
    const brokenAnchors: string[] = [];
    for (const p of ["/", "/help", "/privacy", "/terms"]) {
      await page.goto(p);
      await page.waitForLoadState("networkidle").catch(() => {});
      const links = await page.locator("a[href]").evaluateAll((as) =>
        as.map((a) => ({ href: (a as HTMLAnchorElement).href, raw: a.getAttribute("href") ?? "" }))
      );
      for (const { href, raw } of links) {
        const url = new URL(href);
        if (url.origin !== new URL(page.url()).origin) continue;
        // Same-page anchors must point at an element that exists.
        if (raw.startsWith("#") && raw.length > 1) {
          const exists = await page.evaluate((id) => !!document.getElementById(id), decodeURIComponent(raw.slice(1)));
          if (!exists) brokenAnchors.push(`${p}: ${raw}`);
          continue;
        }
        url.hash = "";
        if (!hrefs.has(url.toString())) hrefs.set(url.toString(), p);
      }
    }
    expect(hrefs.size, "found internal links").toBeGreaterThan(3);
    const broken: string[] = [];
    for (const [url, from] of hrefs) {
      // Request it the way a browser navigation does: Clerk answers a
      // signed-out non-document request for a protected page with 404, but a
      // document navigation with a redirect to sign-in.
      const res = await request.get(url, {
        maxRedirects: 5,
        headers: { accept: "text/html,application/xhtml+xml", "sec-fetch-dest": "document", "sec-fetch-mode": "navigate" },
      });
      if (res.status() >= 400) broken.push(`${url} (linked from ${from}) -> ${res.status()}`);
    }
    expect(broken, "broken internal links").toEqual([]);
    expect(brokenAnchors, "in-page anchors with no target").toEqual([]);
  });
});
