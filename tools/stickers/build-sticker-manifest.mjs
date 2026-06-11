// tools/stickers/build-sticker-manifest.mjs
// Walk the source drive, dedup variants/sizes, pick the best master per design,
// enrich with xlsx descriptions, write tools/stickers/out/manifest.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  const name = cleanName(path.basename(file), category, subcategory);
  if (!name) continue;
  const key = `${category}|${subcategory}|${name.toLowerCase()}`;
  const score = scoreSourceFile(file);
  const existing = designs.get(key);
  if (!existing || score > existing.score) {
    designs.set(key, { category, subcategory, name, sourceFile: file, score });
  }
}

// Description is intentionally omitted: the xlsx "Sticker Name" column is a human
// title ("Smiling Dog Holding the Ball") that does not reliably join to the
// filename-derived name ("dog with ball"). The schema field is optional and the
// UI falls back to the name. (Future polish: join via the xlsx "Variant" column,
// which mirrors the filename stem.)
// Title-case for kid-facing labels: "animal block build" -> "Animal Block Build".
// (Rare source-filename typos, e.g. "bog with ball", are preserved — they need a
// manual data pass to fix; tracked as a known follow-up.)
const titleCase = (s) =>
  s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const manifest = [...designs.values()]
  .map((d) => ({
    slug: slugify(d.category, d.subcategory, d.name),
    name: titleCase(d.name),
    category: d.category,
    subcategory: d.subcategory,
    description: "",
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
