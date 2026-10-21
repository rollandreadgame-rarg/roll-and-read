"use client";

import { motion, AnimatePresence } from "framer-motion";

interface RowClearBannerProps {
  show: boolean;
  wordsAdded: number;
  coinsEarned: number;
}

// Mint "correct card" colours, the same in every theme so the dark green ink
// always reads clearly (≈10:1).
const MINT = "var(--card-correct)";
const MINT_INK = "#0F3D25";

export default function RowClearBanner({ show, wordsAdded, coinsEarned }: RowClearBannerProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -100, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -100, opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", damping: 16, stiffness: 280 }}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none max-w-[calc(100vw-32px)]"
        >
          <div
            role="status"
            aria-live="polite"
            className="relative px-4 sm:px-6 py-3 rounded-2xl flex items-center gap-2 sm:gap-3 font-bold whitespace-nowrap overflow-hidden"
            style={{
              background: MINT,
              color: MINT_INK,
              border: "2px solid var(--color-success)",
              boxShadow:
                "0 4px 0 color-mix(in srgb, var(--color-success) 60%, white), 0 14px 36px -10px color-mix(in srgb, var(--color-success) 70%, transparent)",
            }}
          >
            {/* Shimmer sweep */}
            <span
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.55) 50%, transparent 60%)",
                backgroundSize: "200% 100%",
                animation: "shimmer-sweep 1.8s linear infinite",
              }}
            />

            <motion.span
              animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.3, 1] }}
              transition={{ duration: 0.6, repeat: 2 }}
              className="text-xl relative z-10"
              aria-hidden="true"
            >
              ⭐
            </motion.span>

            <span className="relative z-10 text-base sm:text-lg font-extrabold">Row cleared!</span>

            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="relative z-10"
            >
              📚 {wordsAdded} words
            </motion.span>

            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="relative z-10"
            >
              💰 +{coinsEarned}
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
