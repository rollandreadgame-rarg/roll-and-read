// tools/stickers/lib/sticker-slug.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanName, slugify, scoreSourceFile } from "./sticker-slug.mjs";

test("cleanName strips sticker prefix + known category + variant + extension", () => {
  assert.equal(
    cleanName("sticker_animals_Birthday Cat_light.svg", "Animals"),
    "Birthday Cat"
  );
  assert.equal(
    cleanName("sticker_vehicles_Rescue Helicopter.high contrast..svg", "Vehicles"),
    "Rescue Helicopter"
  );
  assert.equal(
    cleanName("sticker_nature_golden glow butterfly _light.ai.svg", "Nature"),
    "golden glow butterfly"
  );
});

test("cleanName handles multi-word categories (the 'adventure and travel' bug)", () => {
  assert.equal(
    cleanName("sticker_adventure and travel_Candy Balloon_light.svg", "Adventure and Travel"),
    "Candy Balloon"
  );
});

test("cleanName also strips a repeated subcategory token when present", () => {
  assert.equal(
    cleanName("sticker_animals_dog_dog with ball _light.svg", "Animals", "Dog"),
    "dog with ball"
  );
});

test("cleanName tolerates misspelled/extension-fused variant suffixes", () => {
  assert.equal(cleanName("sticker_holiday & celebration_Cat Stealing Cake darkt.svg", "Holiday & Celebration", "Birthday Cakes"), "Cat Stealing Cake");
  assert.equal(cleanName("sticker_food_pizza_Skateboarding Pizza darksvg.svg", "Food", "PIZZA"), "Skateboarding Pizza");
  assert.equal(cleanName("sticker_nature_Volcano Mountain high contrat.svg", "Nature", "MOUNTAINS"), "Volcano Mountain");
  assert.equal(cleanName("sticker_toys and fun_Classic Teddy high congtrast.svg", "Toys & Fun", "TEDDY BEARS"), "Classic Teddy");
  assert.equal(cleanName("sticker_adventure and travel_Treasure Map Pirate light svg.svg", "Adventure and Travel", "Maps"), "Treasure Map Pirate");
});

test("cleanName preserves a legit trailing 'Lights' (not a variant)", () => {
  assert.equal(cleanName("sticker_holiday & celebration_Snowman With Lights_light.svg", "Holiday & Celebration", "Snowmen"), "Snowman With Lights");
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
