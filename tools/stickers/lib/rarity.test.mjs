// tools/stickers/lib/rarity.test.mjs
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

test("assignment is deterministic for a given seed", () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ slug: `s-${i}` }));
  const a = assignRaritiesForGroup(items, 7).map((x) => `${x.slug}:${x.rarity}`).join(",");
  const b = assignRaritiesForGroup(items, 7).map((x) => `${x.slug}:${x.rarity}`).join(",");
  assert.equal(a, b);
});
