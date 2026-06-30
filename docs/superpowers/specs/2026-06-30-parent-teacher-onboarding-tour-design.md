# Parent/Teacher Onboarding Tour — Design Spec

**Date:** 2026-06-30
**Status:** Approved (design), pending implementation plan
**Feature:** A first-time spotlight walkthrough + persistent info tooltips that teach
parents/teachers how to read the metrics on the Teacher dashboard.

## Goal

Parents and teachers land on `/teacher` and see accuracy %, an accuracy trend chart,
boards cleared, streaks, and "needs practice" words with no explanation of what they
mean or what improvement vs. regression looks like. This feature adds:

1. A **spotlight tour** that highlights each real metric on the page and explains it.
2. Persistent **"?" info tooltips** on each metric for on-demand reminders.

Analogous to the kids' first-run `TutorialModal`, but for the grown-up backend and
anchored to the actual on-screen elements.

## Decisions (locked during brainstorming)

- **Presentation:** Spotlight tour anchored to real DOM elements (dimmed overlay +
  highlight cut-out + tooltip bubble), **not** a centered modal.
- **Engine:** [`driver.js`](https://driverjs.com) — small (~5kb), well-tested, handles
  overlay/positioning/scroll/keyboard. Themed to match the app via CSS variables.
- **Scope:** Teacher dashboard (`/teacher`) metrics only. No multi-page tour. "How to
  access the portal" is covered in the tour's opening step text, not a separate page.
- **Also ship:** persistent "?" info tooltips on each metric.
- **Single source of truth:** tour steps and "?" tooltips read the same content model so
  copy never drifts.
- **Trigger:** auto-launch on the parent's **first** visit to `/teacher`; re-runnable any
  time via a "How this works" button in the Teacher page header.
- **Threshold:** state **70%** as the "on track" accuracy bar to parents (matches the
  existing level-advancement rule in `convex/subscriptionConfig.ts` / level logic).

## Content model (single source of truth)

New file `lib/teacher-tour/metrics.ts` exports an ordered array of explainers consumed by
both the tour and the tooltips:

```ts
interface MetricExplainer {
  id: string;          // stable key, also used by MetricInfo
  anchorId: string;    // matches data-tour="<anchorId>" on the teacher page
  icon: string;        // emoji, matching the app's visual language
  title: string;
  what: string;        // what this metric is
  goodSignal: string;  // what improvement looks like
  watchSignal: string; // what regression / a dip looks like
}
```

### Steps (≈6, in order)

1. **Welcome / opening the portal** — what this dashboard is; that it lives behind the
   parent PIN; how to get back to it. (No anchor, or anchors the page header.)
2. **Avg Accuracy** — % of words correct on the first try. **≥70% is on track**; well
   below that consistently means the level is too hard right now.
3. **Accuracy Trend chart** — each point is a session. **▲ trending up = improving**;
   **▼ several sessions sliding down = regressing**, consider revisiting the level.
4. **Boards Cleared & Level** — how far the reader has progressed; level advances after
   sustained accuracy.
5. **Streak** — consecutive days played; rewards consistency.
6. **Needs Practice words** — words the reader struggled with, surfaced for review.

All copy describes what each metric *means* and what good-vs-concerning looks like —
**never the current numeric values** — so it reads correctly even when the chart is empty
on day one.

## Components & files

| File | Purpose |
|------|---------|
| `lib/teacher-tour/metrics.ts` | Content model (above). Single source of truth. |
| `components/teacher-tour/TeacherTour.tsx` | Owns the driver.js instance; builds steps from the content model; auto-expands the first reader card and scrolls targets into view; exposes a `start()` for manual replay. |
| `components/teacher-tour/MetricInfo.tsx` | Small accessible "?" button + popover, keyed by metric `id`, pulls copy from the content model. |
| `components/teacher-tour/driver-theme.css` | Themes the driver.js popover with the app's CSS vars (`--color-bg-surface`, `--color-text-primary`, `--color-brand`, etc.). |
| `app/(app)/teacher/page.tsx` | Add stable `data-tour="<anchorId>"` attrs to each metric container; drop `<MetricInfo>` next to each metric; render `<TeacherTour>` + a "How this works" button in the header. |
| `convex/schema.ts` | Add `hasSeenTeacherTour: v.optional(v.boolean())` to the `users` table. |
| `convex/users.ts` | New mutation `markTeacherTourSeen`. |

## Data flow (the "seen" flag)

- The flag lives on the **`users`** table (the adult), alongside `parentPinHash` — **not**
  on the child `profiles` table (which holds the kids' `hasSeenTutorial`).
- `useCurrentUser` already returns the user document, which will include
  `hasSeenTeacherTour`.
- On `/teacher` mount: if `user && !user.hasSeenTeacherTour`, auto-start the tour, then
  call `markTeacherTourSeen` so it does not repeat.
- The "How this works" button calls the same `start()` directly, ignoring the flag.

## First-visit / empty-state handling

- Copy is data-agnostic (see content model), so an empty chart on first visit is fine.
- **Zero readers:** the tour shows only the welcome + an "add your first reader" step and
  skips the per-reader spotlights (those anchors won't exist).
- **Reader card collapsed:** the per-reader metrics (Avg Accuracy, Accuracy Trend,
  Sessions, Needs Practice) live inside a `ProfileCard` that is collapsed by default. The
  tour must **auto-expand the first reader's card** before spotlighting those targets, and
  scroll each target into view.

## Accessibility & motion

- Keyboard: Next / Back / Esc; focus moves to each popover; `aria-live` announces each step.
- "?" popovers: real `<button>` with `aria-expanded`; Esc closes; focus returns to trigger.
- Respect `prefers-reduced-motion`: disable driver.js animation when set.
- The whole dashboard is already gated behind `RequireParentPin`, so the tour is inherently
  parent-only.

## Testing / verification

- TypeScript build + ESLint clean (project standard: zero errors/warnings).
- Drive live in the browser (Playwright) on `/teacher`:
  - auto-launch fires on first visit; does **not** re-fire after reload (flag works).
  - each spotlight lands on the correct element; first reader card auto-expands.
  - "How this works" replays the tour regardless of flag.
  - "?" tooltips open/close, keyboard-accessible.
  - zero-readers empty state shows the trimmed tour.
- Screenshot each tour step (developer cannot visually verify otherwise).

## Out of scope (YAGNI)

- Multi-page tour across Settings/Billing.
- Tours for the kids' areas (already covered by `TutorialModal`).
- Per-metric historical benchmarks or recommendations beyond good/watch signal copy.

## Reference points

- Kids' first-run tutorial pattern: `components/celebrations/TutorialModal.tsx` +
  `hasSeenTutorial` flag on `profiles`.
- Teacher metrics live in `app/(app)/teacher/page.tsx` (`ProfileCard` + overview).
- Theme/reduced-motion conventions: see the parent-pin components in
  `components/parent-pin/`.
