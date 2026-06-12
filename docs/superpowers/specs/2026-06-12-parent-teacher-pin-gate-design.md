# Parent/Teacher PIN Gate — Design Spec

- **Date:** 2026-06-12
- **Status:** Approved (design); ready for implementation plan
- **Author:** Claude + Nadir

## Goal

Let an **account holder (parent OR teacher)** optionally set a 4-digit PIN that
keeps students/kids out of the **grown-up areas** of the app. Students keep
**full, ungated access** to gameplay and their own stuff. The feature must be
**seamless and break nothing** in the existing kid flow.

## Locked Decisions

| Topic | Decision |
|---|---|
| Optional? | **Optional**, OFF by default. Encouraged via a dismissible nudge. |
| Gated areas | **Settings, Billing, Teacher** |
| Always open (never gated) | Play, Practice, Word Bank, **Sticker Book**, Shop, Progress/Dashboard |
| Who can set it | Parents **and** teachers — all copy is account-holder-neutral ("Grown-ups", "students") |
| Unlock scope | One correct PIN unlocks **all three** gated areas for the session |
| Re-lock | `sessionStorage`-scoped; **auto-relock after 3 min idle** + on tab close; manual **"Lock now"** |
| PIN length | **4 digits** |
| Storage | Server-side only. Hash never sent to client. |
| Hash | `SHA-256(userId + ":" + pin)` (per-user salt = the unique Convex user `_id`) |
| Rate limit | 5 wrong tries → 60s lockout (escalates); enforced **server-side** |
| Recovery | "Forgot PIN?" → **6-digit code emailed to the account holder's email** (via Clerk, on our prod domain — no Resend) → enter code → set new PIN |
| Manage | Settings has Set / Change / **Remove** PIN (verify current first) |
| E2E mode | Gate is **bypassed** when `NEXT_PUBLIC_E2E_MODE=true` |
| Motion / a11y | Respect `usePrefersReducedMotion`; theme-aware via CSS vars; dialogs labeled + focus-trapped |

## Behavior & Flows

1. **No PIN set (default):** grown-up areas are fully open. A **dismissible nudge**
   ("Add a grown-up PIN to keep students out of settings & billing") appears in
   Settings/Teacher and once after signup. Dismissal persists; never nags again.
2. **Set PIN:** in Settings → "Grown-up PIN" → enter 4 digits → confirm → done.
   The gate is now active.
3. **Unlock:** opening Settings / Billing / Teacher while locked shows a
   **"Grown-ups only 🔒"** prompt. Correct PIN unlocks all three for the session.
4. **Re-lock:** unlock persists across navigation; **auto-relocks after 3 min idle**,
   on tab close, or via the **"Lock now"** button in the nav.
5. **Forgot PIN:** "Forgot PIN?" → app sends a **6-digit code to the account holder's
   email** → they enter it → set a new PIN. (Code, not link — stays in-app, reuses
   Clerk email. A child cannot send a reset to their own address.)
6. **Change / Remove:** Settings → verify current PIN → set new, or remove (turns the
   gate back off, since it's optional).

## Data Model — `convex/schema.ts` (`users` table)

Add optional fields (backward-compatible; existing rows unaffected):

```ts
parentPinHash: v.optional(v.string()),
parentPinAttempts: v.optional(v.number()),
parentPinLockedUntil: v.optional(v.number()),
```

No separate salt column — salt = the user's unique `_id`.

## Convex Functions — new `convex/parentPin.ts`

All sensitive ops derive the user from **`ctx.auth.getUserIdentity()`** (the Clerk
subject), NOT a client-passed `clerkId`, so a caller can only act on their own account.

- `setParentPin({ pin })` — hash + store; clear attempts. (Used for first set.)
- `verifyParentPin({ pin })` → `{ ok: boolean, lockedUntil?: number }`. Checks
  `parentPinLockedUntil`; on success resets attempts; on failure increments attempts
  and sets a 60s (escalating) lockout at the threshold.
- `changeParentPin({ currentPin, newPin })` — verify current, then set new.
- `removeParentPin({ currentPin })` — verify current, then clear all pin fields.
- `resetParentPin({ newPin })` — set a new PIN **after** the client has completed the
  Clerk email-code verification (see Recovery). Trusts the authenticated session.

**Hashing:** SHA-256 via `crypto.subtle.digest` (await inside the mutation). If the
Convex runtime does not expose `crypto.subtle`, fall back to a small synchronous
SHA-256 JS implementation. Verification recomputes and compares; the hash is never
returned to the client.

### `convex/users.ts` changes

`getByClerkId` must **strip** `parentPinHash`, `parentPinAttempts`,
`parentPinLockedUntil` from its return value and add a derived
**`hasParentPin: boolean`**. (Other callers only use `_id`, `email`, `plan`,
`clerkId`, etc., so stripping is safe.)

## Recovery (Clerk email code) — implementation note

Intent: send a one-time 6-digit code to the account holder's **verified primary
email** through Clerk (which already sends mail from `clkmail.rollandreadgame.com`),
verify it client-side, then call `resetParentPin`.

The exact Clerk client primitive must be confirmed during planning against current
Clerk docs — candidates: `useReverification` (purpose-built for gating a sensitive
action behind identity re-verification) or the `EmailAddress` resource
`prepareVerification({ strategy: "email_code" })` / `attemptVerification({ code })`.
This is the one area flagged for a quick docs check before coding.

## Frontend Architecture

- **`providers/ParentGateProvider.tsx`** (client) — context `{ hasPin, unlocked,
  unlock(), lock() }`. Owns: `sessionStorage` key (`rar_parent_unlocked`), the 3-min
  idle timer (reset on pointer/key activity), `storage` event for multi-tab sync,
  `visibilitychange`/`beforeunload` relock. `hasPin` comes from the Convex user query.
  Mounted in `app/(app)/layout.tsx` (inside `ThemeProvider`), wrapping children.
- **`components/parent-pin/PinInput.tsx`** — reusable 4-box numeric field.
- **`components/parent-pin/ParentPinSetup.tsx`** — enter + confirm card (Settings + post-signup nudge).
- **`components/parent-pin/ParentPinPrompt.tsx`** — unlock dialog (`role="dialog"`), with "Forgot PIN?".
- **`components/parent-pin/ParentPinForgot.tsx`** — email-code reset flow.
- **`components/parent-pin/RequireParentPin.tsx`** — wrapper: `!hasPin` → render
  children (open); `hasPin && !unlocked` → render `<ParentPinPrompt/>`; else children.
- **`components/parent-pin/LockButton.tsx`** — nav lock toggle (shown when on a gated route AND unlocked).
- **`components/parent-pin/ParentPinNudge.tsx`** — dismissible encouragement banner (localStorage dismissed flag).

## Page Wiring (minimal edits)

- `app/(app)/layout.tsx` — wrap children in `<ParentGateProvider>`.
- `app/(app)/settings/page.tsx` — wrap in `<RequireParentPin>`; add "Grown-up PIN" manage section + nudge.
- `app/(app)/billing/page.tsx` — wrap in `<RequireParentPin>`.
- `app/(app)/teacher/page.tsx` — wrap in `<RequireParentPin>`; nudge.
- `components/navigation/TopNav.tsx` — render `<LockButton/>`.

The kid pages and all game logic are **untouched**.

## UX / Visual Spec

- **PinInput:** four large (~56px) rounded segmented boxes; `inputmode="numeric"`,
  `autocomplete="one-time-code"`, autofocus, auto-advance, backspace-to-previous,
  paste fills all four; filled box shows a dot/digit and scales briefly; focus ring
  uses `--color-brand`. Theme vars throughout.
- **Setup card:** centered, 🎲🔒 motif, headline "Create a grown-up PIN", subcopy
  "Parents & teachers: keep students out of settings & billing." Two steps
  (Enter → Confirm) with step dots; mismatch → "PINs don't match — try again";
  success → green check + lock-open micro-animation; footnote "Change or remove this
  anytime in Settings."
- **Unlock prompt:** "Grown-ups only 🔒", PinInput, "Forgot PIN?" link, **Cancel**
  (routes back to `/play`). Wrong → shake + red border + `aria-live` announce.
  Lockout → "Too many tries — wait 60s" countdown, input disabled.
- **Forgot flow:** step 1 "We'll email a code to t•••@gmail.com" + Send; step 2 enter
  6-digit code; step 3 set new PIN (reuse setup); success → unlocked.
- **Nudge:** subtle card "Add a grown-up PIN" + "Set up" + dismiss (×); persists dismissal.
- **Motion:** fill-scale, error-shake, success lock-open — all gated by
  `usePrefersReducedMotion`; compositor-only (transform/opacity).
- **A11y:** labeled inputs, focus-trapped dialog, `aria-live` for errors/success, full keyboard support.

## Edge Cases

- No PIN → everything open (optional).
- Multi-tab lock/unlock sync via `storage` events.
- Idle timer resets on interaction; relock on tab-return if 3 min elapsed.
- Existing PIN-less accounts: see the nudge, nothing blocked.
- E2E mode: treated as unlocked, no gate.
- Lockout state lives on the user doc (server) so it survives reloads.
- Reduced motion: instant transitions, no shake/animation.
- Security: PIN mutations key off `ctx.auth` identity, not client args.

## Out of Scope (future)

Per-profile PINs, biometric unlock, "remember this device" beyond the session, SMS
reset, and sticker-book customization.

## Testing

- **Convex:** set/verify/change/remove/lockout logic (hash match, attempt counting, lockout window, identity check).
- **Component:** PinInput behavior; prompt wrong/lockout; setup mismatch; forgot happy path (Clerk mocked).
- **Manual:** on the live prod domain — set PIN, lock/unlock, 3-min idle relock, forgot-code reset, remove PIN.

## File Change Summary

- **New:** `convex/parentPin.ts`; `providers/ParentGateProvider.tsx`;
  `components/parent-pin/{PinInput,ParentPinSetup,ParentPinPrompt,ParentPinForgot,RequireParentPin,LockButton,ParentPinNudge}.tsx`.
- **Edit:** `convex/schema.ts`; `convex/users.ts`; `app/(app)/layout.tsx`;
  `components/navigation/TopNav.tsx`; `app/(app)/{settings,billing,teacher}/page.tsx`.
