// @ts-nocheck
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireProfileOwner } from "./authHelpers";

// Server-authoritative pack definitions. Cost/count/odds live here — never
// trust the client for price or contents. A single mutation spends coins and
// grants stickers transactionally, so a failure mid-grant rolls back the spend.
const PACKS = {
  basic: { cost: 50, count: 1, premium: false, themed: false },
  themed: { cost: 150, count: 3, premium: false, themed: true },
  premium: { cost: 500, count: 5, premium: true, themed: false },
};

function rollRarity(premium) {
  const r = Math.random();
  if (premium) {
    if (r < 0.4) return "common";
    if (r < 0.75) return "uncommon";
    if (r < 0.95) return "rare";
    return "legendary";
  }
  if (r < 0.6) return "common";
  if (r < 0.85) return "uncommon";
  if (r < 0.97) return "rare";
  return "legendary";
}

export const openPack = mutation({
  args: {
    profileId: v.id("profiles"),
    packId: v.union(
      v.literal("basic"),
      v.literal("themed"),
      v.literal("premium")
    ),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireProfileOwner(ctx, args.profileId);

    const pack = PACKS[args.packId];
    if (!pack) throw new Error("Unknown pack");
    if (pack.themed && !args.category) throw new Error("Category required");
    if (profile.coins < pack.cost) throw new Error("INSUFFICIENT_COINS");

    const allStickers = await ctx.db.query("stickers").collect();
    const owned = await ctx.db
      .query("profile_stickers")
      .withIndex("by_profile", (q) => q.eq("profileId", args.profileId))
      .collect();
    const held = new Set(owned.map((ps) => String(ps.stickerId)));

    const revealed = [];
    for (let i = 0; i < pack.count; i++) {
      const rarity = rollRarity(pack.premium);
      const inCategory = (s) =>
        pack.themed ? s.category === args.category : true;

      // Prefer an unowned sticker of the rolled rarity; fall back to any of
      // that rarity, then any eligible sticker so a pack never no-ops.
      let eligible = allStickers.filter(
        (s) => s.rarity === rarity && inCategory(s) && !held.has(String(s._id))
      );
      if (eligible.length === 0) {
        eligible = allStickers.filter((s) => s.rarity === rarity && inCategory(s));
      }
      if (eligible.length === 0) {
        eligible = allStickers.filter(inCategory);
      }
      if (eligible.length === 0) eligible = allStickers;
      if (eligible.length === 0) break;

      const picked = eligible[Math.floor(Math.random() * eligible.length)];
      revealed.push({
        name: picked.name,
        emoji: picked.emoji,
        imageFullUrl: picked.imageFullUrl,
        rarity: picked.rarity,
      });

      if (!held.has(String(picked._id))) {
        await ctx.db.insert("profile_stickers", {
          profileId: args.profileId,
          stickerId: picked._id,
          earnedAt: Date.now(),
        });
        held.add(String(picked._id));
      }
    }

    await ctx.db.patch(args.profileId, { coins: profile.coins - pack.cost });

    return { revealed, coinsRemaining: profile.coins - pack.cost };
  },
});
