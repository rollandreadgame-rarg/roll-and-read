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
