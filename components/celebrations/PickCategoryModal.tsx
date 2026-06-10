// components/celebrations/PickCategoryModal.tsx
"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { pickRewardTrio } from "@/lib/stickers/packConfig";
import { categoryMeta } from "@/lib/stickers/categories";
import StickerImage from "@/components/stickers/StickerImage";

interface Reward { rarity: "common" | "uncommon" | "rare" | "legendary"; label: string }
interface Props {
  show: boolean;
  profileId: string | null;
  reward: Reward | null;             // the current reward to claim
  remaining: number;                 // how many rewards are left including this one
  allStickers: any[] | undefined;    // api.stickersDb.getAll
  ownedStickerIds: Set<string>;      // current profile's owned ids
  onClaimed: () => void;             // advance the queue
}

const RARITY_COLORS: Record<string, string> = {
  common: "#6B7280", uncommon: "#3B82F6", rare: "#A855F7", legendary: "#F59E0B",
};

export default function PickCategoryModal({
  show, profileId, reward, remaining, allStickers, ownedStickerIds, onClaimed,
}: Props) {
  const award = useMutation(api.stickersDb.awardStickerFromCategory);
  const [revealed, setRevealed] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  // Build the trio once per reward. A representative image per category = the
  // first sticker in that category (owned-agnostic).
  const trio = useMemo(() => {
    if (!allStickers || !reward) return [];
    const byCat: Record<string, { unowned: number; sample?: any }> = {};
    for (const s of allStickers) {
      if (!s.imageThumbUrl) continue; // skip any legacy emoji rows
      const c = byCat[s.category] || (byCat[s.category] = { unowned: 0 });
      if (!ownedStickerIds.has(s._id)) c.unowned++;
      if (!c.sample) c.sample = s;
    }
    const cats = pickRewardTrio(byCat);
    return cats.map((c: string) => ({ category: c, ...categoryMeta(c), sample: byCat[c]?.sample }));
    // reward identity is enough to re-roll between sequential rewards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStickers, reward, show]);

  const handlePick = async (category: string) => {
    if (!profileId || busy) return;
    setBusy(true);
    const granted = await award({
      profileId: profileId as Id<"profiles">,
      category,
      preferredRarity: reward!.rarity,
    });
    setRevealed(granted ?? { name: "All collected!", rarity: reward!.rarity, imageFullUrl: null });
    setBusy(false);
  };

  const handleNext = () => {
    setRevealed(null);
    onClaimed();
  };

  return (
    <AnimatePresence>
      {show && reward && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", damping: 16, stiffness: 220 }}
            role="dialog" aria-modal="true" aria-label="Pick a sticker pack"
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <div
              className="relative w-full max-w-sm rounded-3xl p-7 text-center"
              style={{
                background: "linear-gradient(160deg, var(--color-bg-surface) 0%, rgba(30,41,59,0.95) 100%)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              }}
            >
              {!revealed ? (
                <>
                  <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--color-accent-gold)" }}>
                    {reward.label}
                  </div>
                  <h2 className="text-2xl font-extrabold mb-1 text-balance" style={{ color: "var(--color-text-primary)" }}>
                    🎉 Pick a pack!
                  </h2>
                  {remaining > 1 && (
                    <div className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
                      {remaining} rewards to pick
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {trio.map((c: any) => (
                      <motion.button
                        key={c.category}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        disabled={busy}
                        onClick={() => handlePick(c.category)}
                        className="rounded-2xl p-3 flex flex-col items-center gap-2"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                        aria-label={`Pick ${c.label}`}
                      >
                        <div className="w-14 h-14">
                          <StickerImage src={c.sample?.imageThumbUrl} emoji={c.icon} alt={c.label} />
                        </div>
                        <div className="text-[11px] font-bold leading-tight" style={{ color: "var(--color-text-primary)" }}>
                          {c.label}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-extrabold mb-4" style={{ color: "var(--color-accent-gold)" }}>
                    ✨ You got!
                  </h2>
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 12 }}
                    className="w-32 h-32 mx-auto rounded-3xl flex items-center justify-center p-2"
                    style={{
                      border: `3px solid ${RARITY_COLORS[revealed.rarity] ?? "#6B7280"}`,
                      boxShadow: `0 0 28px ${RARITY_COLORS[revealed.rarity] ?? "#6B7280"}66`,
                      background: "rgba(255,255,255,0.05)",
                    }}
                  >
                    <StickerImage src={revealed.imageFullUrl} emoji={revealed.emoji} alt={revealed.name} sizePx={128} />
                  </motion.div>
                  <div className="mt-3 font-extrabold text-lg" style={{ color: "var(--color-text-primary)" }}>
                    {revealed.name}
                  </div>
                  <div className="text-sm font-semibold capitalize mb-5" style={{ color: RARITY_COLORS[revealed.rarity] }}>
                    {revealed.rarity}
                  </div>
                  <button
                    onClick={handleNext}
                    className="w-full py-3 rounded-2xl font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-secondary))" }}
                  >
                    {remaining > 1 ? "Next 🎁" : "Done!"}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
