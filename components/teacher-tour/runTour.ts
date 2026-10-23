// The driver.js spotlight tour for /teacher. Loaded on demand (dynamic
// import from useTeacherTour), so driver.js and its CSS only ship to the
// browser when a grown-up actually opens the tour.

import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./driver-theme.css";
import {
  GOOD_LABEL,
  METRICS,
  TOUR_ADD_READER,
  TOUR_CLOSING,
  TOUR_OVERVIEW,
  TOUR_WELCOME,
  WATCH_LABEL,
  type MetricExplainer,
} from "@/lib/teacher-tour/metrics";

export type TourVariant = "full" | "empty";

export interface RunTourOptions {
  variant: TourVariant;
  hasPin: boolean;
  reducedMotion: boolean;
  /** Writes to the page's aria-live region. */
  announce: (message: string) => void;
  /** Where focus goes when the tour closes. */
  returnFocusTo: HTMLElement | null;
}

const sel = (anchorId: string) => `[data-tour="${anchorId}"]`;
const exists = (anchorId: string) => document.querySelector(sel(anchorId)) !== null;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

// driver.js renders descriptions with innerHTML. The copy is our own static
// text, but escape it anyway so a stray "<" can never become markup.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const para = (s: string) => `<p>${esc(s)}</p>`;

function metricBody(m: MetricExplainer): string {
  return (
    para(m.what) +
    `<p><span class="rr-tour-good">${esc(GOOD_LABEL)}</span> ${esc(m.goodSignal)}</p>` +
    `<p><span class="rr-tour-watch">${esc(WATCH_LABEL)}</span> ${esc(m.watchSignal)}</p>`
  );
}

// Per-reader metrics live inside the first ProfileCard, which is collapsed by
// default. Open it, wait for its anchors to mount, then let the 0.25s height
// animation settle so driver.js measures the final positions.
async function expandFirstReaderCard(): Promise<void> {
  const toggle = document.querySelector<HTMLButtonElement>(sel("reader-card-toggle"));
  if (!toggle) return;
  if (toggle.getAttribute("aria-expanded") !== "true") toggle.click();
  const started = performance.now();
  while (!exists("metric-accuracy") && performance.now() - started < 2000) {
    await nextFrame();
  }
  await wait(350);
}

function buildSteps(variant: TourVariant, hasPin: boolean): DriveStep[] {
  const steps: DriveStep[] = [
    {
      popover: {
        title: esc(TOUR_WELCOME.title),
        description: para(hasPin ? TOUR_WELCOME.bodyWithPin : TOUR_WELCOME.bodyNoPin),
        showButtons: ["next", "close"],
      },
    },
  ];

  if (variant === "empty") {
    if (exists(TOUR_ADD_READER.anchorId)) {
      steps.push({
        element: sel(TOUR_ADD_READER.anchorId),
        popover: { title: esc(TOUR_ADD_READER.title), description: para(TOUR_ADD_READER.body) },
      });
    } else {
      steps.push({
        popover: { title: esc(TOUR_ADD_READER.title), description: para(TOUR_ADD_READER.body) },
      });
    }
  } else {
    if (exists(TOUR_OVERVIEW.anchorId)) {
      steps.push({
        element: sel(TOUR_OVERVIEW.anchorId),
        popover: { title: esc(TOUR_OVERVIEW.title), description: para(TOUR_OVERVIEW.body) },
      });
    }
    for (const m of METRICS) {
      if (!exists(m.anchorId)) continue; // e.g. still loading: skip, never point at nothing
      steps.push({
        element: sel(m.anchorId),
        popover: { title: esc(m.title), description: metricBody(m) },
      });
    }
  }

  steps.push({
    ...(exists(TOUR_CLOSING.anchorId) ? { element: sel(TOUR_CLOSING.anchorId) } : {}),
    popover: { title: esc(TOUR_CLOSING.title), description: para(TOUR_CLOSING.body) },
  });

  return steps;
}

export async function runTeacherTour(opts: RunTourOptions): Promise<Driver> {
  const { variant, hasPin, reducedMotion, announce, returnFocusTo } = opts;

  if (variant === "full") await expandFirstReaderCard();

  const steps = buildSteps(variant, hasPin);
  const titles = steps.map((s) => {
    const t = document.createElement("span");
    t.innerHTML = s.popover?.title ?? "";
    return t.textContent ?? "";
  });

  const d = driver({
    steps,
    animate: !reducedMotion,
    smoothScroll: !reducedMotion,
    allowClose: true,
    allowKeyboardControl: true, // ←/→ move between steps, Esc closes
    overlayClickBehavior: "close",
    // Theme-tinted dark veil (works on the light themes too).
    overlayColor: "color-mix(in srgb, var(--color-bg-primary) 35%, black)",
    overlayOpacity: 0.7,
    stagePadding: 8,
    stageRadius: 16,
    popoverClass: "rr-tour",
    showProgress: true,
    progressText: "Step {{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    onPopoverRender: (popover, { state }) => {
      popover.closeButton.setAttribute("aria-label", "Close tour");
      // driver.js focuses the first focusable (the ×); start on Next instead
      // so Enter moves forward. Runs after driver's own focus call.
      requestAnimationFrame(() => popover.nextButton.focus());
      const i = state.activeIndex ?? 0;
      announce(`Step ${i + 1} of ${steps.length}: ${titles[i] ?? ""}`);
    },
    // Every close (Esc, ×, overlay click, Done) comes through here. driver.js
    // skips onDestroyed when the tour closes mid-animation, so this does the
    // closing itself rather than relying on it.
    onDestroyStarted: () => {
      d.destroy();
      announce("Tour closed.");
      // driver.js tries to restore focus to whatever was focused when the
      // last step opened (often a popover button that no longer exists).
      // Send it back to where the grown-up started instead.
      requestAnimationFrame(() => {
        if (returnFocusTo && returnFocusTo.isConnected) returnFocusTo.focus();
      });
    },
  });

  d.drive();
  return d;
}
