import { describe, expect, test } from "vitest";
import { CATEGORIES, CATEGORY_KEYS, categoryMeta } from "./categories";
import { CATEGORY_LEAN, pickRewardTrio } from "./packConfig";
import { revealStyle } from "./revealConfig";

describe("sticker categories", () => {
  test("pack-config leans cover exactly the catalog categories (no drift between files)", () => {
    expect(Object.keys(CATEGORY_LEAN).sort()).toEqual([...CATEGORY_KEYS].sort());
  });

  test("category keys and labels are unique and have an icon", () => {
    expect(new Set(CATEGORY_KEYS).size).toBe(CATEGORIES.length);
    expect(new Set(CATEGORIES.map((c) => c.label)).size).toBe(CATEGORIES.length);
    for (const c of CATEGORIES) expect(c.icon.length).toBeGreaterThan(0);
  });

  test("categoryMeta falls back gracefully for an unknown key", () => {
    expect(categoryMeta("Animals")).toMatchObject({ label: "Animals" });
    expect(categoryMeta("Brand New")).toEqual({ key: "Brand New", label: "Brand New", icon: "✨" });
  });
});

describe("pickRewardTrio edges", () => {
  const all = Object.keys(CATEGORY_LEAN);

  test.each([0, 0.5, 0.999999999, 1])("rng=%f still returns three real, distinct categories", (r) => {
    const trio = pickRewardTrio({}, () => r);
    expect(trio).toHaveLength(3);
    expect(new Set(trio).size).toBe(3);
    for (const c of trio) expect(all).toContain(c);
  });

  test("one per lean, in boy/girl/neutral order", () => {
    const trio = pickRewardTrio({}, () => 0);
    expect(trio.map((c: string) => CATEGORY_LEAN[c as keyof typeof CATEGORY_LEAN])).toEqual(["boy", "girl", "neutral"]);
  });

  test("a fully-owned collection still offers three choices", () => {
    const stats = Object.fromEntries(all.map((c) => [c, { unowned: 0 }]));
    for (let i = 0; i < 20; i++) expect(pickRewardTrio(stats, () => i / 20)).toHaveLength(3);
  });

  test("unknown categories in stats are ignored", () => {
    const trio = pickRewardTrio({ "Not A Category": { unowned: 99 } }, () => 0.3);
    for (const c of trio) expect(all).toContain(c);
  });

  test("the only unowned category in a lean is always offered", () => {
    const stats = { Vehicles: { unowned: 0 }, "Sports & Games": { unowned: 0 }, "Adventure and Travel": { unowned: 4 } };
    for (let i = 0; i < 10; i++) expect(pickRewardTrio(stats, () => i / 10)[0]).toBe("Adventure and Travel");
  });
});

describe("revealStyle edges", () => {
  test("never returns undefined for odd input", () => {
    for (const r of ["", "COMMON", "epic", undefined, null]) {
      const s = revealStyle(r as unknown as string);
      expect(s).toBeDefined();
      expect(typeof s.buildMs).toBe("number");
    }
  });

  test("every sound key is a real SFX name in the sound manager", () => {
    const known = ["revealCommon", "revealRare", "revealLegendary"];
    for (const r of ["common", "uncommon", "rare", "legendary"]) expect(known).toContain(revealStyle(r).sound);
  });
});
