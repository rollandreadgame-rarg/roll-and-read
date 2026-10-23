import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { as, seedFamily, seedSticker, seedUser, setup } from "./test.helpers";
import type { T } from "./test.helpers";

afterEach(() => vi.restoreAllMocks());

const owned = (t: T, id: Id<"profiles">) =>
  t.run((ctx) =>
    ctx.db.query("profile_stickers").withIndex("by_profile", (q) => q.eq("profileId", id)).collect()
  );

describe("reads", () => {
  test("the catalog is public; a reader's collection is owner-only", async () => {
    const t = setup();
    const s = await seedSticker(t, "Cat");
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    await t.run((ctx) =>
      ctx.db.insert("profile_stickers", { profileId: a.profileId, stickerId: s, earnedAt: 1 })
    );
    expect(await t.query(api.stickersDb.getAll, {})).toHaveLength(1);
    expect(await t.query(api.stickersDb.getForProfile, { profileId: a.profileId })).toEqual([]);
    expect(
      await as(t, "user_b").query(api.stickersDb.getForProfile, { profileId: a.profileId })
    ).toEqual([]);
    expect(
      await a.client.query(api.stickersDb.getForProfile, { profileId: a.profileId })
    ).toHaveLength(1);
  });
});

describe("grantSticker", () => {
  test("refuses other families and anonymous callers", async () => {
    const t = setup();
    const s = await seedSticker(t, "Cat");
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    await expect(
      as(t, "user_b").mutation(api.stickersDb.grantSticker, { profileId: a.profileId, stickerId: s })
    ).rejects.toThrow("Forbidden");
    await expect(
      t.mutation(api.stickersDb.grantSticker, { profileId: a.profileId, stickerId: s })
    ).rejects.toThrow("Not authenticated");
    expect(await owned(t, a.profileId)).toHaveLength(0);
  });

  // Regression: granting a sticker the reader already has used to add a
  // second row, so "collected N of 599" could count the same sticker twice.
  test("granting an owned sticker again does not duplicate it", async () => {
    const t = setup();
    const s = await seedSticker(t, "Cat");
    const a = await seedFamily(t, "user_a");
    const first = await a.client.mutation(api.stickersDb.grantSticker, {
      profileId: a.profileId,
      stickerId: s,
    });
    const second = await a.client.mutation(api.stickersDb.grantSticker, {
      profileId: a.profileId,
      stickerId: s,
    });
    expect(second).toBe(first);
    expect(await owned(t, a.profileId)).toHaveLength(1);
  });

  test("a sticker id that doesn't exist is refused", async () => {
    const t = setup();
    const s = await seedSticker(t, "Gone");
    await t.run((ctx) => ctx.db.delete(s));
    const a = await seedFamily(t, "user_a");
    await expect(
      a.client.mutation(api.stickersDb.grantSticker, { profileId: a.profileId, stickerId: s })
    ).rejects.toThrow("Sticker not found");
    expect(await owned(t, a.profileId)).toHaveLength(0);
  });

  // NOT FIXED (design): sticker rewards are decided in the browser. Any
  // signed-in owner can call grantSticker / awardMilestoneSticker /
  // awardStickerFromCategory as often as they like and fill the album for
  // free. The server has no record of which milestones were earned. Low
  // stakes (own child's album, no money), but it bypasses the shop economy.
  test.fails("a reader can't collect stickers they haven't earned", async () => {
    const t = setup();
    for (let i = 0; i < 5; i++) await seedSticker(t, `S${i}`);
    const a = await seedFamily(t, "user_a");
    for (let i = 0; i < 5; i++) {
      await a.client
        .mutation(api.stickersDb.awardMilestoneSticker, {
          profileId: a.profileId,
          preferredRarity: "common",
        })
        .catch(() => {});
    }
    expect((await owned(t, a.profileId)).length).toBeLessThanOrEqual(1);
  });
});

describe("awardMilestoneSticker", () => {
  test("grants an unowned sticker of the preferred rarity", async () => {
    const t = setup();
    const owl = await seedSticker(t, "Owl", "uncommon");
    await seedSticker(t, "Cat", "common");
    await seedSticker(t, "Lion", "rare");
    const a = await seedFamily(t, "user_a");
    const picked = await a.client.mutation(api.stickersDb.awardMilestoneSticker, {
      profileId: a.profileId,
      preferredRarity: "uncommon",
    });
    expect(picked?._id).toBe(owl);
  });

  test("falls through tiers, never duplicates, then returns null", async () => {
    const t = setup();
    await seedSticker(t, "Cat", "common");
    await seedSticker(t, "Lion", "rare");
    const a = await seedFamily(t, "user_a");
    const award = () =>
      a.client.mutation(api.stickersDb.awardMilestoneSticker, {
        profileId: a.profileId,
        preferredRarity: "rare",
      });
    expect((await award())?.name).toBe("Lion");
    expect((await award())?.name).toBe("Cat");
    expect(await award()).toBeNull();
    expect(await owned(t, a.profileId)).toHaveLength(2);
  });

  test("other families are refused", async () => {
    const t = setup();
    await seedSticker(t, "Cat");
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    await expect(
      as(t, "user_b").mutation(api.stickersDb.awardMilestoneSticker, {
        profileId: a.profileId,
        preferredRarity: "common",
      })
    ).rejects.toThrow("Forbidden");
  });
});

describe("awardStickerFromCategory", () => {
  test("only picks from the chosen category, preferring the rarity", async () => {
    const t = setup();
    await seedSticker(t, "Cat", "common", "animals");
    const lion = await seedSticker(t, "Lion", "rare", "animals");
    await seedSticker(t, "Galaxy", "rare", "space");
    const a = await seedFamily(t, "user_a");
    const picked = await a.client.mutation(api.stickersDb.awardStickerFromCategory, {
      profileId: a.profileId,
      category: "animals",
      preferredRarity: "rare",
    });
    expect(picked?._id).toBe(lion);
  });

  test("returns null once the category is complete, without duplicates", async () => {
    const t = setup();
    await seedSticker(t, "Cat", "common", "animals");
    await seedSticker(t, "Galaxy", "rare", "space");
    const a = await seedFamily(t, "user_a");
    const award = () =>
      a.client.mutation(api.stickersDb.awardStickerFromCategory, {
        profileId: a.profileId,
        category: "animals",
        preferredRarity: "legendary",
      });
    expect((await award())?.name).toBe("Cat");
    expect(await award()).toBeNull();
    expect(
      await a.client.mutation(api.stickersDb.awardStickerFromCategory, {
        profileId: a.profileId,
        category: "no-such-category",
        preferredRarity: "common",
      })
    ).toBeNull();
    expect(await owned(t, a.profileId)).toHaveLength(1);
  });

  test("other families are refused", async () => {
    const t = setup();
    await seedSticker(t, "Cat");
    const a = await seedFamily(t, "user_a");
    await seedUser(t, "user_b");
    await expect(
      as(t, "user_b").mutation(api.stickersDb.awardStickerFromCategory, {
        profileId: a.profileId,
        category: "animals",
        preferredRarity: "common",
      })
    ).rejects.toThrow("Forbidden");
    expect(await owned(t, a.profileId)).toHaveLength(0);
  });
});
