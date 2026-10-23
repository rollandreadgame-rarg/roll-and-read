import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import { cleanStickerName } from "./adminStickers";
import { seedFamily, seedSticker, setup } from "./test.helpers";

describe("cleanStickerName", () => {
  test.each([
    ["Adventure And Travel_classic Soccer Ball Kick", undefined, "Classic Soccer Ball Kick"],
    ["Sunny Day_light", undefined, "Sunny Day (Light)"],
    ["With Fish", "CAT", "Cat With Fish"],
    ["With Fish", "DOG", "With Fish"],
    ["Cat With Fish", "CAT", "Cat With Fish"],
    ["rocket", undefined, "Rocket"],
    ["", undefined, ""],
  ])("%j (%s) → %j", (name, sub, expected) => {
    expect(cleanStickerName(name, sub)).toBe(expected);
  });

  test("is idempotent", () => {
    for (const [n, s] of [
      ["Adventure And Travel_x_light", undefined],
      ["With Yarn", "CAT"],
    ] as const) {
      const once = cleanStickerName(n, s);
      expect(cleanStickerName(once, s)).toBe(once);
    }
  });
});

describe("internal sticker maintenance", () => {
  test("removeLegacyStickers deletes image-less stickers and the copies readers own", async () => {
    const t = setup();
    const art = await seedSticker(t, "Real Art");
    const legacy = await t.run((ctx) =>
      ctx.db.insert("stickers", {
        name: "Emoji Cat",
        category: "animals",
        rarity: "common",
        emoji: "🐱",
        coinCost: 50,
        isAnimated: false,
        isPaidOnly: false,
      })
    );
    const a = await seedFamily(t, "user_a");
    await t.run(async (ctx) => {
      await ctx.db.insert("profile_stickers", { profileId: a.profileId, stickerId: art, earnedAt: 1 });
      await ctx.db.insert("profile_stickers", { profileId: a.profileId, stickerId: legacy, earnedAt: 1 });
    });
    const r = await t.mutation(internal.adminStickers.removeLegacyStickers, {});
    expect(r).toEqual({ removedStickers: 1, removedOwned: 1 });
    const left = await t.run(async (ctx) => ({
      stickers: (await ctx.db.query("stickers").collect()).map((s) => s._id),
      owned: (await ctx.db.query("profile_stickers").collect()).map((s) => s.stickerId),
    }));
    expect(left).toEqual({ stickers: [art], owned: [art] });
  });

  test("cleanStickerNames renames once", async () => {
    const t = setup();
    await seedSticker(t, "Adventure And Travel_kite");
    const first = await t.mutation(internal.adminStickers.cleanStickerNames, {});
    expect(first.count).toBe(1);
    const second = await t.mutation(internal.adminStickers.cleanStickerNames, {});
    expect(second.count).toBe(0);
  });
});
