# Parent/Teacher PIN Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, encouraged 4-digit PIN that account holders (parents or teachers) can set to gate Settings/Billing/Teacher, while students keep full access to gameplay, sticker books, and their own progress.

**Architecture:** A pure-JS logic module (hash + lockout, unit-tested with `node:test`) backs Convex mutations that store a salted SHA-256 hash on the `users` row (never exposed to the client). A client `ParentGateProvider` holds session unlock state with a 3-min idle relock; a `RequireParentPin` wrapper guards the three grown-up pages. PIN reset emails a code to the account holder via Clerk.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Convex, Clerk, Tailwind v4, Framer Motion. Tests: Node built-in test runner (`node --test`). No component test framework exists in this repo (consistent with current code); UI tasks verify via `npm run build` + `npm run lint` + manual check.

**Source spec:** `docs/superpowers/specs/2026-06-12-parent-teacher-pin-gate-design.md`

**Conventions to follow:**
- Pure logic lives in `*.logic.mjs` and is tested by a sibling `*.test.mjs` using `node:test` + `node:assert/strict` (see `lib/stickers/revealConfig.test.mjs`).
- All Convex backend files start with `// @ts-nocheck`.
- Theme-aware styling uses CSS variables (`var(--color-brand)`, `var(--color-bg-surface)`, `var(--color-text-primary)`, etc.).
- Respect reduced motion via the existing hook `hooks/usePrefersReducedMotion.ts`.
- `crypto.subtle` is available in BOTH Node 18+ and the Convex runtime, so the hash works in tests and on the server.

---

### Task 1: Pure PIN logic module (hash + format + lockout) — TDD

**Files:**
- Create: `lib/parentPin/parentPinLogic.mjs`
- Test: `lib/parentPin/parentPinLogic.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `lib/parentPin/parentPinLogic.test.mjs`:

```js
// lib/parentPin/parentPinLogic.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidPinFormat,
  hashPin,
  MAX_ATTEMPTS,
  LOCKOUT_MS,
  registerFailure,
  isLockedOut,
} from "./parentPinLogic.mjs";

test("isValidPinFormat accepts exactly 4 digits", () => {
  assert.equal(isValidPinFormat("1234"), true);
  assert.equal(isValidPinFormat("0000"), true);
  assert.equal(isValidPinFormat("123"), false);
  assert.equal(isValidPinFormat("12345"), false);
  assert.equal(isValidPinFormat("12a4"), false);
  assert.equal(isValidPinFormat(""), false);
  assert.equal(isValidPinFormat(null), false);
});

test("hashPin is deterministic, salted by userId, and hides the pin", async () => {
  const a = await hashPin("user_abc", "1234");
  const b = await hashPin("user_abc", "1234");
  const c = await hashPin("user_xyz", "1234"); // different salt
  const d = await hashPin("user_abc", "9999"); // different pin
  assert.equal(a, b, "same inputs -> same hash");
  assert.notEqual(a, c, "different userId -> different hash");
  assert.notEqual(a, d, "different pin -> different hash");
  assert.ok(/^[0-9a-f]{64}$/.test(a), "hash is 64-char hex (sha-256)");
  assert.ok(!a.includes("1234"), "hash does not contain the pin");
});

test("registerFailure escalates and locks at MAX_ATTEMPTS", () => {
  const now = 1_000_000;
  let s = { attempts: 0, lockedUntil: 0 };
  for (let i = 1; i < MAX_ATTEMPTS; i++) {
    s = registerFailure(s.attempts, now);
    assert.equal(s.attempts, i);
    assert.equal(s.lockedUntil, 0, `no lock before ${MAX_ATTEMPTS}`);
  }
  s = registerFailure(s.attempts, now); // the MAX_ATTEMPTS-th failure
  assert.equal(s.attempts, MAX_ATTEMPTS);
  assert.equal(s.lockedUntil, now + LOCKOUT_MS, "locks out at threshold");
});

test("isLockedOut reflects the lock window", () => {
  const now = 1_000_000;
  assert.equal(isLockedOut(0, now), false, "no lock");
  assert.equal(isLockedOut(now + 5000, now), true, "within window");
  assert.equal(isLockedOut(now - 1, now), false, "window passed");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/parentPin/parentPinLogic.test.mjs`
Expected: FAIL — `Cannot find module './parentPinLogic.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/parentPin/parentPinLogic.mjs`:

```js
// lib/parentPin/parentPinLogic.mjs
// Pure, runtime-agnostic logic for the parent/teacher PIN gate.
// crypto.subtle exists in Node 18+ and the Convex runtime, so this runs in both.

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 60_000; // 60s base lockout

export function isValidPinFormat(pin) {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

// Salted SHA-256. Salt = the user's unique id. Returns lowercase hex.
export async function hashPin(userId, pin) {
  const data = new TextEncoder().encode(`${userId}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Given the previous attempt count, return the new lockout state after a failure.
export function registerFailure(prevAttempts, now) {
  const attempts = (prevAttempts ?? 0) + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0;
  return { attempts, lockedUntil };
}

export function isLockedOut(lockedUntil, now) {
  return typeof lockedUntil === "number" && lockedUntil > now;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/parentPin/parentPinLogic.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/parentPin/parentPinLogic.mjs lib/parentPin/parentPinLogic.test.mjs
git commit -m "feat(parent-pin): pure hash + lockout logic with node tests"
```

---

### Task 2: Schema fields + `users.getByClerkId` strips secrets and exposes `hasParentPin`

**Files:**
- Modify: `convex/schema.ts` (users table)
- Modify: `convex/users.ts:36-44` (`getByClerkId`)

- [ ] **Step 1: Add the schema fields**

In `convex/schema.ts`, inside the `users` table, after `subscriptionStatus` add:

```ts
    parentPinHash: v.optional(v.string()),
    parentPinAttempts: v.optional(v.number()),
    parentPinLockedUntil: v.optional(v.number()),
```

(These are optional, so existing rows remain valid.)

- [ ] **Step 2: Update `getByClerkId` to strip secrets and add `hasParentPin`**

Replace the `getByClerkId` handler in `convex/users.ts` with:

```ts
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return null;
    // Never expose PIN secrets to the client; expose only whether one exists.
    const { parentPinHash, parentPinAttempts, parentPinLockedUntil, ...safe } =
      user;
    return { ...safe, hasParentPin: Boolean(parentPinHash) };
  },
});
```

- [ ] **Step 3: Deploy to dev and verify it compiles + returns the flag**

Run:
```bash
CONVEX_DEPLOY_KEY='dev:adamant-hound-452|eyJ2MiI6IjIyNDk1MzVhNDUwODQ3ODg4OTZkOTNmNTAyYmZhNzUxIn0=' npx convex deploy --yes
```
Expected: `Schema validation complete.` then `✔ Deployed Convex functions`.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/users.ts
git commit -m "feat(parent-pin): users schema fields + hasParentPin (secrets stripped)"
```

---

### Task 3: Convex `parentPin.ts` mutations (auth-scoped)

**Files:**
- Create: `convex/parentPin.ts`

All mutations derive the user from `ctx.auth.getUserIdentity()` (the Clerk subject), never a client arg, so a caller can only act on their own account.

- [ ] **Step 1: Create the file**

```ts
// @ts-nocheck
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  isValidPinFormat,
  hashPin,
  registerFailure,
  isLockedOut,
} from "../lib/parentPin/parentPinLogic.mjs";

async function requireUser(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  // Clerk subject === the user's clerkId
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!user) throw new Error("User not found");
  return user;
}

export const setParentPin = mutation({
  args: { pin: v.string() },
  handler: async (ctx, args) => {
    if (!isValidPinFormat(args.pin)) throw new Error("PIN must be 4 digits");
    const user = await requireUser(ctx);
    const parentPinHash = await hashPin(user._id, args.pin);
    await ctx.db.patch(user._id, {
      parentPinHash,
      parentPinAttempts: 0,
      parentPinLockedUntil: 0,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const verifyParentPin = mutation({
  args: { pin: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    if (isLockedOut(user.parentPinLockedUntil, now)) {
      return { ok: false, lockedUntil: user.parentPinLockedUntil };
    }
    if (!user.parentPinHash) return { ok: false };
    const candidate = await hashPin(user._id, args.pin);
    if (candidate === user.parentPinHash) {
      await ctx.db.patch(user._id, {
        parentPinAttempts: 0,
        parentPinLockedUntil: 0,
      });
      return { ok: true };
    }
    const next = registerFailure(user.parentPinAttempts, now);
    await ctx.db.patch(user._id, {
      parentPinAttempts: next.lockedUntil ? 0 : next.attempts,
      parentPinLockedUntil: next.lockedUntil,
    });
    return { ok: false, lockedUntil: next.lockedUntil || undefined };
  },
});

export const changeParentPin = mutation({
  args: { currentPin: v.string(), newPin: v.string() },
  handler: async (ctx, args) => {
    if (!isValidPinFormat(args.newPin)) throw new Error("PIN must be 4 digits");
    const user = await requireUser(ctx);
    const current = await hashPin(user._id, args.currentPin);
    if (current !== user.parentPinHash) return { ok: false };
    const parentPinHash = await hashPin(user._id, args.newPin);
    await ctx.db.patch(user._id, {
      parentPinHash,
      parentPinAttempts: 0,
      parentPinLockedUntil: 0,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const removeParentPin = mutation({
  args: { currentPin: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const current = await hashPin(user._id, args.currentPin);
    if (current !== user.parentPinHash) return { ok: false };
    await ctx.db.patch(user._id, {
      parentPinHash: undefined,
      parentPinAttempts: 0,
      parentPinLockedUntil: 0,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

// Called AFTER the client completes Clerk email-code verification (see Task 8).
export const resetParentPin = mutation({
  args: { newPin: v.string() },
  handler: async (ctx, args) => {
    if (!isValidPinFormat(args.newPin)) throw new Error("PIN must be 4 digits");
    const user = await requireUser(ctx);
    const parentPinHash = await hashPin(user._id, args.newPin);
    await ctx.db.patch(user._id, {
      parentPinHash,
      parentPinAttempts: 0,
      parentPinLockedUntil: 0,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});
```

- [ ] **Step 2: Deploy to dev and verify the bundle resolves the `../lib` import**

Run:
```bash
CONVEX_DEPLOY_KEY='dev:adamant-hound-452|eyJ2MiI6IjIyNDk1MzVhNDUwODQ3ODg4OTZkOTNmNTAyYmZhNzUxIn0=' npx convex deploy --yes
```
Expected: `✔ Deployed Convex functions`.
**If the bundler rejects the `../lib/...mjs` import**, copy `parentPinLogic.mjs` to `convex/parentPinLogic.mjs` and import from `"./parentPinLogic.mjs"` instead (keep the `lib/` copy + its test as the source of truth; the convex copy is generated). Re-run deploy.

- [ ] **Step 3: Commit**

```bash
git add convex/parentPin.ts
git commit -m "feat(parent-pin): auth-scoped set/verify/change/remove/reset mutations"
```

---

### Task 4: `ParentGateProvider` + mount in app layout

**Files:**
- Create: `providers/ParentGateProvider.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Create the provider**

```tsx
// providers/ParentGateProvider.tsx
"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";

const IS_E2E = process.env.NEXT_PUBLIC_E2E_MODE === "true";
const UNLOCK_KEY = "rar_parent_unlocked_at";
const IDLE_MS = 3 * 60 * 1000; // 3 minutes

type Ctx = {
  hasPin: boolean;
  unlocked: boolean;
  markUnlocked: () => void;
  lock: () => void;
  loaded: boolean;
};

const ParentGateContext = createContext<Ctx | null>(null);

export function useParentGate() {
  const ctx = useContext(ParentGateContext);
  if (!ctx) throw new Error("useParentGate must be used within ParentGateProvider");
  return ctx;
}

export function ParentGateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const clerkId = user?.id;
  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip"
  );
  const loaded = IS_E2E || convexUser !== undefined;
  const hasPin = Boolean(convexUser?.hasParentPin) && !IS_E2E;

  const [unlocked, setUnlocked] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    setUnlocked(false);
    try { sessionStorage.removeItem(UNLOCK_KEY); } catch {}
  }, []);

  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(lock, IDLE_MS);
  }, [lock]);

  const markUnlocked = useCallback(() => {
    setUnlocked(true);
    try { sessionStorage.setItem(UNLOCK_KEY, String(Date.now())); } catch {}
    armIdle();
  }, [armIdle]);

  // Restore unlock from sessionStorage on mount (respecting idle window).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(UNLOCK_KEY);
      if (raw && Date.now() - Number(raw) < IDLE_MS) {
        setUnlocked(true);
        armIdle();
      } else if (raw) {
        sessionStorage.removeItem(UNLOCK_KEY);
      }
    } catch {}
  }, [armIdle]);

  // Reset idle timer on activity while unlocked; sync lock across tabs.
  useEffect(() => {
    if (!unlocked) return;
    const onActivity = () => {
      try { sessionStorage.setItem(UNLOCK_KEY, String(Date.now())); } catch {}
      armIdle();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === UNLOCK_KEY && e.newValue === null) setUnlocked(false);
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    window.addEventListener("storage", onStorage);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      window.removeEventListener("storage", onStorage);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [unlocked, armIdle]);

  return (
    <ParentGateContext.Provider value={{ hasPin, unlocked, markUnlocked, lock, loaded }}>
      {children}
    </ParentGateContext.Provider>
  );
}
```

- [ ] **Step 2: Mount it in the app layout**

In `app/(app)/layout.tsx`, import and wrap the existing tree. Replace the `return (...)` block with:

```tsx
  return (
    <ThemeProvider>
      <ParentGateProvider>
        <div className="min-h-dvh flex flex-col" style={{ background: "var(--color-bg-primary)" }}>
          <TopNav />
          <main className="flex-1 flex flex-col">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </ParentGateProvider>
    </ThemeProvider>
  );
```

Add the import at the top: `import { ParentGateProvider } from "@/providers/ParentGateProvider";`

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build completes with zero errors.

- [ ] **Step 4: Commit**

```bash
git add providers/ParentGateProvider.tsx "app/(app)/layout.tsx"
git commit -m "feat(parent-pin): ParentGateProvider with session unlock + 3-min idle relock"
```

---

### Task 5: `PinInput` reusable 4-box field

**Files:**
- Create: `components/parent-pin/PinInput.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/parent-pin/PinInput.tsx
"use client";

import { useRef, useEffect } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
};

const LEN = 4;

export default function PinInput({
  value, onChange, onComplete, disabled, autoFocus, ariaLabel = "PIN",
}: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setDigit = (i: number, d: string) => {
    const digits = value.padEnd(LEN, " ").split("");
    digits[i] = d;
    const next = digits.join("").replace(/ /g, "").slice(0, LEN);
    onChange(next);
    if (d && i < LEN - 1) refs.current[i + 1]?.focus();
    if (next.length === LEN && onComplete) onComplete(next);
  };

  return (
    <div className="flex justify-center gap-3" role="group" aria-label={ariaLabel}>
      {Array.from({ length: LEN }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-label={`${ariaLabel} digit ${i + 1}`}
          value={value[i] ?? ""}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            if (d) setDigit(i, d);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) {
              refs.current[i - 1]?.focus();
              setDigit(i - 1, "");
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LEN);
            if (pasted) {
              onChange(pasted);
              if (pasted.length === LEN && onComplete) onComplete(pasted);
              refs.current[Math.min(pasted.length, LEN - 1)]?.focus();
            }
          }}
          className="w-14 h-16 text-center text-2xl font-bold rounded-2xl border-2 outline-none transition-transform focus:scale-105"
          style={{
            background: "var(--color-bg-surface)",
            borderColor: value[i] ? "var(--color-brand)" : "rgba(255,255,255,0.15)",
            color: "var(--color-text-primary)",
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: zero errors/warnings.

- [ ] **Step 3: Commit**

```bash
git add components/parent-pin/PinInput.tsx
git commit -m "feat(parent-pin): reusable 4-box PinInput"
```

---

### Task 6: `ParentPinPrompt` (unlock dialog) + `ParentPinForgot` placeholder wiring

**Files:**
- Create: `components/parent-pin/ParentPinPrompt.tsx`
- Create: `components/parent-pin/ParentPinForgot.tsx` (full flow added in Task 8; create the shell now so imports resolve)

> **Research step (do first):** Before writing `ParentPinForgot`, confirm the current Clerk email re-verification API using the `claude-api` skill / Clerk docs. Target: send a one-time code to `user.primaryEmailAddress` and verify it. Likely `primaryEmailAddress.prepareVerification({ strategy: "email_code" })` then `.attemptVerification({ code })`; if Clerk blocks re-verifying an already-verified email, use `useReverification` instead. Lock the exact calls before coding Task 8.

- [ ] **Step 1: Create `ParentPinForgot` shell**

```tsx
// components/parent-pin/ParentPinForgot.tsx
"use client";

// Full email-code reset flow is implemented in Task 8.
export default function ParentPinForgot({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  return (
    <div className="text-center">
      <p style={{ color: "var(--color-text-primary)" }}>Loading reset…</p>
      <button onClick={onCancel} className="mt-3 underline text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Back
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `ParentPinPrompt`**

```tsx
// components/parent-pin/ParentPinPrompt.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParentGate } from "@/providers/ParentGateProvider";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import PinInput from "./PinInput";
import ParentPinForgot from "./ParentPinForgot";

export default function ParentPinPrompt() {
  const router = useRouter();
  const { markUnlocked } = useParentGate();
  const verify = useMutation(api.parentPin.verifyParentPin);
  const reduced = usePrefersReducedMotion();

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [forgot, setForgot] = useState(false);

  const locked = lockedUntil > Date.now();

  const submit = async (value: string) => {
    if (locked) return;
    const res = await verify({ pin: value });
    if (res.ok) { markUnlocked(); return; }
    setPin("");
    setError(res.lockedUntil ? "Too many tries — wait a minute." : "Incorrect PIN.");
    if (res.lockedUntil) setLockedUntil(res.lockedUntil);
    if (!reduced) { setShake(true); setTimeout(() => setShake(false), 400); }
  };

  if (forgot) {
    return (
      <Shell>
        <ParentPinForgot onDone={() => markUnlocked()} onCancel={() => setForgot(false)} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Grown-ups only"
        className="w-full max-w-sm text-center"
        style={reduced ? {} : (shake ? { animation: "rar-shake 0.4s" } : {})}
      >
        <div className="text-4xl mb-2">🔒</div>
        <h1 className="text-xl font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>
          Grown-ups only
        </h1>
        <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
          Enter your PIN to open this area.
        </p>
        <PinInput value={pin} onChange={setPin} onComplete={submit} autoFocus disabled={locked} ariaLabel="Unlock PIN" />
        <p aria-live="assertive" className="h-5 mt-3 text-sm" style={{ color: "#f87171" }}>{error}</p>
        <div className="flex items-center justify-between mt-2 text-sm">
          <button onClick={() => setForgot(true)} className="underline" style={{ color: "var(--color-text-secondary)" }}>
            Forgot PIN?
          </button>
          <button onClick={() => router.push("/play")} className="underline" style={{ color: "var(--color-text-secondary)" }}>
            Cancel
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6" style={{ background: "var(--color-bg-primary)" }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Add the shake keyframe**

In `app/globals.css`, append:

```css
@keyframes rar-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add components/parent-pin/ParentPinPrompt.tsx components/parent-pin/ParentPinForgot.tsx app/globals.css
git commit -m "feat(parent-pin): unlock prompt with shake + lockout + forgot entry"
```

---

### Task 7: `RequireParentPin` wrapper + gate the three grown-up pages

**Files:**
- Create: `components/parent-pin/RequireParentPin.tsx`
- Modify: `app/(app)/settings/page.tsx`, `app/(app)/billing/page.tsx`, `app/(app)/teacher/page.tsx`

- [ ] **Step 1: Create the wrapper**

```tsx
// components/parent-pin/RequireParentPin.tsx
"use client";

import { useParentGate } from "@/providers/ParentGateProvider";
import ParentPinPrompt from "./ParentPinPrompt";

export default function RequireParentPin({ children }: { children: React.ReactNode }) {
  const { hasPin, unlocked, loaded } = useParentGate();
  if (!loaded) return null; // brief: waiting on the user record
  if (hasPin && !unlocked) return <ParentPinPrompt />;
  return <>{children}</>;
}
```

- [ ] **Step 2: Wrap each grown-up page**

For each of `app/(app)/settings/page.tsx`, `app/(app)/billing/page.tsx`, `app/(app)/teacher/page.tsx`: import the wrapper and wrap the **single top-level returned element** of the default-exported page component.

Add import: `import RequireParentPin from "@/components/parent-pin/RequireParentPin";`

Change the page's `return ( <X>...</X> );` to `return ( <RequireParentPin><X>...</X></RequireParentPin> );`.

(If a page has multiple `return`s for loading states, wrap the **main** authenticated return — the one rendering the page content. Loading spinners can stay unwrapped.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add components/parent-pin/RequireParentPin.tsx "app/(app)/settings/page.tsx" "app/(app)/billing/page.tsx" "app/(app)/teacher/page.tsx"
git commit -m "feat(parent-pin): gate settings/billing/teacher behind RequireParentPin"
```

---

### Task 8: `ParentPinForgot` (Clerk email-code reset) — full flow

**Files:**
- Modify: `components/parent-pin/ParentPinForgot.tsx`

Implements the API confirmed in Task 6's research step. The version below uses the
`primaryEmailAddress` verification resource; adjust to `useReverification` if the
research found that's required.

- [ ] **Step 1: Implement the three-step flow**

```tsx
// components/parent-pin/ParentPinForgot.tsx
"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isValidPinFormat } from "@/lib/parentPin/parentPinLogic.mjs";
import PinInput from "./PinInput";

type Step = "send" | "code" | "newpin";

export default function ParentPinForgot({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { user } = useUser();
  const reset = useMutation(api.parentPin.resetParentPin);
  const email = user?.primaryEmailAddress;
  const masked = maskEmail(email?.emailAddress ?? "");

  const [step, setStep] = useState<Step>("send");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    if (!email) return;
    setBusy(true); setError("");
    try {
      await email.prepareVerification({ strategy: "email_code" });
      setStep("code");
    } catch {
      setError("Couldn't send a code. Try again.");
    } finally { setBusy(false); }
  };

  const verifyCode = async () => {
    if (!email) return;
    setBusy(true); setError("");
    try {
      await email.attemptVerification({ code });
      setStep("newpin");
    } catch {
      setError("That code didn't work.");
    } finally { setBusy(false); }
  };

  const saveNewPin = async (value: string) => {
    if (!isValidPinFormat(value)) return;
    setBusy(true); setError("");
    try {
      const res = await reset({ newPin: value });
      if (res.ok) onDone(); else setError("Couldn't save the new PIN.");
    } finally { setBusy(false); }
  };

  return (
    <div className="w-full max-w-sm text-center">
      {step === "send" && (
        <>
          <h2 className="text-lg font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>Reset your PIN</h2>
          <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
            We'll email a code to <strong>{masked}</strong>.
          </p>
          <button onClick={sendCode} disabled={busy || !email}
            className="px-5 py-3 rounded-xl font-bold disabled:opacity-50"
            style={{ background: "var(--color-brand)", color: "white" }}>
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </>
      )}
      {step === "code" && (
        <>
          <h2 className="text-lg font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>Enter the code</h2>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>Sent to {masked}.</p>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" aria-label="Email code"
            className="w-40 text-center text-xl font-bold rounded-xl border-2 p-2 outline-none"
            style={{ background: "var(--color-bg-surface)", borderColor: "var(--color-brand)", color: "var(--color-text-primary)" }} />
          <div className="mt-3">
            <button onClick={verifyCode} disabled={busy || code.length < 6}
              className="px-5 py-3 rounded-xl font-bold disabled:opacity-50"
              style={{ background: "var(--color-brand)", color: "white" }}>
              {busy ? "Checking…" : "Verify"}
            </button>
          </div>
        </>
      )}
      {step === "newpin" && (
        <>
          <h2 className="text-lg font-extrabold mb-3" style={{ color: "var(--color-text-primary)" }}>Set a new PIN</h2>
          <PinInput value={pin} onChange={setPin} onComplete={saveNewPin} autoFocus disabled={busy} ariaLabel="New PIN" />
        </>
      )}
      <p aria-live="assertive" className="h-5 mt-3 text-sm" style={{ color: "#f87171" }}>{error}</p>
      <button onClick={onCancel} className="mt-2 underline text-sm" style={{ color: "var(--color-text-secondary)" }}>Back</button>
    </div>
  );
}

function maskEmail(e: string) {
  const [name, domain] = e.split("@");
  if (!domain) return e;
  return `${name.slice(0, 1)}•••@${domain}`;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/parent-pin/ParentPinForgot.tsx
git commit -m "feat(parent-pin): email-code PIN reset via Clerk"
```

---

### Task 9: `ParentPinSetup` + Settings management section + nudge

**Files:**
- Create: `components/parent-pin/ParentPinSetup.tsx`
- Create: `components/parent-pin/ParentPinNudge.tsx`
- Modify: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Create `ParentPinSetup` (enter → confirm)**

```tsx
// components/parent-pin/ParentPinSetup.tsx
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import PinInput from "./PinInput";

export default function ParentPinSetup({ onDone }: { onDone?: () => void }) {
  const setPin = useMutation(api.parentPin.setParentPin);
  const [first, setFirst] = useState("");
  const [confirm, setConfirm] = useState("");
  const [stage, setStage] = useState<"enter" | "confirm">("enter");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onFirst = (v: string) => { setFirst(v); setError(""); setStage("confirm"); };
  const onConfirm = async (v: string) => {
    if (v !== first) { setError("PINs don't match — try again."); setConfirm(""); setFirst(""); setStage("enter"); return; }
    const res = await setPin({ pin: v });
    if (res.ok) { setDone(true); onDone?.(); }
  };

  if (done) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-2">✅</div>
        <p className="font-bold" style={{ color: "var(--color-text-primary)" }}>PIN set!</p>
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Change or remove it anytime in Settings.</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="text-3xl mb-1">🎲🔒</div>
      <h3 className="font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>
        {stage === "enter" ? "Create a grown-up PIN" : "Confirm your PIN"}
      </h3>
      <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
        Parents &amp; teachers: keep students out of settings &amp; billing.
      </p>
      {stage === "enter"
        ? <PinInput value={first} onChange={setFirst} onComplete={onFirst} autoFocus ariaLabel="New PIN" />
        : <PinInput value={confirm} onChange={setConfirm} onComplete={onConfirm} autoFocus ariaLabel="Confirm PIN" />}
      <p aria-live="assertive" className="h-5 mt-3 text-sm" style={{ color: "#f87171" }}>{error}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create the dismissible nudge**

```tsx
// components/parent-pin/ParentPinNudge.tsx
"use client";

import { useState } from "react";
import { useParentGate } from "@/providers/ParentGateProvider";

const KEY = "rar_pin_nudge_dismissed";

export default function ParentPinNudge({ onSetUp }: { onSetUp: () => void }) {
  const { hasPin, loaded } = useParentGate();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  if (!loaded || hasPin || dismissed) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl p-3 mb-4"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-brand)" }}>
      <span className="text-xl">🔒</span>
      <p className="flex-1 text-sm" style={{ color: "var(--color-text-primary)" }}>
        Add a grown-up PIN to keep students out of settings &amp; billing.
      </p>
      <button onClick={onSetUp} className="px-3 py-1.5 rounded-lg text-sm font-bold"
        style={{ background: "var(--color-brand)", color: "white" }}>Set up</button>
      <button aria-label="Dismiss" onClick={() => { try { localStorage.setItem(KEY, "1"); } catch {}; setDismissed(true); }}
        style={{ color: "var(--color-text-secondary)" }}>✕</button>
    </div>
  );
}
```

- [ ] **Step 3: Add a "Grown-up PIN" section to Settings**

In `app/(app)/settings/page.tsx`, add imports:
```tsx
import { useMutation } from "convex/react";
import { useParentGate } from "@/providers/ParentGateProvider";
import ParentPinSetup from "@/components/parent-pin/ParentPinSetup";
import ParentPinNudge from "@/components/parent-pin/ParentPinNudge";
import PinInput from "@/components/parent-pin/PinInput";
```
Render `<ParentPinNudge onSetUp={...}/>` near the top of the settings content, and add a section that:
- if `!hasPin`: shows `<ParentPinSetup/>`.
- if `hasPin`: shows two actions — **Change PIN** (collect current + new via `PinInput`, call `api.parentPin.changeParentPin`) and **Remove PIN** (collect current via `PinInput`, call `api.parentPin.removeParentPin`).

Use `const { hasPin } = useParentGate();`. Wire the mutations:
```tsx
const changePin = useMutation(api.parentPin.changeParentPin);
const removePin = useMutation(api.parentPin.removeParentPin);
```
Mirror the existing settings sections' card styling (`var(--color-bg-surface)`, headings, spacing) so it matches.

- [ ] **Step 4: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: zero errors/warnings.

- [ ] **Step 5: Commit**

```bash
git add components/parent-pin/ParentPinSetup.tsx components/parent-pin/ParentPinNudge.tsx "app/(app)/settings/page.tsx"
git commit -m "feat(parent-pin): setup card, dismissible nudge, Settings manage section"
```

---

### Task 10: `LockButton` in the nav

**Files:**
- Create: `components/parent-pin/LockButton.tsx`
- Modify: `components/navigation/TopNav.tsx`

- [ ] **Step 1: Create the button**

```tsx
// components/parent-pin/LockButton.tsx
"use client";

import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useParentGate } from "@/providers/ParentGateProvider";

const GATED = ["/settings", "/billing", "/teacher"];

export default function LockButton() {
  const pathname = usePathname();
  const { hasPin, unlocked, lock } = useParentGate();
  const onGated = GATED.some((p) => pathname.startsWith(p));
  if (!hasPin || !unlocked || !onGated) return null;
  return (
    <button onClick={lock} aria-label="Lock grown-up areas"
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:bg-white/10">
      <Lock size={14} /> <span className="hidden sm:inline">Lock</span>
    </button>
  );
}
```

- [ ] **Step 2: Render it in `TopNav`**

In `components/navigation/TopNav.tsx`, import `LockButton` and place `<LockButton />` in the right-side `div` (before the `<Settings>` link):

```tsx
import LockButton from "@/components/parent-pin/LockButton";
```
```tsx
      {/* Right side */}
      <div className="flex items-center gap-2">
        <LockButton />
        <Link href="/settings" ...>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add components/parent-pin/LockButton.tsx components/navigation/TopNav.tsx
git commit -m "feat(parent-pin): Lock now button in nav for grown-up areas"
```

---

### Task 11: Deploy, full verification, ship

**Files:** none (deploy + manual verification)

- [ ] **Step 1: Run the logic tests + build + lint**

Run: `node --test lib/parentPin/parentPinLogic.test.mjs && npm run build && npm run lint`
Expected: tests PASS, build OK, lint clean.

- [ ] **Step 2: Deploy Convex to dev AND prod**

```bash
CONVEX_DEPLOY_KEY='dev:adamant-hound-452|eyJ2MiI6IjIyNDk1MzVhNDUwODQ3ODg4OTZkOTNmNTAyYmZhNzUxIn0=' npx convex deploy --yes
CONVEX_DEPLOY_KEY='prod:giddy-lapwing-388|eyJ2MiI6IjYyMjkwNWRjYzM1MTQ1OTM5ODNlZWE2OTg4M2ZkMDhmIn0=' npx convex deploy --yes
```
Expected: both `✔ Deployed Convex functions`.

- [ ] **Step 3: Push to main (auto-deploys Vercel)**

```bash
git push origin main
```
Then poll the Vercel deployment to READY (per the project's deploy-watch pattern).

- [ ] **Step 4: Manual verification on the live domain** (`https://rollandreadgame.com`, signed in as the test account)

Verify each:
- Grown-up areas open normally when no PIN is set; nudge appears in Settings.
- Set a PIN in Settings → Settings/Billing/Teacher now prompt for it; kid pages (Play, Practice, Words, Sticker Book, Shop, Progress) never prompt.
- Correct PIN unlocks all three; "Lock now" re-locks; ~3-min idle re-locks.
- Wrong PIN shakes + errors; 5 wrong → 60s lockout countdown.
- "Forgot PIN?" emails a code to the account email → code → set new PIN → unlocked.
- Change PIN and Remove PIN work; after Remove, areas are open again.

- [ ] **Step 5: Update memory**

Update `launch-plan-production.md` (or a feature memory) noting the parent/teacher PIN gate shipped, where the logic/components live, and that the email reset reuses Clerk.

---

## Self-Review

**Spec coverage:**
- Optional + nudge → Tasks 7 (open when no PIN), 9 (nudge). ✓
- Gated areas Settings/Billing/Teacher → Task 7. ✓
- Kids never gated → Task 7 only wraps 3 pages; provider bypass for E2E. ✓
- Parents AND teachers wording → Tasks 6/9 copy. ✓
- Session unlock + 3-min idle + tab close + Lock now → Task 4 provider, Task 10 button. ✓
- 4-digit, server hash, never exposed → Tasks 1–3. ✓
- Rate limit 5/60s → Tasks 1, 3. ✓
- Email-code recovery via Clerk → Tasks 6 (research), 8. ✓
- Change/Remove in Settings → Task 9. ✓
- Theme-aware + reduced motion + a11y → Tasks 5–9 (CSS vars, `usePrefersReducedMotion`, aria-live, role=dialog). ✓
- Multi-tab sync, lockout persistence, existing PIN-less account → Task 4 (storage events), Task 3 (server lockout), Task 7 (open when no PIN). ✓

**Placeholder scan:** `ParentPinForgot` is intentionally created as a shell in Task 6 then fully implemented in Task 8 (imports must resolve early); not a placeholder gap. The Clerk API is pinned by Task 6's research step before Task 8. No other TODOs.

**Type consistency:** `useParentGate()` returns `{ hasPin, unlocked, markUnlocked, lock, loaded }` — used consistently in Tasks 5–10. Mutations `setParentPin/verifyParentPin/changeParentPin/removeParentPin/resetParentPin` names match across Tasks 3, 6, 8, 9. `isValidPinFormat`/`hashPin`/`registerFailure`/`isLockedOut` names match across Tasks 1, 3, 8.
