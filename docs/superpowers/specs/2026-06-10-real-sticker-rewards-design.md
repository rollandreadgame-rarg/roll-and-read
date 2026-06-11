# Real Sticker Rewards — Design Spec

**Date:** 2026-06-10
**Status:** ✅ Approved — ready for implementation planning
**Author:** Claude + Nadir

---

## 1. Summary

Replace the 50 emoji placeholder stickers with the **622 real, hand-designed
stickers** from `/Volumes/4TB NVME/STICKER PACKS (Merged)`. Add a hosted image
pipeline so the artwork loads fast and cheaply, and change the **earned-sticker
moment** from a silent auto-grant into a **"pick a category" choice** that always
offers a boy-leaning, a girl-leaning, and a neutral option — then surprises the
child with a random sticker from inside the category they pick.

The coin-bought **Shop stays exactly as it is** (blind packs). Only the *earned*
(milestone) path changes, plus the catalog and how stickers are rendered.

---

## 2. The numbers (confirmed)

| Fact | Value |
|---|---|
| Unique sticker designs | **622** |
| Total files on drive | 7,197 (= 622 designs × 3 color variants × ~4 sizes) |
| Color variants per design | light / dark / high-contrast |
| Sizes per design | 128, 256, 512, 1024 px |
| Source format | SVG, but each embeds a base64 raster (~1.3 MB/file) |
| Top-level categories | 10 |
| Subcategories | 50 (~10–18 stickers each) |
| Authoritative metadata | `Sticker Packs_All Items.xlsx` (Category, Name, Variant, Rarity, Short Description) |

**Categories:** Animals, Toys & Fun, Nature, Food, Fantasy & Magic,
Adventure & Travel, Sports & Games, Princess & Royalty, Vehicles,
Holiday & Celebration.

---

## 3. Approved decisions

1. **Choice grain = category.** The child picks one of 3 offered **categories**,
   then receives a **random surprise sticker from inside it** (at the
   achievement's rarity). Broad pick + surprise within — no narrow "you knew it'd
   be a dinosaur" packs.
2. **Always exactly 3 choices** per earned sticker: 1 boy-leaning, 1 girl-leaning,
   1 neutral — each randomly drawn from its bucket so the trio rotates.
3. **Gender tags are internal only.** Never shown to students or teachers. Pure
   backend metadata used to balance the menu.
4. **Shop is unchanged.** Coin-bought blind packs keep their current odds and UI.
5. **D1 — Rarity:** *Re-assign rarities ourselves* across all 622 to build a real
   ladder (common → uncommon → rare → legendary), so rare stickers feel rare and
   the top achievements have something special to award.
6. **D3 — Color variants:** *Light variant only* for v1. Schema stays ready to add
   theme-matched dark/high-contrast later without a migration.
7. **D4 — Hosting:** *Cloudflare R2* (zero egress, ~$0/month within free tier).

---

## 4. Goals & non-goals

**Goals**
- Show real artwork everywhere a sticker appears (book grid, book detail, shop
  reveal, board-complete modal, and the new choice screen).
- Host images so they load fast and don't bloat the repo or slow the game.
- Turn earned stickers into a small, motivating choice with guaranteed variety
  and a surprise payoff.
- Re-seed the catalog from the spreadsheet (all 622, with real categories and
  our re-assigned rarities).

**Non-goals (this spec)**
- No change to coin earning, shop pricing, or shop odds.
- No "complete the pack" bonuses or pack-completion mechanics (possible later).
- No animated/Lottie stickers (the source is static art).
- No theme-matched color variants in v1.

---

## 5. Asset pipeline & hosting

### 5.1 The problem
The source is **9 GB** because every sticker is a ~1.3 MB SVG with a full raster
baked in, times 3 variants times 4 sizes. None of that belongs in the app. A
sticker on screen is 80–300 px; it never needs a 1 MB, 1024 px asset.

### 5.2 The pipeline (build-time, run once)
A script (`scripts/process-stickers.mjs`) walks the source drive and, per design:
1. Picks the **light** variant at **512 px** as the master.
2. Renders/optimizes to **WebP** at two sizes:
   - `thumb` — 256 px (grids, choice cards) — target ~15–35 KB
   - `full` — 512 px (reveal, detail) — target ~40–80 KB
3. Names by a stable slug: `{category}_{subcategory}_{name}.webp`.
4. Uploads to Cloudflare R2 and records the public URL.

Expected output footprint: **622 × 2 sizes × ~40 KB ≈ ~50 MB total** — a ~180×
reduction from source. At display sizes there is no visible quality loss; the
savings come from WebP compression, not from discarding detail kids would see.

> Color-theme variants (dark / high-contrast) are **deferred to v2.** The schema
> is designed so we can add them later without a migration.

### 5.3 Hosting: Cloudflare R2
- Optimized WebP uploaded to an R2 bucket with a public URL.
- **Public URLs stored in the Convex `stickers` table**, so the host can be
  swapped later without touching game code.
- Cost expectation: **$0/month** within R2's free tier (10 GB storage /
  10M reads/month) for a long runway; **~$1–5/month** only at tens of thousands
  of daily players. R2 charges **nothing for traffic**, which is the key saver.

### 5.4 Runtime rendering rules
- Grids use the **thumb** URL; reveal/detail use **full**.
- All grid images `loading="lazy"` + fixed aspect box (no layout shift).
- Emoji stays in the schema as a **fallback** if an image fails to load.

---

## 6. Data model changes

### 6.1 `stickers` table — new/changed fields
```
stickers: {
  name: string,
  category: string,        // now one of the 10 real categories
  subcategory: string,     // NEW — e.g. "CAT", "DINOSAURS"
  rarity: "common"|"uncommon"|"rare"|"legendary",  // re-assigned by us (D1)
  imageThumbUrl: string,   // NEW — 256px WebP on R2
  imageFullUrl: string,    // NEW — 512px WebP on R2
  emoji: string,           // kept as fallback only
  coinCost: number,
  isAnimated: boolean,     // all false for now
  isPaidOnly: boolean,
  description?: string,     // NEW — from xlsx "Short Description"
}
```
Add index `by_subcategory`. Keep existing `by_category`, `by_rarity`.

`profile_stickers` is **unchanged** (profileId + stickerId + earnedAt).

### 6.2 Category gender-lean — static config, NOT a DB column
A file `lib/stickers/packConfig.ts` maps each **category** to one of
`"boy" | "girl" | "neutral"`. Internal, version-controlled, never shown in UI.

| Internal lean | Categories |
|---|---|
| **Boy-leaning** | Vehicles · Sports & Games · Adventure & Travel |
| **Girl-leaning** | Princess & Royalty · Fantasy & Magic · Nature |
| **Neutral** | Animals · Food · Toys & Fun · Holiday & Celebration |

Each reward screen offers one random category from each bucket (3 total),
rotating across plays. Tags are "leanings," not hard genre rules — they only
decide which menu appears; the child is surprised within whichever they choose.

### 6.3 Rarity re-assignment (D1)
The spreadsheet's rarities are ~90% Common with zero Legendaries — not a usable
ladder. We replace them with our own assignment across all 622 to create real
scarcity. Target distribution (tunable during implementation):

| Rarity | Rough share | Feel |
|---|---|---|
| Common | ~55–65% | everyday pickups |
| Uncommon | ~20–25% | nice |
| Rare | ~10–12% | "ooh!" |
| Legendary | ~3–5% | showpiece — the most elaborate/charming designs |

Method: start from the spreadsheet rarity as a hint, then promote the most
detailed/expressive designs (and a balanced spread across categories, so every
category has a few rares/legendaries to chase). The final mapping ships as
committed data reviewable before seeding.

### 6.4 Seeding
`convex/seedStickersReal.ts` parses the xlsx export (committed as JSON) and
inserts all 622 with category, subcategory, our rarity, R2 image URLs, and
description. Safe to re-run (skip-if-exists by name+subcategory). The old
50-emoji seed is retired.

---

## 7. The earned-sticker choice flow (the heart of this)

### 7.1 Flow

```
Board complete  →  milestones computed (as today)
                →  board-complete celebration plays
                →  FOR EACH earned sticker, show a Pick-A-Category screen:

   ┌──────────────────────────────────────────────┐
   │   🎉  You earned a sticker!  Pick one:         │
   │                                                │
   │   ┌────────┐   ┌────────┐   ┌────────┐         │
   │   │  🚗    │   │  👑    │   │  🍕    │         │
   │   │Vehicles│   │Princess│   │  Food  │         │
   │   └────────┘   └────────┘   └────────┘         │
   │     (boy)        (girl)       (neutral)        │
   │   ^ leanings internal — never labeled on screen│
   └──────────────────────────────────────────────┘
        child taps one  →  suspense  →  surprise reveal:

   ┌──────────────────────────────────────────────┐
   │            ✨  You got!  ✨                     │
   │            [ real sticker image ]              │
   │            "Rescue Helicopter" · Rare          │
   └──────────────────────────────────────────────┘
```

1. Build the trio: pick one category from each of the boy/girl/neutral buckets at
   random, preferring buckets/categories where the child still has **unowned**
   stickers (so a fully-collected category isn't offered when avoidable).
2. Each card shows the category name + a representative thumbnail.
3. On tap: grant **one random unowned sticker from that category at the
   achievement's rarity**, falling through tiers *within that category* if the
   exact tier is exhausted, then to any unowned in the category.
4. Reveal the real image with the existing sticker-reveal sound + spring animation.
5. If several milestones fired on one board, present the screens **in sequence**
   (one pick per earned sticker) so each gets its own moment.

### 7.2 New & changed code
- **New:** `components/celebrations/PickCategoryModal.tsx` — the choice + reveal UI.
- **New:** `lib/stickers/packConfig.ts` — category → gender lean map + helper
  `pickRewardTrio(ownedSet)`.
- **New Convex mutation:** `awardStickerFromCategory({ profileId, category,
  preferredRarity })` — replaces/extends `awardMilestoneSticker`; constrains the
  random pick to the chosen category.
- **Changed:** `hooks/useGameState.ts` — instead of auto-granting in parallel and
  stuffing the board-complete modal, it queues the milestone list and drives the
  sequence of pick screens, granting on each choice.

---

## 8. Rendering changes (emoji → image)

Swap emoji for `<img>` (with emoji fallback) in:
1. `app/(app)/sticker-book/page.tsx` — grid tiles + detail card.
2. `app/(app)/shop/page.tsx` — reveal cards.
3. `components/celebrations/...` board-complete earned-sticker display.
4. The new PickCategoryModal.

Also update the **category tabs** in the book (and shop themed-pack categories)
from the old 5 (animals/space/ocean/fantasy/characters) to the real 10. With 622
stickers, the book gets a **subcategory sub-grouping** inside each category tab so
~60-per-category stays browsable (e.g. Animals → Cat / Dog / Dinosaurs…).

---

## 9. Edge cases
- **Category fully collected at the rarity** → fall through tiers within the
  category → then any unowned in the category → only then offer a different
  category of the same gender lean.
- **Child owns everything** (late game) → choice still shown; reveal celebrates a
  "you've collected this one!" state (no crash, no silent no-op).
- **Image fails to load** → emoji fallback renders.
- **Multiple milestones in one board** → sequential pick screens, each grants once.
- **Offline / slow network** → thumbs are tiny + lazy; full image loads on reveal.

---

## 10. Suggested phased rollout
1. **Assets:** processing script → optimized WebP → upload to R2 → URL manifest.
2. **Rarity map:** generate + review the 622-sticker rarity assignment.
3. **Catalog:** new schema fields + real seed from xlsx + category lean config.
4. **Rendering:** emoji → image across book/shop/board-complete; real category tabs.
5. **Choice flow:** PickCategoryModal + sequenced milestone driver + new mutation.
6. **Verify:** play a board, trigger milestones, confirm the trio + surprise +
   reveal + book updates.

---

## 11. Out of scope (future ideas)
- Pack-completion bonuses ("collect all 15 Cats → reward").
- Theme-matched sticker variants (dark / high-contrast).
- Animated/Lottie stickers.
- Trading / favorites / sticker placement on a canvas.
- "Tap to view fullscreen" (would need a larger rendered size).
