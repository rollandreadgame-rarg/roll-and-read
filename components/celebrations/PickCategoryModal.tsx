// components/celebrations/PickCategoryModal.tsx
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { pickRewardTrio } from "@/lib/stickers/packConfig";
import { categoryMeta } from "@/lib/stickers/categories";
import { playSound } from "@/lib/audio/soundManager";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import StickerImage from "@/components/stickers/StickerImage";
import StickerReveal from "@/components/celebrations/StickerReveal";

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

export default function PickCategoryModal({
  show, profileId, reward, remaining, allStickers, ownedStickerIds, onClaimed,
}: Props) {
  const award = useMutation(api.stickersDb.awardStickerFromCategory);
  const [revealed, setRevealed] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  // Whoosh the packs in whenever a fresh pick screen appears.
  useEffect(() => {
    if (show && !revealed) playSound("packAppear");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, reward]);

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
    playSound("packPick");
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
              className="relative w-full max-w-lg rounded-[28px] p-8 text-center"
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
                  <h2 className="text-3xl font-extrabold mb-1 text-balance" style={{ color: "var(--color-text-primary)" }}>
                    🎉 Pick a pack!
                  </h2>
                  {remaining > 1 && (
                    <div className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
                      {remaining} rewards to pick
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    {trio.map((c: any, i: number) => (
                      <motion.button
                        key={c.category}
                        initial={{ opacity: 0, y: 24, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={reducedMotion
                          ? { duration: 0.15 }
                          : { type: "spring", damping: 14, stiffness: 260, delay: 0.12 + i * 0.09 }}
                        whileHover={{ scale: 1.06, y: -4 }}
                        whileTap={{ scale: 0.94 }}
                        disabled={busy}
                        onClick={() => handlePick(c.category)}
                        className="rounded-3xl p-4 flex flex-col items-center gap-2"
                        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)" }}
                        aria-label={`Pick ${c.label}`}
                      >
                        <motion.div
                          className="w-20 h-20"
                          animate={reducedMotion ? {} : { y: [0, -5, 0] }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
                        >
                          <StickerImage src={c.sample?.imageThumbUrl} emoji={c.icon} alt={c.label} sizePx={80} />
                        </motion.div>
                        <div className="text-sm font-bold leading-tight" style={{ color: "var(--color-text-primary)" }}>
                          {c.label}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </>
              ) : (
                <StickerReveal
                  sticker={revealed}
                  remaining={remaining}
                  reducedMotion={reducedMotion}
                  onNext={handleNext}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
