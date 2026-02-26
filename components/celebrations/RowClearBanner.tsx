"use client";

import { motion, AnimatePresence } from "framer-motion";

interface RowClearBannerProps {
  show: boolean;
  wordsAdded: number;
  coinsEarned: number;
}

export default function RowClearBanner({ show, wordsAdded, coinsEarned }: RowClearBannerProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -100, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -100, opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", damping: 16, stiffness: 280 }}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div
            role="status"
            aria-live="polite"
            className="relative px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white font-bold whitespace-nowrap overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)",
              boxShadow: "0 8px 40px rgba(16,185,129,0.55), 0 2px 8px rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            {/* Shimmer sweep */}
            <span
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)",
                backgroundSize: "200% 100%",
                animation: "shimmer-sweep 1.8s linear infinite",
              }}
            />

            <motion.span
              animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.3, 1] }}
              transition={{ duration: 0.6, repeat: 2 }}
              className="text-xl relative z-10"
            >
              ⭐
            </motion.span>

            <span className="relative z-10">Row cleared!</span>

            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="opacity-90 relative z-10"
            >
              📚 {wordsAdded} words
            </motion.span>

            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="opacity-90 relative z-10"
            >
              💰 +{coinsEarned}
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
