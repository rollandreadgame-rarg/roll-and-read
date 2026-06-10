# Real Sticker Catalog & Asset Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the 622 source sticker designs into web-optimized WebP images hosted on Cloudflare R2, build a balanced rarity ladder, and seed all 622 into the Convex `stickers` table with working image URLs.

**Architecture:** A set of one-shot Node ESM build scripts run locally against the external source drive: (1) a filesystem walker builds a canonical manifest of 622 designs, (2) a rarity assigner writes a reviewable rarity ladder, (3) an image processor renders + uploads WebP to R2. The output is a committed `stickers.json` consumed by a new idempotent Convex seed mutation. The Convex `stickers` schema gains image-URL, subcategory, and description fields.

**Tech Stack:** Node 20 ESM scripts, `sharp` (SVG→WebP), `@aws-sdk/client-s3` (R2 is S3-compatible), `xlsx` (SheetJS, descriptions), `dotenv`, Convex.

**Source of truth:** Filesystem at `/Volumes/4TB NVME/STICKER PACKS (Merged)` is authoritative for which designs exist and their category/subcategory. The spreadsheet `Sticker Packs_All Items.xlsx` only enriches descriptions. We assign rarity ourselves (per spec D1).

**Prerequisite — external accounts:** Task 0 requires you (Nadir) to create the R2 bucket and paste credentials. Everything else is mechanical.

> **Path note (during execution):** the legacy `/scripts/` dir is git-ignored (it
> holds key-bearing Python scripts), so the pipeline scripts live under
> **`tools/stickers/`** instead. Every `scripts/...` path below maps to
> `tools/stickers/...`, and `scripts/out/` → `tools/stickers/out/`. In
> `process-stickers.mjs`, the repo root is two levels up (`../../convex/...`).

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/sticker-slug.mjs` | Pure helpers: normalize a filename → `{name, slug}`; pick best source file among variants |
| `scripts/build-sticker-manifest.mjs` | Walk source drive → dedup to 622 designs → write `scripts/out/manifest.json` |
| `scripts/assign-rarities.mjs` | Read manifest → assign balanced rarity ladder → write rarity back + `scripts/out/rarity-review.md` |
| `scripts/process-stickers.mjs` | Render thumb/full WebP via sharp → upload to R2 → write `convex/stickerData/stickers.json` |
| `scripts/out/` | Git-ignored intermediate artifacts (manifest.json, rarity-review.md) |
| `convex/stickerData/stickers.json` | Committed final catalog consumed by the seed |
| `convex/schema.ts` | Add `subcategory`, `imageThumbUrl`, `imageFullUrl`, `description`; add `by_subcategory` index |
| `convex/seedStickersReal.ts` | Idempotent seed mutation reading `stickers.json` |
| `convex/adminStickers.ts` | Dev-only `resetStickers` mutation (wipe stickers + profile_stickers before reseed) |
| `.env.local` | R2 credentials (Task 0) |
| `.gitignore` | Add `scripts/out/` |

---

## Task 0: Create the Cloudflare R2 bucket (USER ACTION)

**This task is performed by Nadir, not the agent.** The agent pauses here until the env vars exist.

- [ ] **Step 1: Create the bucket**

1. Go to https://dash.cloudflare.com → **R2** → **Create bucket**.
2. Name it `roll-and-read-stickers`. Region: Automatic.

- [ ] **Step 2: Enable public access**

1. Open the bucket → **Settings** → **Public access** → enable the **r2.dev** subdomain (or attach a custom domain later).
2. Copy the public base URL, e.g. `https://pub-xxxxxxxx.r2.dev`.

- [ ] **Step 3: Create an API token**

1. R2 → **Manage R2 API Tokens** → **Create API Token** → permissions **Object Read & Write**, scoped to this bucket.
2. Copy **Access Key ID**, **Secret Access Key**, and the **Account ID** (shown on the R2 overview page).

- [ ] **Step 4: Add credentials to `.env.local`**

Append these to `/Users/nadirthabatah/Roll And Read Game/roll-and-read/.env.local`:

```
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET=roll-and-read-stickers
R2_PUBLIC_BASE=https://pub-xxxxxxxx.r2.dev
STICKER_SOURCE_DIR=/Volumes/4TB NVME/STICKER PACKS (Merged)
```

Expected: the agent can `process.env.R2_BUCKET` and see `roll-and-read-stickers`.

---

## Task 1: Install build dependencies

**Files:**
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Install**

Run:
```bash
cd "/Users/nadirthabatah/Roll And Read Game/roll-and-read"
npm install --save-dev sharp @aws-sdk/client-s3 xlsx dotenv
```
Expected: installs without error; `package.json` devDependencies now list all four.

- [ ] **Step 2: Add `scripts/out/` to gitignore**

Add this line to `.gitignore`:
```
scripts/out/
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "build: add sticker-pipeline deps (sharp, aws-sdk, xlsx)"
```

---

## Task 2: Slug + source-selection helpers (pure logic, tested)

**Files:**
- Create: `scripts/lib/sticker-slug.mjs`
- Test: `scripts/lib/sticker-slug.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// scripts/lib/sticker-slug.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanName, slugify, scoreSourceFile } from "./sticker-slug.mjs";

test("cleanName strips variant + extension + sticker prefix", () => {
  assert.equal(
    cleanName("sticker_animals_Birthday Cat_light.svg"),
    "Birthday Cat"
  );
  assert.equal(
    cleanName("sticker_vehicles_Rescue Helicopter.high contrast..svg"),
    "Rescue Helicopter"
  );
  assert.equal(
    cleanName("sticker_nature_golden glow butterfly _light.ai.svg"),
    "golden glow butterfly"
  );
});

test("slugify is filesystem + url safe and stable", () => {
  assert.equal(slugify("Animals", "CAT", "Birthday Cat"), "animals_cat_birthday-cat");
  assert.equal(slugify("Food", "ICE CREAM CONES", "Mint Cone"), "food_ice-cream-cones_mint-cone");
});

test("scoreSourceFile prefers 1024 light over others", () => {
  const a = scoreSourceFile("/x/1024px x 1024px/sticker_animals_Cat_light.svg");
  const b = scoreSourceFile("/x/512px x 512px/sticker_animals_Cat_light.svg");
  const c = scoreSourceFile("/x/1024px x 1024px/sticker_animals_Cat_dark.svg");
  assert.ok(a > b, "1024 beats 512");
  assert.ok(a > c, "light beats dark at same size");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/sticker-slug.test.mjs`
Expected: FAIL — `Cannot find module './sticker-slug.mjs'`.

- [ ] **Step 3: Write the implementation**

```js
// scripts/lib/sticker-slug.mjs

// Strip the "sticker_<category>_" prefix, the variant suffix (light/dark/high
// contrast), and any extension(s) like ".ai.svg" or "..svg". Returns the human
// design name, trimmed.
export function cleanName(filename) {
  let s = filename;
  s = s.replace(/\.(ai\.)?svg$/i, "");           // .svg / .ai.svg
  s = s.replace(/[ _.\-]*(high[ _]*contrast|light|dark|contrast)[ _.s]*$/i, "");
  s = s.replace(/^sticker[_ ]+[a-z &]+?[_ ]+/i, ""); // sticker_animals_
  s = s.replace(/[_.\-]+$/g, "");
  return s.replace(/\s+/g, " ").trim();
}

export function slugify(category, subcategory, name) {
  const part = (x) =>
    String(x).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return [part(category), part(subcategory), part(name)].join("_");
}

// Higher score = better master source. Prefer largest size, then light variant.
export function scoreSourceFile(path) {
  const p = path.toLowerCase();
  let size = 0;
  if (p.includes("1024px")) size = 1024;
  else if (p.includes("512px")) size = 512;
  else if (p.includes("256px")) size = 256;
  else if (p.includes("128px")) size = 128;
  let variant = 0;
  if (/high[ _]*contrast/.test(p)) variant = 1;
  else if (/dark/.test(p)) variant = 2;
  else if (/light/.test(p)) variant = 3; // light wins
  else variant = 1; // unmarked
  return size * 10 + variant;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/sticker-slug.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/sticker-slug.mjs scripts/lib/sticker-slug.test.mjs
git commit -m "feat: sticker slug + source-selection helpers"
```

---

## Task 3: Build the source manifest

**Files:**
- Create: `scripts/build-sticker-manifest.mjs`
- Output: `scripts/out/manifest.json` (git-ignored)

- [ ] **Step 1: Write the script**

```js
// scripts/build-sticker-manifest.mjs
// Walk the source drive, dedup variants/sizes, pick the best master per design,
// enrich with xlsx descriptions, write scripts/out/manifest.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { cleanName, slugify, scoreSourceFile } from "./lib/sticker-slug.mjs";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true }); // node + dotenv loads .env by default; we need .env.local

const SRC = process.env.STICKER_SOURCE_DIR;
if (!SRC || !fs.existsSync(SRC)) {
  console.error("STICKER_SOURCE_DIR missing or not mounted:", SRC);
  process.exit(1);
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "out");
fs.mkdirSync(OUT_DIR, { recursive: true });

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.toLowerCase().endsWith(".svg")) acc.push(full);
  }
  return acc;
}

// design key = category|subcategory|cleanName(lowercased)
const designs = new Map();
for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).split(path.sep);
  const category = rel[0];
  const subcategory = rel[1] && !rel[1].includes("px") ? rel[1] : "(misc)";
  const name = cleanName(path.basename(file));
  if (!name) continue;
  const key = `${category}|${subcategory}|${name.toLowerCase()}`;
  const score = scoreSourceFile(file);
  const existing = designs.get(key);
  if (!existing || score > existing.score) {
    designs.set(key, { category, subcategory, name, sourceFile: file, score });
  }
}

// Build a description lookup from the xlsx (best-effort, keyed by lowercased name).
const descByName = new Map();
try {
  const wbPath = path.join(SRC, "Sticker Packs_All Items.xlsx");
  const wb = XLSX.readFile(wbPath);
  for (const sheet of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: "" });
    for (const r of rows) {
      const nm = String(r["Sticker Name"] || "").trim().toLowerCase();
      const desc = String(r["Short Description"] || "").trim();
      if (nm && desc && !descByName.has(nm)) descByName.set(nm, desc);
    }
  }
} catch (e) {
  console.warn("xlsx descriptions skipped:", e.message);
}

const manifest = [...designs.values()]
  .map((d) => ({
    slug: slugify(d.category, d.subcategory, d.name),
    name: d.name,
    category: d.category,
    subcategory: d.subcategory,
    description: descByName.get(d.name.toLowerCase()) || "",
    sourceFile: d.sourceFile,
  }))
  .sort((a, b) => a.slug.localeCompare(b.slug));

// Guard against duplicate slugs.
const seen = new Set();
for (const m of manifest) {
  if (seen.has(m.slug)) { console.error("DUP SLUG:", m.slug); process.exit(1); }
  seen.add(m.slug);
}

fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
const byCat = {};
for (const m of manifest) byCat[m.category] = (byCat[m.category] || 0) + 1;
console.log("TOTAL DESIGNS:", manifest.length);
console.table(byCat);
```

- [ ] **Step 2: Run it (requires the drive mounted)**

Run:
```bash
node scripts/build-sticker-manifest.mjs
```
Expected: `TOTAL DESIGNS: 622` (±a few), and a per-category table matching the spec (Animals ~90, Toys & Fun ~79, etc.). No `DUP SLUG` errors.

- [ ] **Step 3: Sanity-check the output**

Run:
```bash
node -e "const m=require('./scripts/out/manifest.json'); console.log(m.length, m[0])"
```
Expected: a count near 622 and a sample object with `slug`, `name`, `category`, `subcategory`, `sourceFile`.

- [ ] **Step 4: Commit (script only; manifest.json is git-ignored)**

```bash
git add scripts/build-sticker-manifest.mjs
git commit -m "feat: build sticker source manifest from drive"
```

---

## Task 4: Assign the rarity ladder

**Files:**
- Create: `scripts/lib/rarity.mjs`
- Test: `scripts/lib/rarity.test.mjs`
- Create: `scripts/assign-rarities.mjs`
- Output: updates `scripts/out/manifest.json`; writes `scripts/out/rarity-review.md`

- [ ] **Step 1: Write the failing test for the distribution helper**

```js
// scripts/lib/rarity.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { assignRaritiesForGroup, RARITY_TARGET } from "./rarity.mjs";

test("each category gets a balanced ladder with at least one legendary when large", () => {
  const items = Array.from({ length: 90 }, (_, i) => ({ slug: `a-${i}` }));
  const out = assignRaritiesForGroup(items, 12345);
  const counts = out.reduce((m, x) => ((m[x.rarity] = (m[x.rarity] || 0) + 1), m), {});
  assert.ok(counts.legendary >= 1, "has a legendary");
  assert.ok(counts.rare >= 1, "has a rare");
  assert.ok(counts.common > counts.rare, "common is the majority");
  assert.equal(out.length, 90);
});

test("targets are a valid probability ladder", () => {
  const sum = Object.values(RARITY_TARGET).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, "targets sum to 1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/lib/rarity.test.mjs`
Expected: FAIL — `Cannot find module './rarity.mjs'`.

- [ ] **Step 3: Write the rarity helper**

```js
// scripts/lib/rarity.mjs
// Deterministic, per-category balanced rarity assignment so every category has a
// few rares/legendaries to chase. Seeded RNG keeps runs reproducible.
export const RARITY_TARGET = { common: 0.60, uncommon: 0.22, rare: 0.13, legendary: 0.05 };

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Assign rarities to one category's items, honoring the target ladder with
// guaranteed minimums (>=1 legendary and >=1 rare for groups of >=8).
export function assignRaritiesForGroup(items, seed) {
  const n = items.length;
  const want = {
    legendary: Math.max(n >= 8 ? 1 : 0, Math.round(n * RARITY_TARGET.legendary)),
    rare: Math.max(n >= 8 ? 1 : 0, Math.round(n * RARITY_TARGET.rare)),
    uncommon: Math.round(n * RARITY_TARGET.uncommon),
  };
  want.common = Math.max(0, n - want.legendary - want.rare - want.uncommon);

  const rng = mulberry32(seed);
  const order = items
    .map((it) => ({ it, r: rng() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.it);

  const out = [];
  const pour = (count, rarity) => { for (let i = 0; i < count && order.length; i++) out.push({ ...order.shift(), rarity }); };
  pour(want.legendary, "legendary");
  pour(want.rare, "rare");
  pour(want.uncommon, "uncommon");
  pour(order.length, "common");
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/lib/rarity.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the assign-rarities driver**

```js
// scripts/assign-rarities.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assignRaritiesForGroup } from "./lib/rarity.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "out");
const manifestPath = path.join(OUT, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

// Stable per-category seed from the category name.
const seedFor = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

const byCat = new Map();
for (const m of manifest) {
  if (!byCat.has(m.category)) byCat.set(m.category, []);
  byCat.get(m.category).push(m);
}

const result = [];
for (const [cat, items] of byCat) {
  result.push(...assignRaritiesForGroup(items, seedFor(cat)));
}
result.sort((a, b) => a.slug.localeCompare(b.slug));
fs.writeFileSync(manifestPath, JSON.stringify(result, null, 2));

// Human review file.
const counts = result.reduce((m, x) => ((m[x.rarity] = (m[x.rarity] || 0) + 1), m), {});
let md = `# Rarity Review (${result.length} stickers)\n\n`;
md += `Totals: ${JSON.stringify(counts)}\n\n`;
for (const [cat, items] of byCat) {
  md += `## ${cat}\n\n`;
  for (const it of items.map((i) => result.find((r) => r.slug === i.slug))) {
    md += `- **${it.rarity.toUpperCase()}** — ${it.name} _(${it.subcategory})_\n`;
  }
  md += `\n`;
}
fs.writeFileSync(path.join(OUT, "rarity-review.md"), md);
console.log("Rarity counts:", counts);
console.log("Review file:", path.join(OUT, "rarity-review.md"));
```

- [ ] **Step 6: Run it**

Run:
```bash
node scripts/assign-rarities.mjs
```
Expected: prints rarity counts roughly `common ~370, uncommon ~135, rare ~85, legendary ~32`, and writes `scripts/out/rarity-review.md`.

- [ ] **Step 7: USER CHECKPOINT — review the rarity map**

Open `scripts/out/rarity-review.md` and have Nadir skim it. Adjust `RARITY_TARGET` or specific designs if desired, then re-run Task 4 Step 6. Proceed once approved.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/rarity.mjs scripts/lib/rarity.test.mjs scripts/assign-rarities.mjs
git commit -m "feat: balanced per-category rarity ladder"
```

---

## Task 5: Process images + upload to R2

**Files:**
- Create: `scripts/process-stickers.mjs`
- Output: `convex/stickerData/stickers.json` (committed)

- [ ] **Step 1: Write the script**

```js
// scripts/process-stickers.mjs
// For each manifest entry: render thumb(256) + full(512) WebP from the master
// SVG, upload both to R2, and emit convex/stickerData/stickers.json with public
// URLs. Idempotent: skips an upload if the object already exists.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true }); // node + dotenv loads .env by default; we need .env.local

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "out", "manifest.json"), "utf8"));

const {
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE,
} = process.env;
for (const [k, v] of Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE })) {
  if (!v) { console.error("Missing env:", k); process.exit(1); }
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function exists(key) {
  try { await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); return true; }
  catch { return false; }
}

async function renderAndUpload(sourceFile, key, size) {
  if (await exists(key)) return;
  const buf = await sharp(sourceFile, { density: 200 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 82 })
    .toBuffer();
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET, Key: key, Body: buf, ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
  }));
}

const out = [];
let done = 0;
for (const m of manifest) {
  const thumbKey = `stickers/${m.slug}_256.webp`;
  const fullKey = `stickers/${m.slug}_512.webp`;
  try {
    await renderAndUpload(m.sourceFile, thumbKey, 256);
    await renderAndUpload(m.sourceFile, fullKey, 512);
  } catch (e) {
    console.error("FAILED:", m.slug, e.message);
    continue;
  }
  out.push({
    name: m.name,
    category: m.category,
    subcategory: m.subcategory,
    rarity: m.rarity,
    description: m.description || "",
    imageThumbUrl: `${R2_PUBLIC_BASE}/${thumbKey}`,
    imageFullUrl: `${R2_PUBLIC_BASE}/${fullKey}`,
  });
  if (++done % 50 === 0) console.log(`${done}/${manifest.length}`);
}

const outPath = path.join(__dirname, "..", "convex", "stickerData", "stickers.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${out.length} stickers → ${outPath}`);
```

- [ ] **Step 2: Run it (drive mounted + R2 creds set)**

Run:
```bash
node scripts/process-stickers.mjs
```
Expected: progress logs every 50, finishing with `Wrote 622 stickers → .../convex/stickerData/stickers.json`. Re-running is fast (skips existing uploads).

- [ ] **Step 3: Verify an image loads from R2**

Run:
```bash
node -e "const s=require('./convex/stickerData/stickers.json'); console.log(s.length, s[0].imageThumbUrl)"
curl -s -o /dev/null -w "thumb HTTP %{http_code} %{size_download} bytes\n" "$(node -e "console.log(require('./convex/stickerData/stickers.json')[0].imageThumbUrl)")"
```
Expected: count `622`; `thumb HTTP 200` with a non-trivial byte size (~15–35 KB).

- [ ] **Step 4: Commit the catalog (scripts + JSON)**

```bash
git add scripts/process-stickers.mjs convex/stickerData/stickers.json
git commit -m "feat: render stickers to WebP, upload to R2, emit catalog json"
```

---

## Task 6: Extend the `stickers` schema

**Files:**
- Modify: `convex/schema.ts:75-90` (the `stickers` table block)

- [ ] **Step 1: Update the table definition**

Replace the existing `stickers` table block with:

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

(Note: `emoji` becomes optional since real stickers lead with images; existing
seeded rows keep their emoji as fallback.)

- [ ] **Step 2: Deploy the schema**

Run:
```bash
npx convex deploy --yes
```
Expected: deploy succeeds; new index `by_subcategory` is built. No validation errors against existing rows (all new fields are optional).

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add image/subcategory/description fields to stickers schema"
```

---

## Task 7: Dev-only reset mutation

**Files:**
- Create: `convex/adminStickers.ts`

> **Why:** the old 50 emoji stickers use categories (`space`, `ocean`,
> `characters`) that don't exist in the new catalog, and any test
> `profile_stickers` point at their ids. Since there are no real end users yet,
> we wipe both tables before reseeding for a clean catalog. **This deletes all
> earned stickers in every profile** — acceptable pre-launch only.

- [ ] **Step 1: Write the mutation**

```ts
// @ts-nocheck
import { mutation } from "./_generated/server";

// DEV ONLY. Deletes every sticker and every profile_sticker so the catalog can
// be reseeded cleanly. Do not call in production with real users.
export const resetStickers = mutation({
  args: {},
  handler: async (ctx) => {
    let stickers = 0, owned = 0;
    for (const ps of await ctx.db.query("profile_stickers").collect()) {
      await ctx.db.delete(ps._id); owned++;
    }
    for (const s of await ctx.db.query("stickers").collect()) {
      await ctx.db.delete(s._id); stickers++;
    }
    return { deletedStickers: stickers, deletedProfileStickers: owned };
  },
});
```

- [ ] **Step 2: Deploy**

Run: `npx convex deploy --yes`
Expected: deploy succeeds, `adminStickers:resetStickers` is registered.

- [ ] **Step 3: Commit**

```bash
git add convex/adminStickers.ts
git commit -m "feat: dev-only resetStickers mutation"
```

---

## Task 8: Seed the real catalog

**Files:**
- Create: `convex/seedStickersReal.ts`

- [ ] **Step 1: Write the seed mutation**

```ts
// @ts-nocheck
import { mutation } from "./_generated/server";
import stickers from "./stickerData/stickers.json";

// Coin price by rarity, used both for the Shop and the book's "value" display.
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

- [ ] **Step 2: Deploy**

Run: `npx convex deploy --yes`
Expected: deploy succeeds; `seedStickersReal:seedStickersReal` registered.

- [ ] **Step 3: Reset + seed**

Run:
```bash
npx convex run adminStickers:resetStickers
npx convex run seedStickersReal:seedStickersReal
```
Expected: reset returns counts of deleted rows; seed returns `{ inserted: 622, skipped: 0, total: 622 }`.

- [ ] **Step 4: Verify the catalog in Convex**

Run:
```bash
npx convex run stickersDb:getAll | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const a=JSON.parse(d);const cats={};const rar={};for(const s of a){cats[s.category]=(cats[s.category]||0)+1;rar[s.rarity]=(rar[s.rarity]||0)+1;}console.log('count',a.length);console.log('categories',cats);console.log('rarity',rar);console.log('sample',a[0].name,a[0].imageThumbUrl);})"
```
Expected: `count 622`, the 10 real categories present, the rarity ladder roughly matching Task 4, and a sample row carrying a real `imageThumbUrl` on R2.

- [ ] **Step 5: Commit**

```bash
git add convex/seedStickersReal.ts
git commit -m "feat: seed 622 real stickers into Convex catalog"
```

---

## Self-Review (completed during authoring)

**Spec coverage:**
- §2 (622 designs, 10 cats) → Task 3 builds + verifies the manifest.
- §5.2 pipeline (light, 512 master, 256/512 WebP) → Task 5. *(Master read at up to 1024 via `scoreSourceFile`, downscaled — better quality than 512 master, same output sizes; consistent with "no visible quality loss.")*
- §5.3 R2 hosting + URLs in Convex → Tasks 0, 5, 8.
- §6.1 schema fields → Task 6.
- §6.3 rarity re-assignment (D1) → Task 4 + USER CHECKPOINT.
- §6.4 idempotent seed from xlsx-enriched data → Tasks 3, 8.
- Old emoji seed retired → Task 7 reset + Task 8 reseed.

**Out of scope for this plan (lands in Plan 2):** §6.2 category gender-lean config, §7 PickCategoryModal + `useGameState` rewiring + `awardStickerFromCategory`, §8 emoji→image rendering and real category tabs. These need the live catalog this plan produces.

**Placeholder scan:** none — every script and mutation is complete and runnable.

**Type/name consistency:** `slugify` → `{slug}` used identically in Tasks 3/5; manifest fields (`category`, `subcategory`, `rarity`, `sourceFile`) consistent across Tasks 3→4→5; `stickers.json` fields (`imageThumbUrl`/`imageFullUrl`) match the schema in Task 6 and the seed in Task 8; `COIN_COST` keys match the four rarity literals.

**Known follow-ups for Plan 2:** the Shop (`shop/page.tsx`) and Sticker Book (`sticker-book/page.tsx`) currently hardcode the old 5 categories and render `emoji`; until Plan 2 they will show broken/empty state against the new catalog. Plan 2 Task 1 should be the rendering swap to avoid a visible regression window — call this out when starting Plan 2.
