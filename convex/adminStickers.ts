// @ts-nocheck
import { mutation } from "./_generated/server";

// Delete the legacy emoji stickers (those with no image) and any profile_stickers
// pointing at them. Run AFTER the UI reads the real catalog, so there is never a
// window where the pages reference deleted data. DEV/pre-launch use.
export const removeLegacyStickers = mutation({
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
