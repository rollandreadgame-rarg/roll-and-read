// components/celebrations/StickerReveal.tsx
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { playSound } from "@/lib/audio/soundManager";
import { revealStyle, type RevealStyle } from "@/lib/stickers/revealConfig";
import StickerImage from "@/components/stickers/StickerImage";

interface Props {
  sticker: any;            // granted sticker (or { name, rarity, imageFullUrl:null } when all-collected)
  remaining: number;       // rewards left including this one
  reducedMotion: boolean;
  onNext: () => void;
}

// opaque-ifies an "rgba(...,a)" glow string for the solid border color.
const solid = (rgba: string) => rgba.replace(/[\d.]+\)$/, "1)");

// Two beats: (1) anticipation build, (2) the sticker pops in with rarity-tiered
// confetti + glow, then the name/badge and Next button rise up.
export default function StickerReveal({ sticker, remaining, reducedMotion, onNext }: Props) {
  const style: RevealStyle = revealStyle(sticker?.rarity);
  const [popped, setPopped] = useState(false);

  useEffect(() => {
    const build = reducedMotion ? 0 : style.buildMs;
    if (build > 0) playSound("revealBuild");
    const t = setTimeout(() => {
      setPopped(true);
      playSound(style.sound);
      if (!reducedMotion && style.confetti > 0) {
        confetti({
          particleCount: style.confetti,
          spread: style.rays ? 110 : 75,
          startVelocity: style.rays ? 55 : 40,
          origin: { y: 0.45 },
          colors: style.colors,
          scalar: style.rays ? 1.2 : 1,
        });
      }
    }, build);
    return () => clearTimeout(t);
    // sticker identity drives a fresh reveal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sticker]);

  return (
    <div className="text-center">
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-extrabold mb-5"
        style={{ color: "var(--color-accent-gold)" }}
      >
        ✨ You got! ✨
      </motion.h2>

      <div className="relative mx-auto" style={{ width: 220, height: 220 }}>
        {/* Legendary rays */}
        {style.rays && popped && !reducedMotion && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
            animate={{ opacity: 0.7, scale: 1, rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, rgba(245,158,11,0.25) 20deg, transparent 40deg, rgba(245,158,11,0.25) 60deg, transparent 80deg, rgba(245,158,11,0.25) 100deg, transparent 120deg, rgba(245,158,11,0.25) 140deg, transparent 160deg, rgba(245,158,11,0.25) 180deg, transparent 200deg)",
              borderRadius: "50%",
            }}
          />
        )}
        <motion.div
          initial={{ scale: 0, rotate: -25, opacity: 0 }}
          animate={popped ? { scale: 1, rotate: 0, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={reducedMotion
            ? { duration: 0.2 }
            : { type: "spring", damping: 11, stiffness: 200 }}
          className="absolute inset-0 flex items-center justify-center rounded-3xl p-3"
          style={{
            border: `3px solid ${solid(style.glow)}`,
            boxShadow: `0 0 40px ${style.glow}`,
            background: "rgba(255,255,255,0.05)",
          }}
        >
          <StickerImage src={sticker?.imageFullUrl} emoji={sticker?.emoji} alt={sticker?.name || "sticker"} sizePx={200} />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={popped ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.15 }}
      >
        <div className="mt-4 font-extrabold text-xl" style={{ color: "var(--color-text-primary)" }}>
          {sticker?.name}
        </div>
        <div className="text-sm font-bold capitalize mb-6" style={{ color: solid(style.glow) }}>
          {sticker?.rarity}
        </div>
        <button
          onClick={onNext}
          className="w-full py-4 rounded-2xl font-extrabold text-white text-lg"
          style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-secondary))" }}
        >
          {remaining > 1 ? "Next 🎁" : "Done!"}
        </button>
      </motion.div>
    </div>
  );
}
