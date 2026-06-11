// @ts-nocheck
import { mutation } from "./_generated/server";
import stickers from "./stickerData/stickers.json";

const COIN_COST = { common: 50, uncommon: 100, rare: 200, legendary: 500 };

// Idempotent: skips a sticker that already exists (matched by name+subcategory).
export const seedStickersReal = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("stickers").collect();
    const seen = new Set(existing.map((s) => `${s.name}|${s.subcategory ?? ""}`));

    let inserted = 0, skipped = 0;
    for (const s of stickers) {
      const key = `${s.name}|${s.subcategory ?? ""}`;
      if (seen.has(key)) { skipped++; continue; }
      await ctx.db.insert("stickers", {
        name: s.name,
        category: s.category,
        subcategory: s.subcategory,
        rarity: s.rarity,
        imageThumbUrl: s.imageThumbUrl,
        imageFullUrl: s.imageFullUrl,
        description: s.description || undefined,
        coinCost: COIN_COST[s.rarity] ?? 50,
        isAnimated: false,
        isPaidOnly: false,
      });
      seen.add(key);
      inserted++;
    }
    return { inserted, skipped, total: stickers.length };
  },
});
