import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { as, seedFamily, seedSticker, seedUser, setup } from "./test.helpers";
import type { T } from "./test.helpers";

afterEach(() => vi.restoreAllMocks());

const coins = async (t: T, id: Id<"profiles">) => (await t.run((ctx) => ctx.db.get(id)))?.coins;
const owned = (t: T, id: Id<"profiles">) =>
  t.run((ctx) =>
    ctx.db.query("profile_stickers").withIndex("by_profile", (q) => q.eq("profileId", id)).collect()
  );

async function catalog(t: T) {
  for (const [name, rarity, category] of [
    ["Cat", "common", "animals"],
    ["Dog", "common", "animals"],
    ["Owl", "uncommon", "animals"],
    ["Lion", "rare", "animals"],
    ["Koala", "legendary", "animals"],
    ["Rocket", "common", "space"],
    ["Alien", "uncommon", "space"],
    ["Galaxy", "rare", "space"],
    ["Black Hole", "legendary", "space"],
  ] as const) {
    await seedSticker(t, name, rarity, category);
  }
}

describe("openPack", () => {
  test("basic pack costs 50 and grants one sticker", async () => {
    const t = setup();
    await catalog(t);
    const a = await seedFamily(t, "user_a", "free", { coins: 120 });
    const r = await a.client.mutation(api.shop.openPack, { profileId: a.profileId, packId: "basic" });
    expect(r.revealed).toHaveLength(1);
    expect(r.coinsRemaining).toBe(70);
    expect(await coins(t, a.profileId)).toBe(70);
    expect(await owned(t, a.profileId)).toHaveLength(1);
  });

  test("premium pack costs 500 and reveals 5", async () => {
    const t = setup();
    await catalog(t);
    const a = await seedFamily(t, "user_a", "free", { coins: 500 });
    const r = await a.client.mutation(api.shop.openPack, {
      profileId: a.profileId,
      packId: "premium",
    });
    expect(r.revealed).toHaveLength(5);
    expect(await coins(t, a.profileId)).toBe(0);
  });

  test("themed pack needs a category and only gives stickers from it", async () => {
    const t = setup();
    await catalog(t);
    const a = await seedFamily(t, "user_a", "free", { coins: 1000 });
    await expect(
      a.client.mutation(api.shop.openPack, { profileId: a.profileId, packId: "themed" })
    ).rejects.toThrow("Category required");
    expect(await coins(t, a.profileId)).toBe(1000);

    const r = await a.client.mutation(api.shop.openPack, {
      profileId: a.profileId,
      packId: "themed",
      category: "space",
    });
    expect(r.revealed).toHaveLength(3);
    expect(r.revealed.every((s) => ["Rocket", "Alien", "Galaxy", "Black Hole"].includes(s.name))).toBe(
      true
    );
    expect(await coins(t, a.profileId)).toBe(850);
  });

  test("not enough coins: nothing is charged or granted", async () => {
    const t = setup();
    await catalog(t);
    const a = await seedFamily(t, "user_a", "free", { coins: 49 });
    await expect(
      a.client.mutation(api.shop.openPack, { profileId: a.profileId, packId: "basic" })
    ).rejects.toThrow("INSUFFICIENT_COINS");
    expect(await coins(t, a.profileId)).toBe(49);
    expect(await owned(t, a.profileId)).toHaveLength(0);
  });

  test("buying twice charges twice, then stops at zero", async () => {
    const t = setup();
    await catalog(t);
    const a = await seedFamily(t, "user_a", "free", { coins: 100 });
    await a.client.mutation(api.shop.openPack, { profileId: a.profileId, packId: "basic" });
    await a.client.mutation(api.shop.openPack, { profileId: a.profileId, packId: "basic" });
    expect(await coins(t, a.profileId)).toBe(0);
    await expect(
      a.client.mutation(api.shop.openPack, { profileId: a.profileId, packId: "basic" })
    ).rejects.toThrow("INSUFFICIENT_COINS");
  });

  test("a sticker you already own is not stored twice", async () => {
    const t = setup();
    await seedSticker(t, "Only One");
    const a = await seedFamily(t, "user_a", "free", { coins: 500 });
    const r = await a.client.mutation(api.shop.openPack, {
      profileId: a.profileId,
      packId: "premium",
    });
    expect(r.revealed).toHaveLength(5);
    expect(await owned(t, a.profileId)).toHaveLength(1);
  });

  test("prefers stickers the reader doesn't have yet", async () => {
    const t = setup();
    // Two of every rarity: whatever rarity is rolled, an unowned one exists.
    for (const rarity of ["common", "uncommon", "rare", "legendary"] as const) {
      await seedSticker(t, `${rarity}-1`, rarity);
      await seedSticker(t, `${rarity}-2`, rarity);
    }
    const a = await seedFamily(t, "user_a", "free", { coins: 100 });
    for (let run = 0; run < 10; run++) {
      await t.run((ctx) => ctx.db.patch(a.profileId, { coins: 100 }));
      for (const ps of await owned(t, a.profileId)) await t.run((ctx) => ctx.db.delete(ps._id));
      await a.client.mutation(api.shop.openPack, { profileId: a.profileId, packId: "basic" });
      await a.client.mutation(api.shop.openPack, { profileId: a.profileId, packId: "basic" });
      // The second pack always finds an unowned sticker of whatever rarity it rolls.
      expect(await owned(t, a.profileId)).toHaveLength(2);
    }
  });

  test("the client can't set the price or invent a pack", async () => {
    const t = setup();
    await catalog(t);
    const a = await seedFamily(t, "user_a", "free", { coins: 10 });
    await expect(
      a.client.mutation(api.shop.openPack, {
        profileId: a.profileId,
        packId: "premium",
        // @ts-expect-error not an accepted field
        cost: 0,
      })
    ).rejects.toThrow();
    await expect(
      a.client.mutation(api.shop.openPack, {
        profileId: a.profileId,
        // @ts-expect-error not a real pack
        packId: "free",
      })
    ).rejects.toThrow();
    expect(await coins(t, a.profileId)).toBe(10);
    expect(await owned(t, a.profileId)).toHaveLength(0);
  });

  test("can't spend another family's coins or buy for them", async () => {
    const t = setup();
    await catalog(t);
    const a = await seedFamily(t, "user_a", "free", { coins: 500 });
    await seedUser(t, "user_b");
    await expect(
      as(t, "user_b").mutation(api.shop.openPack, { profileId: a.profileId, packId: "premium" })
    ).rejects.toThrow("Forbidden");
    await expect(
      t.mutation(api.shop.openPack, { profileId: a.profileId, packId: "premium" })
    ).rejects.toThrow("Not authenticated");
    expect(await coins(t, a.profileId)).toBe(500);
    expect(await owned(t, a.profileId)).toHaveLength(0);
  });

  // Regression: with an empty catalog the loop granted nothing but the coins
  // were still taken.
  test("never charges when there is nothing to give", async () => {
    const t = setup();
    const a = await seedFamily(t, "user_a", "free", { coins: 500 });
    await expect(
      a.client.mutation(api.shop.openPack, { profileId: a.profileId, packId: "basic" })
    ).rejects.toThrow();
    expect(await coins(t, a.profileId)).toBe(500);
  });
});
