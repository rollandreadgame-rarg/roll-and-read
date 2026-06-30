# Parent/Teacher Onboarding Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-time driver.js spotlight tour plus persistent "?" info tooltips to the `/teacher` dashboard that teach parents how to read each metric (improvement vs. regression).

**Architecture:** A single content model (`lib/teacher-tour/metrics.ts`) feeds both the spotlight tour and the "?" tooltips so copy never drifts. A `TeacherTour` client component drives driver.js over real DOM elements tagged with `data-tour` attributes, auto-expanding the first reader card and skipping any absent anchors (empty chart, no practice words, zero readers). A `hasSeenTeacherTour` flag on the Convex `users` table makes it auto-launch exactly once; a "How this works" header button replays it.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Convex, Clerk, Framer Motion, Tailwind v4, driver.js (~1.3.x, new dependency).

## Global Constraints

- **No unit-test runner exists** in this repo (scripts are only `dev`/`build`/`start`/`lint`). Per the codebase's established pattern, each task is verified with `npx tsc --noEmit`, `npm run lint`, and (for UI-affecting tasks) `npm run build`; final integration is verified live in the browser. Do **not** add a test framework.
- Convex backend files use `// @ts-nocheck` intentionally — keep it.
- **Always `git add convex/_generated`** when Convex functions/schema change, or the Vercel build fails.
- Style with the app's CSS variables (`--color-bg-surface`, `--color-text-primary`, `--color-text-muted`, `--color-brand`, `--color-success`); amber warning color is `#F59E0B` (matches the existing teacher page).
- All explanatory copy is **value-agnostic** — describe what a metric means and what improving/regressing looks like, never the current numbers.
- State **70%** as the "on track" accuracy threshold (matches the existing `avgAccuracy >= 70` check).
- Accessibility: real `<button>`s with `aria-expanded`/`aria-label`, Esc-to-close, focus return; respect `prefers-reduced-motion`.
- Commit after each task.

---

### Task 1: Backend flag + driver.js dependency

**Files:**
- Modify: `convex/schema.ts` (users table, ~line 18)
- Modify: `convex/users.ts` (append a mutation)
- Modify: `package.json` / `package-lock.json` (driver.js)
- Modify: `convex/_generated/*` (regenerated)

**Interfaces:**
- Produces: `api.users.markTeacherTourSeen({ clerkId: string })` mutation; `users` docs gain optional `hasSeenTeacherTour: boolean` (already surfaced by `getByClerkId`, which spreads `...safe`).

- [ ] **Step 1: Install driver.js**

Run: `npm install driver.js@^1.3.1`
Expected: adds `driver.js` to `dependencies`, updates `package-lock.json`, exits 0.

- [ ] **Step 2: Add the schema field**

In `convex/schema.ts`, in the `users` table definition, add this line directly after `parentPinLockedUntil: v.optional(v.number()),`:

```ts
    hasSeenTeacherTour: v.optional(v.boolean()),
```

- [ ] **Step 3: Add the mutation**

Append to `convex/users.ts` (mirrors the existing `updatePlan` patch-by-clerkId pattern):

```ts
export const markTeacherTourSeen = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return; // no-op if user row not bootstrapped yet
    await ctx.db.patch(user._id, {
      hasSeenTeacherTour: true,
      updatedAt: Date.now(),
    });
  },
});
```

- [ ] **Step 4: Regenerate Convex types**

Run: `npx convex codegen`
Expected: updates `convex/_generated/api.d.ts` so `api.users.markTeacherTourSeen` exists; exits 0.

- [ ] **Step 5: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors (Convex files are `@ts-nocheck`; the new field/mutation typecheck clean).

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/users.ts convex/_generated package.json package-lock.json
git commit -m "feat(teacher-tour): add hasSeenTeacherTour flag + markTeacherTourSeen mutation + driver.js dep"
```

---

### Task 2: Content model (single source of truth)

**Files:**
- Create: `lib/teacher-tour/metrics.ts`

**Interfaces:**
- Produces:
  - `interface MetricExplainer { id: string; anchorId: string; icon: string; title: string; what: string; goodSignal: string; watchSignal: string; }`
  - `TOUR_WELCOME: { title: string; body: string }`
  - `TOUR_CLOSING: { title: string; body: string }`
  - `METRICS: MetricExplainer[]` (ids: `accuracy`, `boards`, `level-progress`, `trend`, `practice`; anchorIds: `metric-accuracy`, `metric-boards`, `metric-level-progress`, `metric-trend`, `metric-practice`)
  - `METRIC_BY_ID: Record<string, MetricExplainer>`

- [ ] **Step 1: Create the content model**

Create `lib/teacher-tour/metrics.ts`:

```ts
export interface MetricExplainer {
  id: string;
  anchorId: string;
  icon: string;
  title: string;
  what: string;
  goodSignal: string;
  watchSignal: string;
}

export const TOUR_WELCOME = {
  title: "Welcome to the Parent Dashboard 👋",
  body:
    "This is your private dashboard — it lives behind your parent PIN. " +
    "Here's how to read each number so you can tell at a glance whether your reader is improving. " +
    "You can replay this walkthrough anytime with the “How this works” button.",
};

export const TOUR_CLOSING = {
  title: "That's it! 🎉",
  body:
    "Replay this walkthrough anytime from the “How this works” button at the top of this page.",
};

export const METRICS: MetricExplainer[] = [
  {
    id: "accuracy",
    anchorId: "metric-accuracy",
    icon: "🎯",
    title: "Average Accuracy",
    what: "The share of words your reader gets right on the first try.",
    goodSignal: "70% or higher means they're on track for their current level.",
    watchSignal:
      "Consistently well below 70% usually means the level is too hard right now — that's okay, repetition builds it up.",
  },
  {
    id: "boards",
    anchorId: "metric-boards",
    icon: "🎲",
    title: "Boards Cleared",
    what: "How many game boards your reader has finished overall.",
    goodSignal: "A steadily climbing count means they're playing and progressing.",
    watchSignal: "Stalled for a while? Short, frequent sessions tend to work better than long ones.",
  },
  {
    id: "level-progress",
    anchorId: "metric-level-progress",
    icon: "📊",
    title: "Level Progress",
    what:
      "The curriculum ladder from 1A to 5B. The glowing circle is where they are now; checkmarks are levels they've finished.",
    goodSignal: "Moving rightward over weeks is exactly what you want to see.",
    watchSignal:
      "Levels only advance after sustained ~70% accuracy, so staying put for a while is completely normal.",
  },
  {
    id: "trend",
    anchorId: "metric-trend",
    icon: "📈",
    title: "Accuracy Trend",
    what: "Each point is one play session, oldest to newest — so you can see the direction over time.",
    goodSignal: "A line trending UP means they're improving.",
    watchSignal:
      "Several sessions sliding DOWN can mean the current level needs more practice — consider revisiting earlier words together.",
  },
  {
    id: "practice",
    anchorId: "metric-practice",
    icon: "🔁",
    title: "Needs Practice",
    what: "Words your reader struggled with that the game flagged for review.",
    goodSignal: "A shrinking list means tricky words are sticking.",
    watchSignal: "A growing list points to sound patterns worth practicing out loud together.",
  },
];

export const METRIC_BY_ID: Record<string, MetricExplainer> = Object.fromEntries(
  METRICS.map((m) => [m.id, m])
);
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/teacher-tour/metrics.ts
git commit -m "feat(teacher-tour): add metric explainer content model"
```

---

### Task 3: MetricInfo "?" tooltip component

**Files:**
- Create: `components/teacher-tour/MetricInfo.tsx`

**Interfaces:**
- Consumes: `METRIC_BY_ID` from `lib/teacher-tour/metrics.ts`
- Produces: `export default function MetricInfo({ metricId }: { metricId: string })` — an inline accessible "?" button + popover.

- [ ] **Step 1: Create the component**

Create `components/teacher-tour/MetricInfo.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { METRIC_BY_ID } from "@/lib/teacher-tour/metrics";

export default function MetricInfo({ metricId }: { metricId: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const m = METRIC_BY_ID[metricId];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  if (!m) return null;

  return (
    <span className="relative inline-flex align-middle">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-label={`What does ${m.title} mean?`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="ml-1 h-5 w-5 inline-flex items-center justify-center rounded-full text-xs font-bold transition-colors hover:brightness-125"
        style={{ background: "rgba(255,255,255,0.12)", color: "var(--color-text-muted)" }}
      >
        ?
      </button>
      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-label={`${m.title} explanation`}
          className="absolute z-40 top-7 left-1/2 -translate-x-1/2 w-56 rounded-xl p-3 text-left text-xs shadow-2xl"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "var(--color-text-muted)",
          }}
        >
          <p className="font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>
            {m.icon} {m.title}
          </p>
          <p className="mb-1.5">{m.what}</p>
          <p className="mb-1">
            <strong style={{ color: "var(--color-success)" }}>Improving:</strong> {m.goodSignal}
          </p>
          <p>
            <strong style={{ color: "#F59E0B" }}>Watch for:</strong> {m.watchSignal}
          </p>
        </div>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/teacher-tour/MetricInfo.tsx
git commit -m "feat(teacher-tour): add MetricInfo accessible '?' tooltip"
```

---

### Task 4: TeacherTour driver.js component + theme

**Files:**
- Create: `components/teacher-tour/driver-theme.css`
- Create: `components/teacher-tour/TeacherTour.tsx`

**Interfaces:**
- Consumes: `TOUR_WELCOME`, `TOUR_CLOSING`, `METRICS` from `lib/teacher-tour/metrics.ts`; `driver` + `driver.js/dist/driver.css`.
- Produces: `export interface TeacherTourHandle { start: () => void }`; `export default forwardRef<TeacherTourHandle, { onSeen: () => void }>` component. Anchors it reads from the DOM: `[data-tour="reader-card-toggle"]`, `[data-tour="metric-*"]`, `[data-tour="tour-replay"]`.

- [ ] **Step 1: Create the theme CSS**

Create `components/teacher-tour/driver-theme.css`:

```css
/* Theme driver.js popover to match the app's surfaces. */
.driver-popover.rr-tour {
  background: var(--color-bg-surface);
  color: var(--color-text-muted);
  border-radius: 1rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  max-width: 320px;
}
.driver-popover.rr-tour .driver-popover-title {
  color: var(--color-text-primary);
  font-weight: 800;
  font-size: 1.05rem;
}
.driver-popover.rr-tour .driver-popover-description {
  color: var(--color-text-muted);
  line-height: 1.5;
}
.driver-popover.rr-tour .driver-popover-progress-text {
  color: var(--color-text-muted);
}
.driver-popover.rr-tour button {
  background: var(--color-brand);
  color: #fff;
  border: none;
  border-radius: 0.75rem;
  text-shadow: none;
  font-weight: 700;
}
.driver-popover.rr-tour button.driver-popover-prev-btn {
  background: rgba(255, 255, 255, 0.12);
  color: var(--color-text-primary);
}
.driver-popover.rr-tour .driver-popover-close-btn {
  background: transparent;
  color: var(--color-text-muted);
}
```

- [ ] **Step 2: Create the TeacherTour component**

Create `components/teacher-tour/TeacherTour.tsx`:

```tsx
"use client";

import { forwardRef, useCallback, useImperativeHandle } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./driver-theme.css";
import { METRICS, TOUR_CLOSING, TOUR_WELCOME } from "@/lib/teacher-tour/metrics";

export interface TeacherTourHandle {
  start: () => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// The per-reader metrics live inside a ProfileCard collapsed by default.
// Expand the first one so the inner anchors exist, then wait for the
// 0.25s expand animation to mount them.
function expandFirstReaderCard(): Promise<void> {
  return new Promise((resolve) => {
    const toggle = document.querySelector<HTMLButtonElement>(
      '[data-tour="reader-card-toggle"]'
    );
    if (toggle && toggle.getAttribute("aria-expanded") === "false") {
      toggle.click();
      setTimeout(resolve, 320);
    } else {
      resolve();
    }
  });
}

function buildSteps(): DriveStep[] {
  const steps: DriveStep[] = [];
  steps.push({
    popover: { title: TOUR_WELCOME.title, description: TOUR_WELCOME.body },
  });
  for (const m of METRICS) {
    if (!document.querySelector(`[data-tour="${m.anchorId}"]`)) continue; // skip absent anchors
    steps.push({
      element: `[data-tour="${m.anchorId}"]`,
      popover: {
        title: `${m.icon} ${m.title}`,
        description:
          `${m.what}<br/><br/>` +
          `<strong>Improving:</strong> ${m.goodSignal}<br/>` +
          `<strong>Watch for:</strong> ${m.watchSignal}`,
      },
    });
  }
  const replay = document.querySelector('[data-tour="tour-replay"]');
  steps.push({
    ...(replay ? { element: '[data-tour="tour-replay"]' } : {}),
    popover: { title: TOUR_CLOSING.title, description: TOUR_CLOSING.body },
  });
  return steps;
}

const TeacherTour = forwardRef<TeacherTourHandle, { onSeen: () => void }>(
  function TeacherTour({ onSeen }, ref) {
    const start = useCallback(async () => {
      await expandFirstReaderCard();
      const d = driver({
        showProgress: true,
        animate: !prefersReducedMotion(),
        allowClose: true,
        popoverClass: "rr-tour",
        nextBtnText: "Next →",
        prevBtnText: "← Back",
        doneBtnText: "Got it! 🎉",
        steps: buildSteps(),
        onDestroyed: () => onSeen(),
      });
      d.drive();
    }, [onSeen]);

    useImperativeHandle(ref, () => ({ start }), [start]);
    return null;
  }
);

export default TeacherTour;
```

- [ ] **Step 3: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (If `DriveStep` is not exported by the installed driver.js version, replace `type DriveStep` import with `type DriveStep = Parameters<typeof driver>[0] extends { steps?: (infer S)[] } ? S : never;` is overkill — instead use `any[]` for the steps array and annotate `buildSteps(): any[]`. Prefer the real type if it resolves.)

- [ ] **Step 4: Commit**

```bash
git add components/teacher-tour/TeacherTour.tsx components/teacher-tour/driver-theme.css
git commit -m "feat(teacher-tour): add driver.js TeacherTour component + themed popover"
```

---

### Task 5: Wire tour + tooltips into the teacher page

**Files:**
- Modify: `app/(app)/teacher/page.tsx`

**Interfaces:**
- Consumes: `TeacherTour` (+ `TeacherTourHandle`), `MetricInfo`, `api.users.markTeacherTourSeen`.
- Produces: rendered tour + tooltips + "How this works" button; auto-launch on first visit.

- [ ] **Step 1: Add imports**

At the top of `app/(app)/teacher/page.tsx`, add to the import block:

```tsx
import { useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import TeacherTour, { type TeacherTourHandle } from "@/components/teacher-tour/TeacherTour";
import MetricInfo from "@/components/teacher-tour/MetricInfo";
```

(Note: `useState` is already imported from `"react"` on line 4 — extend that import rather than duplicating; `useQuery` is already imported from `"convex/react"` — add `useMutation` to it.)

- [ ] **Step 2: Tag the reader-card toggle button**

In `ProfileCard`, on the header `<button onClick={() => setIsExpanded((v) => !v)}` (~line 79) that already has `aria-expanded={isExpanded}`, add the attribute:

```tsx
        data-tour="reader-card-toggle"
```

- [ ] **Step 3: Anchor + tooltip the expanded Avg Accuracy and Boards stat tiles**

In `ProfileCard`'s expanded "4 stat tiles" block (~line 179-213), the tiles are built from an array via `.map()`. Replace the array literal's relevant items so they carry a `tourId`/`metricId`, and render those on the tile. Change the array items to:

```tsx
                  { label: "Current Level", value: profile.currentLevel, icon: "📊" },
                  { label: "Boards Cleared", value: profile.totalBoardsCleared, icon: "🎲", tourId: "metric-boards", metricId: "boards" },
                  {
                    label: "Avg Accuracy",
                    value: avgAccuracy !== null ? `${avgAccuracy}%` : "—",
                    icon: "🎯",
                    tourId: "metric-accuracy",
                    metricId: "accuracy",
                  },
                  { label: "Words Learned", value: wordsLearned, icon: "📚" },
```

Update the `.map(({ label, value, icon }) => (` destructure to `.map(({ label, value, icon, tourId, metricId }: any) => (`, add `data-tour={tourId}` to the tile's outer `<div>`, and render the tooltip next to the label:

```tsx
                    <div
                      className="text-xs flex items-center justify-center"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {label}
                      {metricId && <MetricInfo metricId={metricId} />}
                    </div>
```

- [ ] **Step 4: Anchor + tooltip Level Progress**

On the "Level progress" block (~line 216), add `data-tour="metric-level-progress"` to its outer `<div>`, and put the tooltip beside the heading:

```tsx
              <div data-tour="metric-level-progress">
                <h3
                  className="text-sm font-bold mb-3 flex items-center"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Level Progress
                  <MetricInfo metricId="level-progress" />
                </h3>
```

- [ ] **Step 5: Anchor + tooltip the Accuracy Trend chart**

On the `{accuracyData.length > 0 && (<div>` block (~line 256), add `data-tour="metric-trend"` to that `<div>` and the tooltip beside its `<h3>`:

```tsx
              {accuracyData.length > 0 && (
                <div data-tour="metric-trend">
                  <h3
                    className="text-sm font-bold mb-3 flex items-center"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Accuracy Trend (Last {accuracyData.length} Sessions)
                    <MetricInfo metricId="trend" />
                  </h3>
```

- [ ] **Step 6: Anchor + tooltip Needs Practice**

On the `{practiceWords.length > 0 && (` block (~line 394), add `data-tour="metric-practice"` to its outer `<div>` and the tooltip beside its `<h3>` (~line 402-406):

```tsx
                  <h3
                    className="text-sm font-bold mb-3 flex items-center"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    🔁 Needs Practice ({practiceWords.length} words)
                    <MetricInfo metricId="practice" />
                  </h3>
```

(Add `data-tour="metric-practice"` to the `<div>` that wraps this section.)

- [ ] **Step 7: Add tour ref, mutation, auto-launch, button in `TeacherPage`**

In the default-export `TeacherPage` (~line 437), after the existing `clerkUser`/`profiles` queries, add:

```tsx
  const tourRef = useRef<TeacherTourHandle>(null);
  const markTourSeen = useMutation(api.users.markTeacherTourSeen);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (
      !autoStartedRef.current &&
      user?.id &&
      clerkUser &&
      clerkUser.hasSeenTeacherTour !== true &&
      profiles !== undefined
    ) {
      autoStartedRef.current = true;
      // let the dashboard paint first
      const t = setTimeout(() => {
        tourRef.current?.start();
        markTourSeen({ clerkId: user.id });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [user?.id, clerkUser, profiles, markTourSeen]);
```

Inside the `<RequireParentPin>` render, next to the `<h1>` header (~line 531), add the replay button and render the tour (place the button in the header row and the `<TeacherTour>` once anywhere inside):

```tsx
            <button
              type="button"
              data-tour="tour-replay"
              onClick={() => tourRef.current?.start()}
              className="ml-3 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors hover:brightness-125"
              style={{ background: "rgba(255,255,255,0.1)", color: "var(--color-text-primary)" }}
            >
              ❔ How this works
            </button>
```

```tsx
        <TeacherTour ref={tourRef} onSeen={() => { /* flag already set on auto-start; manual replays need no flag write */ }} />
```

- [ ] **Step 8: Verify typecheck, lint, build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass with zero errors/warnings.

- [ ] **Step 9: Commit**

```bash
git add "app/(app)/teacher/page.tsx"
git commit -m "feat(teacher-tour): wire spotlight tour + '?' tooltips into teacher dashboard"
```

---

### Task 6: Live browser verification

**Files:** none (verification only)

**Interfaces:** Consumes the running app; exercises auto-launch, anchors, replay, tooltips, and the seen-flag.

- [ ] **Step 1: Run the app locally with E2E mode**

Set `NEXT_PUBLIC_E2E_MODE=true` in `.env.local` (revert after), start `npm run dev`, and ensure the E2E user has at least one reader with some session data (so the trend chart renders). If needed, seed via the existing E2E setup path.

- [ ] **Step 2: Drive `/teacher` in Playwright (connected to the running dev server)**

Verify and screenshot each:
- On first load with `hasSeenTeacherTour` unset, the tour auto-launches (~600ms after paint); the first reader card auto-expands.
- Each spotlight lands on the correct element: Avg Accuracy tile, Boards tile, Level Progress, Accuracy Trend chart, Needs Practice. Welcome step is centered (no anchor); closing step points at the "How this works" button.
- Reload the page → the tour does **not** auto-launch again (flag persisted).
- Click "❔ How this works" → the tour replays regardless of the flag.
- Click a "?" on a metric → popover opens with the explanation; Esc and outside-click close it; focus returns to the button.
- Empty-state check: with a reader that has no sessions, the trend step is skipped (no broken anchor); with zero readers, only welcome + closing show.

- [ ] **Step 3: Restore config**

Set `NEXT_PUBLIC_E2E_MODE=false` in `.env.local`.

- [ ] **Step 4: Commit any fixes discovered during verification**

```bash
git add -A
git commit -m "fix(teacher-tour): address issues found in live verification"
```

(Skip if no fixes were needed.)

---

## Self-Review

**Spec coverage:**
- Spotlight tour on real elements (driver.js) → Tasks 4 + 5. ✓
- "?" tooltips per metric → Task 3 + wired in Task 5. ✓
- Single source of truth → Task 2 (`metrics.ts`), consumed by both. ✓
- Auto-launch first visit + `hasSeenTeacherTour` on users + `markTeacherTourSeen` → Task 1 + Task 5 effect. ✓
- Re-openable "How this works" button → Task 5 Step 7. ✓
- Auto-expand first reader card → Task 4 `expandFirstReaderCard` + Task 5 Step 2 anchor. ✓
- Empty/zero-reader handling → Task 4 `buildSteps` presence-filter; verified Task 6. ✓
- Accessibility + reduced motion → Task 3 (tooltip), Task 4 (`prefersReducedMotion`, driver a11y). ✓
- 70% threshold copy → Task 2 accuracy entry. ✓
- Verification by build/lint/browser (no test runner) → every task + Task 6. ✓

**Placeholder scan:** No TBD/TODO; all new files have complete code; page edits show exact insertions. The one conditional note (DriveStep type fallback) gives an explicit alternative, not a placeholder.

**Type consistency:** `TeacherTourHandle.start()` defined in Task 4, used in Task 5. `markTeacherTourSeen({ clerkId })` defined Task 1, called Task 5. `MetricInfo({ metricId })` defined Task 3, used Task 5. `anchorId` values in `metrics.ts` (Task 2) match the `data-tour` attributes added in Task 5. Consistent. ✓
