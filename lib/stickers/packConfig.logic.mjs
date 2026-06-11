// lib/stickers/packConfig.logic.mjs
// Internal gender-lean for each category. NEVER shown in the UI — only used to
// balance the 3-up reward choice. (.mjs so node --test can import the pure logic.)
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
