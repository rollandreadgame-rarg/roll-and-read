// tools/stickers/lib/rarity.mjs
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
