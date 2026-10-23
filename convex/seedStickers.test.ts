// Covers both internal sticker seeds (seedStickers + seedStickersReal) and
// the shipped sticker catalog file.
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import stickers from "./stickerData/stickers.json";
import { setup } from "./test.helpers";

const RARITIES = ["common", "uncommon", "rare", "legendary"];

describe("stickers.json", () => {
  test("every sticker has a valid rarity, category and image URLs", () => {
    const bad = (stickers as Array<Record<string, unknown>>).filter(
      (s) =>
        !RARITIES.includes(String(s.rarity)) ||
        !s.category ||
        !s.name ||
        !String(s.imageThumbUrl ?? "").startsWith("http") ||
        !String(s.imageFullUrl ?? "").startsWith("http")
    );
    expect(bad).toEqual([]);
  });

  test("no duplicate name+subcategory (the seed's identity key)", () => {
    const keys = (stickers as Array<{ name: string; subcategory?: string }>).map(
      (s) => `${s.name}|${s.subcategory ?? ""}`
    );
    expect(keys.length - new Set(keys).size).toBe(0);
  });
});

describe("seeds are idempotent", () => {
  test("seedStickersReal", async () => {
    const t = setup();
    const first = await t.mutation(internal.seedStickersReal.seedStickersReal, {});
    expect(first.inserted).toBe(first.total);
    const second = await t.mutation(internal.seedStickersReal.seedStickersReal, {});
    expect(second).toMatchObject({ inserted: 0, skipped: first.total });
  });

  test("seedStickers (legacy emoji set)", async () => {
    const t = setup();
    const first = await t.mutation(internal.seedStickers.seedStickers, {});
    expect(first.inserted).toBeGreaterThan(0);
    const second = await t.mutation(internal.seedStickers.seedStickers, {});
    expect(second).toEqual({ inserted: 0, skipped: first.inserted });
  });
});
