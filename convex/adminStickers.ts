// @ts-nocheck
import { internalMutation } from "./_generated/server";

// Delete the legacy emoji stickers (those with no image) and any profile_stickers
// pointing at them. Run AFTER the UI reads the real catalog, so there is never a
// window where the pages reference deleted data. DEV/pre-launch use.
export const removeLegacyStickers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("stickers").collect();
    const legacy = all.filter((s) => !s.imageThumbUrl);
    const legacyIds = new Set(legacy.map((s) => String(s._id)));

    let removedOwned = 0;
    for (const ps of await ctx.db.query("profile_stickers").collect()) {
      if (legacyIds.has(String(ps.stickerId))) { await ctx.db.delete(ps._id); removedOwned++; }
    }
    for (const s of legacy) await ctx.db.delete(s._id);
    return { removedStickers: legacy.length, removedOwned };
  },
});

// Clean sticker names that leaked import artifacts into the UI: a folder prefix
// ("Adventure And Travel_classic Soccer Ball Kick"), a "_light" variant suffix,
// and cat stickers named only by their accessory ("With Fish"). Idempotent —
// mirrors the same cleanup applied to stickerData/stickers.json.
export function cleanStickerName(name, subcategory) {
  let n = name.replace(/^Adventure And Travel_/, "").replace(/_light$/, " (Light)");
  n = n.charAt(0).toUpperCase() + n.slice(1);
  if (subcategory === "CAT" && /^With /.test(n)) n = `Cat ${n}`;
  return n;
}

export const cleanStickerNames = internalMutation({
  args: {},
  handler: async (ctx) => {
    const renamed = [];
    for (const s of await ctx.db.query("stickers").collect()) {
      const clean = cleanStickerName(s.name, s.subcategory);
      if (clean !== s.name) {
        await ctx.db.patch(s._id, { name: clean });
        renamed.push(`${s.name} -> ${clean}`);
      }
    }
    return { count: renamed.length, renamed };
  },
});
