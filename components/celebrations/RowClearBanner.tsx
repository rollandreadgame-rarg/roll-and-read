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
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", damping: 18, stiffness: 250 }}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div
            className="px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white font-bold whitespace-nowrap"
            style={{
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
              boxShadow: "0 8px 32px rgba(16,185,129,0.4)",
            }}
          >
            <span className="text-xl">⭐</span>
            <span>Row cleared!</span>
            <span className="opacity-80">📚 {wordsAdded} words</span>
            <span className="opacity-80">💰 +{coinsEarned}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
