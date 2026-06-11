// lib/stickers/revealConfig.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { revealStyle } from "./revealConfig.logic.mjs";

test("every rarity returns a sound key and a build duration", () => {
  for (const r of ["common", "uncommon", "rare", "legendary"]) {
    const s = revealStyle(r);
    assert.ok(typeof s.sound === "string" && s.sound.length, `${r} has sound`);
    assert.ok(s.buildMs >= 0, `${r} has buildMs`);
    assert.ok(Array.isArray(s.colors), `${r} has colors`);
  }
});

test("intensity escalates with rarity", () => {
  const c = revealStyle("common");
  const r = revealStyle("rare");
  const l = revealStyle("legendary");
  assert.ok(l.confetti > r.confetti && r.confetti > c.confetti, "confetti escalates");
  assert.ok(l.rays === true && c.rays === false, "only legendary has rays");
});

test("unknown rarity falls back to common safely", () => {
  const s = revealStyle("bogus");
  assert.equal(s.sound, "revealCommon");
});
