// lib/stickers/packConfig.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_LEAN, pickRewardTrio } from "./packConfig.logic.mjs";

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
