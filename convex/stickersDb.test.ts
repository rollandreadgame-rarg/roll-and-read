import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
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

describe("operator-only grants", () => {
  // (visibility.test.ts checks browsers can't reach these.)
  test("an operator can grant a sticker", async () => {
    const t = setup();
    const s = await seedSticker(t, "Cat");
    const a = await seedFamily(t, "user_a");
    await t.mutation(internal.stickersDb.grantSticker, { profileId: a.profileId, stickerId: s });
    expect(await owned(t, a.profileId)).toHaveLength(1);
  });

  // Regression: granting a sticker the reader already has used to add a
  // second row, so "collected N of 599" could count the same sticker twice.
  test("granting an owned sticker again does not duplicate it", async () => {
    const t = setup();
    const s = await seedSticker(t, "Cat");
    const a = await seedFamily(t, "user_a");
    const args = { profileId: a.profileId, stickerId: s };
    const first = await t.mutation(internal.stickersDb.grantSticker, args);
    const second = await t.mutation(internal.stickersDb.grantSticker, args);
    expect(second).toBe(first);
    expect(await owned(t, a.profileId)).toHaveLength(1);
  });

  test("a sticker id that doesn't exist is refused", async () => {
    const t = setup();
    const s = await seedSticker(t, "Gone");
    await t.run((ctx) => ctx.db.delete(s));
    const a = await seedFamily(t, "user_a");
    await expect(
      t.mutation(internal.stickersDb.grantSticker, { profileId: a.profileId, stickerId: s })
    ).rejects.toThrow("Sticker not found");
    expect(await owned(t, a.profileId)).toHaveLength(0);
  });

  // Regression: any signed-in owner could call the award functions as often
  // as they liked and fill the album for free. Claims now need a pick the
  // server issued for a finished board (see awards.test.ts).
  test("a reader can't collect stickers they haven't earned", async () => {
    const t = setup();
    for (let i = 0; i < 5; i++) await seedSticker(t, `S${i}`);
    const a = await seedFamily(t, "user_a", "free", { pendingRewards: [] });
    for (let i = 0; i < 5; i++) {
      await a.client
        .mutation(api.stickersDb.awardStickerFromCategory, {
          profileId: a.profileId,
          category: "animals",
          preferredRarity: "common",
        })
        .catch(() => {});
    }
    expect(await owned(t, a.profileId)).toHaveLength(0);
  });

  test("awardMilestoneSticker falls through tiers, never duplicates, then returns null", async () => {
    const t = setup();
    await seedSticker(t, "Cat", "common");
    await seedSticker(t, "Lion", "rare");
    const a = await seedFamily(t, "user_a");
    const award = () =>
      t.mutation(internal.stickersDb.awardMilestoneSticker, {
        profileId: a.profileId,
        preferredRarity: "rare",
      });
    expect((await award())?.name).toBe("Lion");
    expect((await award())?.name).toBe("Cat");
    expect(await award()).toBeNull();
    expect(await owned(t, a.profileId)).toHaveLength(2);
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
