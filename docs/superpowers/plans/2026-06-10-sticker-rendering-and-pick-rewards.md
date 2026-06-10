# Sticker Rendering & Pick-A-Category Rewards — Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed the 599 real stickers into Convex, render real artwork everywhere a sticker appears across the 10 real categories, and replace the silent milestone auto-grant with a "pick 1 of 3 categories (boy/girl/neutral lean) → random surprise sticker" reward flow.

**Architecture:** Builds on Plan 1 (catalog JSON on R2). First seeds the DB (Plan 1's deferred Tasks 6–8, no reset). Adds a static category→gender-lean config and a category-constrained award mutation. Swaps emoji→`<img>` via one shared `StickerImage` component reused by the Sticker Book, Shop, and a new `PickCategoryModal`. Rewires `useGameState` so board completion queues reward *choices* instead of auto-granting, and defers level-up until the choices are claimed. Retires the legacy 50 emoji stickers last, so the live UI never shows a broken window.

**Tech Stack:** Next.js 16 App Router, React 19, Convex, Framer Motion, Tailwind v4.

**Branch:** continue on `feature/real-sticker-catalog` (do NOT work on `main`).

**Depends on:** Plan 1 Tasks 0–5 complete (599 stickers on R2, `convex/stickerData/stickers.json` committed). ✅ Done.

---

## File Structure

| File | Responsibility |
|---|---|
| `convex/schema.ts` | Add sticker image/subcategory/description fields (Plan 1 Task 6) |
| `convex/seedStickersReal.ts` | Idempotent seed from `stickers.json` (Plan 1 Task 8) |
| `convex/adminStickers.ts` | `removeLegacyStickers` — delete the old 50 emoji rows + their owners |
| `convex/stickersDb.ts` | Add `awardStickerFromCategory` mutation |
| `lib/stickers/packConfig.ts` | Category→lean map + `pickRewardTrio` (pure, tested) |
| `lib/stickers/packConfig.test.mjs` | Unit tests for `pickRewardTrio` |
| `components/stickers/StickerImage.tsx` | Shared `<img>` with emoji/❓ fallback, used everywhere |
| `components/celebrations/PickCategoryModal.tsx` | The choice + reveal UI |
| `components/celebrations/BoardCompleteModal.tsx` | Show "rewards to pick" badge instead of pre-granted stickers |
| `hooks/useGameState.ts` | Queue reward choices; defer level-up until claimed |
| `app/(app)/play/page.tsx` | Render `PickCategoryModal`, wire the reward queue |
| `app/(app)/sticker-book/page.tsx` | 10 real category tabs + subcategory grouping + images |
| `app/(app)/shop/page.tsx` | 10 real categories + image reveal |
| `lib/stickers/categories.ts` | Shared list of the 10 categories + display labels/icons |

---

## Task 1: Seed the catalog (Plan 1 Tasks 6–8, no reset)

**Files:**
- Modify: `convex/schema.ts` (stickers table)
- Create: `convex/seedStickersReal.ts`

> Seeds the 599 as additive rows. The old 50 emoji stickers stay active so the
> live Shop/Book keep working until Task 11 retires them.

- [ ] **Step 1: Apply the schema change**

In `convex/schema.ts`, replace the `stickers` table block with:

```ts
  stickers: defineTable({
    name: v.string(),
    category: v.string(),
    subcategory: v.optional(v.string()),
    rarity: v.union(
      v.literal("common"),
      v.literal("uncommon"),
      v.literal("rare"),
      v.literal("legendary")
    ),
    emoji: v.optional(v.string()),
    imageThumbUrl: v.optional(v.string()),
    imageFullUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    coinCost: v.number(),
    isAnimated: v.boolean(),
    isPaidOnly: v.boolean(),
  })
    .index("by_category", ["category"])
    .index("by_rarity", ["rarity"])
    .index("by_subcategory", ["subcategory"]),
```

- [ ] **Step 2: Create the seed mutation**

```ts
// @ts-nocheck
import { mutation } from "./_generated/server";
import stickers from "./stickerData/stickers.json";

const COIN_COST = { common: 50, uncommon: 100, rare: 200, legendary: 500 };

// Idempotent: skips a sticker that already exists (matched by name+subcategory).
export const seedStickersReal = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("stickers").collect();
    const seen = new Set(existing.map((s) => `${s.name}|${s.subcategory ?? ""}`));

    let inserted = 0, skipped = 0;
    for (const s of stickers) {
      const key = `${s.name}|${s.subcategory ?? ""}`;
      if (seen.has(key)) { skipped++; continue; }
      await ctx.db.insert("stickers", {
        name: s.name,
        category: s.category,
        subcategory: s.subcategory,
        rarity: s.rarity,
        imageThumbUrl: s.imageThumbUrl,
        imageFullUrl: s.imageFullUrl,
        description: s.description || undefined,
        coinCost: COIN_COST[s.rarity] ?? 50,
        isAnimated: false,
        isPaidOnly: false,
      });
      seen.add(key);
      inserted++;
    }
    return { inserted, skipped, total: stickers.length };
  },
});
```

- [ ] **Step 3: Deploy + seed**

Run:
```bash
npx convex deploy --yes
npx convex run seedStickersReal:seedStickersReal
```
Expected: deploy succeeds; seed returns `{ inserted: 599, skipped: 0, total: 599 }`.

- [ ] **Step 4: Verify**

Run:
```bash
npx convex run stickersDb:getAll | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const a=JSON.parse(d);const withImg=a.filter(s=>s.imageThumbUrl).length;console.log('total',a.length,'| withImage',withImg);})"
```
Expected: total `649` (599 new + 50 legacy), withImage `599`.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/seedStickersReal.ts
git commit -m "feat: seed 599 real stickers into Convex (additive, legacy kept)"
```

---

## Task 2: Category config + reward-trio picker (pure, tested)

**Files:**
- Create: `lib/stickers/categories.ts`
- Create: `lib/stickers/packConfig.ts`
- Test: `lib/stickers/packConfig.test.mjs`

- [ ] **Step 1: Write the categories list**

```ts
// lib/stickers/categories.ts
// The 10 real catalog categories (must match convex/stickerData/stickers.json).
export const CATEGORIES = [
  { key: "Animals", label: "Animals", icon: "🐾" },
  { key: "Toys & Fun", label: "Toys & Fun", icon: "🧸" },
  { key: "Nature", label: "Nature", icon: "🌳" },
  { key: "Food", label: "Food", icon: "🍕" },
  { key: "Fantasy & Magic", label: "Fantasy & Magic", icon: "🐉" },
  { key: "Adventure and Travel", label: "Adventure", icon: "🗺️" },
  { key: "Sports & Games", label: "Sports & Games", icon: "⚽" },
  { key: "Princess & Royalty", label: "Princess & Royalty", icon: "👑" },
  { key: "Vehicles", label: "Vehicles", icon: "🚗" },
  { key: "Holiday & Celebration", label: "Holiday", icon: "🎉" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
export const categoryMeta = (key: string) =>
  CATEGORIES.find((c) => c.key === key) ?? { key, label: key, icon: "✨" };
```

- [ ] **Step 2: Write the failing test**

```js
// lib/stickers/packConfig.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_LEAN, pickRewardTrio } from "./packConfig.ts";

test("every category has exactly one lean and all three leans exist", () => {
  const leans = Object.values(CATEGORY_LEAN);
  assert.ok(leans.includes("boy") && leans.includes("girl") && leans.includes("neutral"));
  assert.equal(Object.keys(CATEGORY_LEAN).length, 10);
});

test("pickRewardTrio returns one category per lean", () => {
  const stats = Object.fromEntries(
    Object.keys(CATEGORY_LEAN).map((c) => [c, { unowned: 5 }])
  );
  let i = 0;
  const rng = () => ((i = (i + 0.37) % 1), i); // deterministic
  const trio = pickRewardTrio(stats, rng);
  assert.equal(trio.length, 3);
  const leans = trio.map((c) => CATEGORY_LEAN[c]).sort();
  assert.deepEqual(leans, ["boy", "girl", "neutral"]);
});

test("pickRewardTrio prefers categories that still have unowned stickers", () => {
  const stats = Object.fromEntries(
    Object.keys(CATEGORY_LEAN).map((c) => [c, { unowned: c === "Vehicles" ? 3 : 0 }])
  );
  const rng = () => 0.5;
  const trio = pickRewardTrio(stats, rng);
  assert.ok(trio.includes("Vehicles"), "the only boy-lean cat with unowned is chosen");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test lib/stickers/packConfig.test.mjs`
Expected: FAIL — cannot find `./packConfig.ts` (or import error). If `.ts` import fails under `node --test`, rename the test target: see Step 4 note.

> **Note:** `node --test` can't import `.ts` directly. Keep `packConfig.ts` as the
> app source, but put the pure logic in `lib/stickers/packConfig.logic.mjs` and
> have `packConfig.ts` re-export from it. The test imports the `.mjs`. This mirrors
> the Plan 1 `tools/stickers/lib/*.mjs` pattern.

- [ ] **Step 4: Write the implementation**

```js
// lib/stickers/packConfig.logic.mjs
// Internal gender-lean for each category. NEVER shown in the UI — only used to
// balance the 3-up reward choice.
export const CATEGORY_LEAN = {
  "Vehicles": "boy",
  "Sports & Games": "boy",
  "Adventure and Travel": "boy",
  "Princess & Royalty": "girl",
  "Fantasy & Magic": "girl",
  "Nature": "girl",
  "Animals": "neutral",
  "Food": "neutral",
  "Toys & Fun": "neutral",
  "Holiday & Celebration": "neutral",
};

const LEANS = ["boy", "girl", "neutral"];

// Pick one category per lean. `stats[category] = { unowned }`. Prefer categories
// with unowned > 0; fall back to any in that lean. `rng` is a 0..1 function.
export function pickRewardTrio(stats, rng = Math.random) {
  const out = [];
  for (const lean of LEANS) {
    const inLean = Object.keys(CATEGORY_LEAN).filter((c) => CATEGORY_LEAN[c] === lean);
    const withUnowned = inLean.filter((c) => (stats[c]?.unowned ?? 0) > 0);
    const pool = withUnowned.length ? withUnowned : inLean;
    out.push(pool[Math.floor(rng() * pool.length) % pool.length]);
  }
  return out;
}
```

```ts
// lib/stickers/packConfig.ts
export { CATEGORY_LEAN, pickRewardTrio } from "./packConfig.logic.mjs";
export type Lean = "boy" | "girl" | "neutral";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test lib/stickers/packConfig.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/stickers/categories.ts lib/stickers/packConfig.ts lib/stickers/packConfig.logic.mjs lib/stickers/packConfig.test.mjs
git commit -m "feat: category list + gender-lean reward-trio picker"
```

---

## Task 3: Category-constrained award mutation

**Files:**
- Modify: `convex/stickersDb.ts` (append)

- [ ] **Step 1: Add the mutation**

Append to `convex/stickersDb.ts`:

```ts
// Grant a random UNOWNED sticker from a chosen category, preferring the requested
// rarity and falling through tiers within that category, then any unowned in it.
// Returns the granted sticker, or null if the category is fully collected.
export const awardStickerFromCategory = mutation({
  args: {
    profileId: v.id("profiles"),
    category: v.string(),
    preferredRarity: v.union(
      v.literal("common"),
      v.literal("uncommon"),
      v.literal("rare"),
      v.literal("legendary")
    ),
  },
  handler: async (ctx, args) => {
    const owned = await ctx.db
      .query("profile_stickers")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();
    const ownedIds = new Set(owned.map((ps) => String(ps.stickerId)));

    const inCategory = await ctx.db
      .query("stickers")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
    const unowned = inCategory.filter((s) => !ownedIds.has(String(s._id)));
    if (unowned.length === 0) return null;

    // Prefer the requested rarity, then degrade, then upgrade — so a high-tier
    // milestone still grants *something* from this category.
    const tiers = ["legendary", "rare", "uncommon", "common"];
    const startIdx = tiers.indexOf(args.preferredRarity);
    const order = [...tiers.slice(startIdx), ...tiers.slice(0, startIdx)];

    let pickPool = [];
    for (const rarity of order) {
      pickPool = unowned.filter((s) => s.rarity === rarity);
      if (pickPool.length) break;
    }
    if (!pickPool.length) pickPool = unowned;

    const picked = pickPool[Math.floor(Math.random() * pickPool.length)];
    await ctx.db.insert("profile_stickers", {
      profileId: args.profileId,
      stickerId: picked._id,
      earnedAt: Date.now(),
    });
    return picked;
  },
});
```

- [ ] **Step 2: Deploy + smoke test**

Run:
```bash
npx convex deploy --yes
```
Expected: deploy succeeds; `stickersDb:awardStickerFromCategory` registered.

- [ ] **Step 3: Commit**

```bash
git add convex/stickersDb.ts
git commit -m "feat: awardStickerFromCategory mutation (category-constrained grant)"
```

---

## Task 4: Shared `StickerImage` component

**Files:**
- Create: `components/stickers/StickerImage.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/stickers/StickerImage.tsx
"use client";
import { useState } from "react";

interface StickerImageProps {
  src?: string | null;       // imageThumbUrl or imageFullUrl
  emoji?: string | null;     // legacy fallback
  alt: string;
  className?: string;
  sizePx?: number;           // intrinsic size hint
}

// Renders the real sticker art with a graceful fallback chain:
// image -> legacy emoji -> ❓. Keeps a fixed square box (no layout shift).
export default function StickerImage({ src, emoji, alt, className = "", sizePx = 96 }: StickerImageProps) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: "100%", aspectRatio: "1 / 1" }}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          width={sizePx}
          height={sizePx}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <span className="text-4xl" aria-label={alt}>{emoji || "❓"}</span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/stickers/StickerImage.tsx
git commit -m "feat: shared StickerImage with emoji fallback"
```

---

## Task 5: Sticker Book — real categories, subcategory grouping, images

**Files:**
- Modify: `app/(app)/sticker-book/page.tsx`

- [ ] **Step 1: Replace the category tabs source**

Replace the hardcoded `CATEGORY_TABS` array with the shared list:

```tsx
import { CATEGORIES } from "@/lib/stickers/categories";
import StickerImage from "@/components/stickers/StickerImage";
// ...
const CATEGORY_TABS = CATEGORIES.map((c) => ({ label: `${c.label} ${c.icon}`, value: c.key }));
```

Set the initial `activeCategory` state to `CATEGORIES[0].key` (`"Animals"`).

- [ ] **Step 2: Group the active category by subcategory**

Replace the flat `categoryStickers` grid with a subcategory-grouped render. After
computing `categoryStickers`, insert:

```tsx
  // Group the active category's stickers by subcategory for browsable sections.
  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of categoryStickers) {
      const k = s.subcategory || "Other";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [categoryStickers]);
```

Then render each group with a small heading above its grid (reuse the existing
tile markup, but swap the emoji span for `StickerImage`):

```tsx
{grouped.map(([sub, stickers]) => (
  <div key={sub} className="mb-6">
    <h3 className="text-sm font-bold mb-2 capitalize" style={{ color: "var(--color-text-muted)" }}>
      {sub.toLowerCase()}
    </h3>
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {stickers.map((sticker: any, i: number) => {
        const owned = ownedStickerIds.has(sticker._id);
        const style = RARITY_STYLES[sticker.rarity] ?? RARITY_STYLES.common;
        return (
          <motion.button
            key={sticker._id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(i * 0.02, 0.3) }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedSticker(selectedSticker === sticker._id ? null : sticker._id)}
            className="aspect-square rounded-2xl flex items-center justify-center p-2 relative"
            style={{
              background: owned ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              border: `2px solid ${owned ? style.border : "rgba(255,255,255,0.1)"}`,
              boxShadow: owned ? style.shadow : "none",
              cursor: "pointer",
            }}
            aria-label={owned ? sticker.name : "Unknown sticker"}
          >
            {owned ? (
              <StickerImage src={sticker.imageThumbUrl} emoji={sticker.emoji} alt={sticker.name} />
            ) : (
              <span className="text-3xl opacity-20">❓</span>
            )}
          </motion.button>
        );
      })}
    </div>
  </div>
))}
```

- [ ] **Step 3: Swap the detail card image**

In the selected-sticker detail card, replace `<span className="text-5xl">{sticker.emoji}</span>` with:

```tsx
<div className="w-20 h-20 shrink-0">
  <StickerImage src={sticker.imageFullUrl} emoji={sticker.emoji} alt={sticker.name} />
</div>
```

- [ ] **Step 4: Verify in browser**

Run the dev server (`npm run dev`), open `/sticker-book` with `NEXT_PUBLIC_E2E_MODE=true`.
Expected: 10 category tabs; Animals shows Cat/Dog/Dinosaurs… subheadings; owned
stickers render real art; unowned show ❓.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/sticker-book/page.tsx"
git commit -m "feat: sticker book - 10 categories, subcategory groups, real art"
```

---

## Task 6: Shop — real categories + image reveal

**Files:**
- Modify: `app/(app)/shop/page.tsx`

- [ ] **Step 1: Replace the category list + reveal type**

Replace `const CATEGORIES = [...]` with:

```tsx
import { CATEGORIES as CATALOG_CATEGORIES } from "@/lib/stickers/categories";
import StickerImage from "@/components/stickers/StickerImage";
// ...
const CATEGORIES = CATALOG_CATEGORIES.map((c) => c.key);
```

Set initial `selectedCategory` to `CATALOG_CATEGORIES[0].key`.

Extend `RevealedSticker` to carry the image:

```tsx
type RevealedSticker = { name: string; emoji?: string; imageFullUrl?: string; rarity: string };
```

- [ ] **Step 2: Carry the image through the pick**

In `handleBuy`, change the push to include the image:

```tsx
stickersToReveal.push({
  name: picked.name,
  emoji: picked.emoji,
  imageFullUrl: picked.imageFullUrl,
  rarity: picked.rarity,
});
```

- [ ] **Step 3: Swap the reveal tile**

In the reveal area, replace the emoji `<div>…{s.emoji}…</div>` content with:

```tsx
<div
  className="w-20 h-20 rounded-2xl flex items-center justify-center p-1"
  style={{
    border: `2px solid ${RARITY_COLORS[s.rarity] ?? "#6B7280"}`,
    boxShadow: `0 0 16px ${RARITY_COLORS[s.rarity] ?? "#6B7280"}44`,
    background: "rgba(255,255,255,0.05)",
  }}
>
  <StickerImage src={s.imageFullUrl} emoji={s.emoji} alt={s.name} />
</div>
```

- [ ] **Step 4: Verify**

Open `/shop` (E2E mode), buy a Basic Pack, confirm the reveal shows real art and
the Themed Pack category buttons list the 10 real categories.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/shop/page.tsx"
git commit -m "feat: shop - real categories + image reveal"
```

---

## Task 7: BoardCompleteModal — show "rewards to pick" instead of pre-granted

**Files:**
- Modify: `components/celebrations/BoardCompleteModal.tsx`

> In the new flow, stickers are NOT granted at board-complete time. The modal
> teases how many rewards are waiting, and its primary button starts the pick flow.

- [ ] **Step 1: Change the props**

Replace the `earnedStickers?: EarnedSticker[]` prop with `pendingRewardCount: number`
and rename the button callback to express intent:

```tsx
interface BoardCompleteModalProps {
  show: boolean;
  wordsAdded: number;
  coinsEarned: number;
  accuracy: number;
  streakDays: number;
  theme: string;
  pendingRewardCount: number;
  onPrimary: () => void; // "Pick my sticker(s)!" when rewards pending, else "Play Another Board"
}
```

- [ ] **Step 2: Replace the earned-stickers block with a teaser**

Replace the entire `{earnedStickers.length > 0 && (…)}` block with:

```tsx
{pendingRewardCount > 0 && (
  <motion.div
    initial={{ y: 30, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay: 0.45 }}
    className="mb-5 relative z-10 rounded-2xl py-3 px-4"
    style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }}
  >
    <div className="text-base font-extrabold" style={{ color: "var(--color-accent-gold)" }}>
      🎁 {pendingRewardCount} sticker{pendingRewardCount > 1 ? "s" : ""} to pick!
    </div>
  </motion.div>
)}
```

- [ ] **Step 3: Update the primary button**

Change the `ShimmerButton` label/handler:

```tsx
<ShimmerButton
  onClick={onPrimary}
  className="w-full text-lg py-3"
  background="linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-secondary) 100%)"
>
  {pendingRewardCount > 0 ? "🎁 Pick My Stickers!" : "🎲 Play Another Board"}
</ShimmerButton>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only where the play page still passes the old props (fixed in Task 10).

- [ ] **Step 5: Commit**

```bash
git add components/celebrations/BoardCompleteModal.tsx
git commit -m "feat: board-complete modal teases reward picks instead of granting"
```

---

## Task 8: PickCategoryModal — the choice + reveal

**Files:**
- Create: `components/celebrations/PickCategoryModal.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/celebrations/PickCategoryModal.tsx
"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { pickRewardTrio } from "@/lib/stickers/packConfig";
import { categoryMeta } from "@/lib/stickers/categories";
import StickerImage from "@/components/stickers/StickerImage";

interface Reward { rarity: "common" | "uncommon" | "rare" | "legendary"; label: string }
interface Props {
  show: boolean;
  profileId: string | null;
  reward: Reward | null;             // the current reward to claim
  remaining: number;                 // how many rewards are left including this one
  allStickers: any[] | undefined;    // api.stickersDb.getAll
  ownedStickerIds: Set<string>;      // current profile's owned ids
  onClaimed: () => void;             // advance the queue
}

const RARITY_COLORS: Record<string, string> = {
  common: "#6B7280", uncommon: "#3B82F6", rare: "#A855F7", legendary: "#F59E0B",
};

export default function PickCategoryModal({
  show, profileId, reward, remaining, allStickers, ownedStickerIds, onClaimed,
}: Props) {
  const award = useMutation(api.stickersDb.awardStickerFromCategory);
  const [revealed, setRevealed] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  // Build the trio once per reward. A representative image per category = the
  // first sticker in that category (owned-agnostic).
  const trio = useMemo(() => {
    if (!allStickers || !reward) return [];
    const byCat: Record<string, { unowned: number; sample?: any }> = {};
    for (const s of allStickers) {
      const c = byCat[s.category] || (byCat[s.category] = { unowned: 0 });
      if (!ownedStickerIds.has(s._id)) c.unowned++;
      if (!c.sample) c.sample = s;
    }
    const cats = pickRewardTrio(byCat);
    return cats.map((c) => ({ category: c, ...categoryMeta(c), sample: byCat[c]?.sample }));
    // reward identity is enough to re-roll between sequential rewards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStickers, reward, show]);

  const handlePick = async (category: string) => {
    if (!profileId || busy) return;
    setBusy(true);
    const granted = await award({
      profileId: profileId as Id<"profiles">,
      category,
      preferredRarity: reward!.rarity,
    });
    setRevealed(granted ?? { name: "All collected!", rarity: reward!.rarity, imageFullUrl: null });
    setBusy(false);
  };

  const handleNext = () => {
    setRevealed(null);
    onClaimed();
  };

  return (
    <AnimatePresence>
      {show && reward && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", damping: 16, stiffness: 220 }}
            role="dialog" aria-modal="true" aria-label="Pick a sticker pack"
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <div
              className="relative w-full max-w-sm rounded-3xl p-7 text-center"
              style={{
                background: "linear-gradient(160deg, var(--color-bg-surface) 0%, rgba(30,41,59,0.95) 100%)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              }}
            >
              {!revealed ? (
                <>
                  <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--color-accent-gold)" }}>
                    {reward.label}
                  </div>
                  <h2 className="text-2xl font-extrabold mb-1 text-balance" style={{ color: "var(--color-text-primary)" }}>
                    🎉 Pick a pack!
                  </h2>
                  {remaining > 1 && (
                    <div className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
                      {remaining} rewards to pick
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {trio.map((c) => (
                      <motion.button
                        key={c.category}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        disabled={busy}
                        onClick={() => handlePick(c.category)}
                        className="rounded-2xl p-3 flex flex-col items-center gap-2"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                        aria-label={`Pick ${c.label}`}
                      >
                        <div className="w-14 h-14">
                          <StickerImage src={c.sample?.imageThumbUrl} emoji={c.icon} alt={c.label} />
                        </div>
                        <div className="text-[11px] font-bold leading-tight" style={{ color: "var(--color-text-primary)" }}>
                          {c.label}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-extrabold mb-4" style={{ color: "var(--color-accent-gold)" }}>
                    ✨ You got!
                  </h2>
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 12 }}
                    className="w-32 h-32 mx-auto rounded-3xl flex items-center justify-center p-2"
                    style={{
                      border: `3px solid ${RARITY_COLORS[revealed.rarity] ?? "#6B7280"}`,
                      boxShadow: `0 0 28px ${RARITY_COLORS[revealed.rarity] ?? "#6B7280"}66`,
                      background: "rgba(255,255,255,0.05)",
                    }}
                  >
                    <StickerImage src={revealed.imageFullUrl} emoji={revealed.emoji} alt={revealed.name} sizePx={128} />
                  </motion.div>
                  <div className="mt-3 font-extrabold text-lg" style={{ color: "var(--color-text-primary)" }}>
                    {revealed.name}
                  </div>
                  <div className="text-sm font-semibold capitalize mb-5" style={{ color: RARITY_COLORS[revealed.rarity] }}>
                    {revealed.rarity}
                  </div>
                  <button
                    onClick={handleNext}
                    className="w-full py-3 rounded-2xl font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-secondary))" }}
                  >
                    {remaining > 1 ? "Next 🎁" : "Done!"}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in this file (play page wiring lands in Task 10).

- [ ] **Step 3: Commit**

```bash
git add components/celebrations/PickCategoryModal.tsx
git commit -m "feat: PickCategoryModal - choose category, reveal real sticker"
```

---

## Task 9: Rewire `useGameState` — reward queue + deferred level-up

**Files:**
- Modify: `hooks/useGameState.ts`

- [ ] **Step 1: Add reward-queue state**

Near the other celebration state (around line 103), add:

```ts
  const [pendingRewards, setPendingRewards] = useState<MilestoneTrigger[]>([]);
  const [showPickCategory, setShowPickCategory] = useState(false);
  const deferredLevelUpRef = useRef<string | null>(null);
```

- [ ] **Step 2: Stop auto-granting; queue the milestones instead**

In `handleBoardComplete`, DELETE the `grantResults`/`earnedStickers` block (the
`Promise.all(milestones.map(...))` and the `.filter(...)`), and replace the
`setBoardCompleteData(...)` + level-up `setTimeout` with:

```ts
      // Do NOT auto-grant. Queue the milestone choices for the pick flow.
      setPendingRewards(milestones);
      if (isLevelUp) {
        const next = getNextLevel(profile.currentLevel);
        deferredLevelUpRef.current = next ?? null;
      } else {
        deferredLevelUpRef.current = null;
      }

      setBoardCompleteData({
        wordsAdded: sess.wordsCorrect,
        coinsEarned: sess.coinsEarned,
        accuracy,
        pendingRewardCount: milestones.length,
      });
      setShowBoardComplete(true);

      safeMutate(
        () => saveSessionMut({
          profileId: profileId as Id<"profiles">,
          level: profile.currentLevel,
          boardsPlayed: 1,
          wordsCorrect: sess.wordsCorrect,
          firstAttemptCorrect: sess.firstAttemptCorrect,
          wordsAttempted: sess.wordsAttempted,
          wordsSkipped: sess.wordsSkipped,
          hintsUsed: sess.hintsUsed,
          coinsEarned: sess.coinsEarned,
          stickersEarned: milestones.length,
          duration,
        }),
        "saveSession"
      );
```

Update the `boardCompleteData` state type (line ~104) to:

```ts
  const [boardCompleteData, setBoardCompleteData] = useState<{
    wordsAdded: number;
    coinsEarned: number;
    accuracy: number;
    pendingRewardCount: number;
  }>({ wordsAdded: 0, coinsEarned: 0, accuracy: 0, pendingRewardCount: 0 });
```

Remove the now-unused `awardMilestoneStickerMut` line if no longer referenced.

- [ ] **Step 3: Add the flow-control callbacks**

Replace `handlePlayAgain` with the reward-aware version, and add the level-up
resolver:

```ts
  // Called by the board-complete modal's primary button.
  const handleBoardCompletePrimary = useCallback(() => {
    setShowBoardComplete(false);
    if (pendingRewards.length > 0) {
      setShowPickCategory(true);          // start the pick sequence
    } else {
      resolveAfterRewards();              // straight to level-up or new board
    }
  }, [pendingRewards]);

  // Advance the reward queue; when empty, resolve level-up or new board.
  const handleRewardClaimed = useCallback(() => {
    setPendingRewards((prev) => {
      const next = prev.slice(1);
      if (next.length === 0) {
        setShowPickCategory(false);
        // defer to the next tick so the modal unmounts cleanly
        setTimeout(resolveAfterRewards, 50);
      }
      return next;
    });
  }, []);

  const resolveAfterRewards = useCallback(() => {
    const next = deferredLevelUpRef.current;
    if (next) {
      deferredLevelUpRef.current = null;
      setLevelUpData({ newLevel: next });
      setShowLevelUp(true);
      safeMutate(
        () => advanceLevelMut({ profileId: profileId as Id<"profiles">, nextLevel: next }),
        "advanceLevel"
      );
      playSound("levelUp");
    } else {
      startNewBoard();
    }
  }, [profileId, startNewBoard]);
```

- [ ] **Step 4: Export the new state/handlers**

In the hook's `return {...}`, replace `boardCompleteData` usage as needed and add:

```ts
    pendingRewards,
    showPickCategory,
    handleBoardCompletePrimary,
    handleRewardClaimed,
```

Keep `showBoardComplete`, `boardCompleteData`, `showLevelUp`, `levelUpData`,
`handleLevelUpClose`. Remove the old `handlePlayAgain` export (replaced) — or keep
it pointing at `handleBoardCompletePrimary` for compatibility.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in the play page (fixed next).

- [ ] **Step 6: Commit**

```bash
git add hooks/useGameState.ts
git commit -m "feat: queue reward choices on board complete, defer level-up"
```

---

## Task 10: Play page — render the pick flow

**Files:**
- Modify: `app/(app)/play/page.tsx`

- [ ] **Step 1: Pull the catalog + owned ids**

Add queries near the top of the component (the play page already has `profileId`):

```tsx
import { useQuery } from "convex/react";
import PickCategoryModal from "@/components/celebrations/PickCategoryModal";
// ...
const allStickers = useQuery(api.stickersDb.getAll);
const profileStickers = useQuery(
  api.stickersDb.getForProfile,
  profileId ? { profileId: profileId as Id<"profiles"> } : "skip"
);
const ownedStickerIds = new Set((profileStickers ?? []).map((ps: any) => ps.stickerId));
```

- [ ] **Step 2: Update the destructure from `gameState`**

Add the new fields:

```tsx
const {
  // ...existing...
  showBoardComplete,
  boardCompleteData,
  pendingRewards,
  showPickCategory,
  handleBoardCompletePrimary,
  handleRewardClaimed,
} = gameState;
```

- [ ] **Step 3: Update the BoardCompleteModal usage**

```tsx
<BoardCompleteModal
  show={showBoardComplete}
  wordsAdded={boardCompleteData.wordsAdded}
  coinsEarned={boardCompleteData.coinsEarned}
  accuracy={boardCompleteData.accuracy}
  streakDays={gameState.profile?.streakDays ?? 0}
  theme={/* existing theme value */ theme}
  pendingRewardCount={boardCompleteData.pendingRewardCount}
  onPrimary={handleBoardCompletePrimary}
/>
```

- [ ] **Step 4: Render the PickCategoryModal**

Just after `BoardCompleteModal`:

```tsx
<PickCategoryModal
  show={showPickCategory}
  profileId={profileId}
  reward={pendingRewards[0] ?? null}
  remaining={pendingRewards.length}
  allStickers={allStickers}
  ownedStickerIds={ownedStickerIds}
  onClaimed={handleRewardClaimed}
/>
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/play/page.tsx"
git commit -m "feat: wire PickCategoryModal + reward queue into play page"
```

---

## Task 11: Retire the legacy 50 emoji stickers

**Files:**
- Modify: `convex/adminStickers.ts` (add `removeLegacyStickers`)

> Now that all UI reads the real catalog, delete the old emoji rows (the ones with
> no `imageThumbUrl`) and any `profile_stickers` pointing at them. Run AFTER the UI
> tasks so there is never a window where the pages reference deleted data.

- [ ] **Step 1: Add the mutation**

```ts
// Append to convex/adminStickers.ts
export const removeLegacyStickers = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("stickers").collect();
    const legacy = all.filter((s) => !s.imageThumbUrl);
    const legacyIds = new Set(legacy.map((s) => String(s._id)));

    let removedOwned = 0;
    for (const ps of await ctx.db.query("profile_stickers").collect()) {
      if (legacyIds.has(String(ps.stickerId))) { await ctx.db.delete(ps._id); removedOwned++; }
    }
    for (const s of legacy) await ctx.db.delete(s._id);
    return { removedStickers: legacy.length, removedOwned };
  },
});
```

- [ ] **Step 2: Deploy + run**

Run:
```bash
npx convex deploy --yes
npx convex run adminStickers:removeLegacyStickers
```
Expected: `{ removedStickers: 50, removedOwned: <n> }`.

- [ ] **Step 3: Verify the catalog is clean**

Run:
```bash
npx convex run stickersDb:getAll | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const a=JSON.parse(d);console.log('total',a.length,'| missingImage',a.filter(s=>!s.imageThumbUrl).length);})"
```
Expected: total `599`, missingImage `0`.

- [ ] **Step 4: Commit**

```bash
git add convex/adminStickers.ts
git commit -m "chore: retire legacy emoji stickers after UI swap"
```

---

## Task 12: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Enable E2E mode**

Set `NEXT_PUBLIC_E2E_MODE=true` in `.env.local`, run `npm run dev`.

- [ ] **Step 2: Drive the full reward loop**

1. Open `/play`, complete a board (clear all 6 rows).
2. Board-complete modal shows "🎁 N stickers to pick!" and a "Pick My Stickers!" button.
3. Click it → PickCategoryModal shows 3 category cards. Confirm the leans are
   balanced (one of Vehicles/Sports/Adventure, one of Princess/Fantasy/Nature, one
   of Animals/Food/Toys/Holiday) — but NO lean label is visible.
4. Tap a category → a real sticker image reveals with rarity color.
5. If multiple rewards, "Next 🎁" cycles to the next pick; last shows "Done!".
6. If the board triggered a level-up, the level-up overlay appears AFTER the last pick.

- [ ] **Step 3: Confirm collection + shop**

1. Open `/sticker-book` — the just-earned sticker is filled in under its category/subcategory.
2. Open `/shop` — buy a Basic Pack, confirm the reveal shows real art.

- [ ] **Step 4: Disable E2E mode**

Set `NEXT_PUBLIC_E2E_MODE=false` in `.env.local`.

- [ ] **Step 5: Final build check**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: zero TypeScript errors, zero lint errors, successful production build.

---

## Self-Review (completed during authoring)

**Spec coverage (against `2026-06-10-real-sticker-rewards-design.md`):**
- §6.1 schema fields → Task 1.
- §6.2 category gender-lean (internal) → Task 2 (`CATEGORY_LEAN`), used in Task 8.
- §6.3 rarity (re-assigned) → already in `stickers.json` from Plan 1; seeded Task 1.
- §6.4 idempotent seed → Task 1.
- §7 (the heart) pick-1-of-3 + surprise within + sequenced multi-reward + deferred
  level-up → Tasks 7–10. `awardStickerFromCategory` → Task 3.
- §8 emoji→image across book/shop/board-complete + real 10 category tabs +
  subcategory grouping → Tasks 4, 5, 6, 7, 8.
- §9 edge cases: category fully collected (mutation returns null → "All collected!"
  reveal) Task 8; image fail → fallback Task 4; multi-milestone sequencing Task 9;
  lazy thumbs Task 4.
- Shop unchanged in mechanics (odds/pricing) — only rendering + category list updated.

**Placeholder scan:** none. UI tasks that edit existing files show the exact
replacement snippets; the play-page `theme` value reuses whatever the page already
computes (left as `theme` to match existing code).

**Type/name consistency:** `pickRewardTrio(stats, rng)` signature identical in
Task 2 def, test, and Task 8 use; `awardStickerFromCategory({profileId, category,
preferredRarity})` identical in Task 3 def and Task 8 call; `pendingRewardCount` /
`onPrimary` match between Task 7 (modal props), Task 9 (state), Task 10 (play page);
`handleRewardClaimed` / `handleBoardCompletePrimary` consistent across Tasks 9–10;
category strings in `CATEGORY_LEAN` and `categories.ts` match the catalog values in
`stickers.json` exactly ("Adventure and Travel", "Fantasy & Magic", etc.).

**Risk notes for the executor:**
- Task 9 is the highest-risk edit (state machine in a 600-line hook). Verify the
  exact line anchors before editing; the level-up path moved from a 3s timer to
  `resolveAfterRewards`. Test the no-milestone path too (button must say "Play
  Another Board" and go straight to new board / level-up).
- `node --test` can't import `.ts` — Task 2 keeps pure logic in `.mjs` (see note).
- Confirm the play page's existing `theme` variable name when wiring Task 10 Step 3.
