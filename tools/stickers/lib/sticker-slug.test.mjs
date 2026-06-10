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
