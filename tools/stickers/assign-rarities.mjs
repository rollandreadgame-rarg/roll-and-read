// tools/stickers/assign-rarities.mjs
// Read out/manifest.json, assign a balanced per-category rarity ladder, write the
// rarity back, and emit out/rarity-review.md for human review.
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

const bySlug = new Map();
for (const [cat, items] of byCat) {
  for (const it of assignRaritiesForGroup(items, seedFor(cat))) bySlug.set(it.slug, it.rarity);
}

const result = manifest
  .map((m) => ({ ...m, rarity: bySlug.get(m.slug) }))
  .sort((a, b) => a.slug.localeCompare(b.slug));
fs.writeFileSync(manifestPath, JSON.stringify(result, null, 2));

// Human review file.
const counts = result.reduce((m, x) => ((m[x.rarity] = (m[x.rarity] || 0) + 1), m), {});
const RANK = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
let md = `# Rarity Review (${result.length} stickers)\n\n`;
md += `Totals: ${JSON.stringify(counts)}\n\n`;
for (const [cat, items] of byCat) {
  const rows = items
    .map((i) => result.find((r) => r.slug === i.slug))
    .sort((a, b) => RANK[a.rarity] - RANK[b.rarity] || a.name.localeCompare(b.name));
  const c = rows.reduce((m, x) => ((m[x.rarity] = (m[x.rarity] || 0) + 1), m), {});
  md += `## ${cat} (${rows.length}) — L:${c.legendary || 0} R:${c.rare || 0} U:${c.uncommon || 0} C:${c.common || 0}\n\n`;
  for (const it of rows) {
    md += `- **${it.rarity.toUpperCase()}** — ${it.name} _(${it.subcategory})_\n`;
  }
  md += `\n`;
}
fs.writeFileSync(path.join(OUT, "rarity-review.md"), md);
console.log("Rarity counts:", counts);
console.log("Review file:", path.join(OUT, "rarity-review.md"));
