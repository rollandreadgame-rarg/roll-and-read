"use client";

import { motion, AnimatePresence } from "framer-motion";

interface UpgradeModalProps {
  show: boolean;
  reason: string;
  onClose: () => void;
}

export default function UpgradeModal({ show, reason, onClose }: UpgradeModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: "spring", damping: 20 }}
            role="dialog"
            aria-modal="true"
            aria-label="Upgrade to premium"
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl"
              style={{ background: "var(--color-bg-surface)" }}
            >
              <div className="text-6xl mb-4">🚀</div>
              <h2
                className="text-2xl font-extrabold mb-2 text-balance"
                style={{ color: "var(--color-text-primary)" }}
              >
                Ready for the full adventure?
              </h2>
              <p className="mb-2 text-pretty" style={{ color: "var(--color-text-muted)" }}>
                {reason}
              </p>
              <p className="mb-6 text-sm text-pretty" style={{ color: "var(--color-text-muted)" }}>
                Upgrade to unlock all 5 levels, all themes, and the full sticker collection!
              </p>
              <div className="flex flex-col gap-3">
                <motion.a
                  href="/billing"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3 rounded-2xl font-extrabold text-white text-center"
                  style={{
                    background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                    boxShadow: "0 4px 16px rgba(245,158,11,0.4)",
                  }}
                >
                  ✨ Upgrade to Keep Reading!
                </motion.a>
                <button
                  onClick={onClose}
                  className="py-3 rounded-2xl font-semibold transition-colors hover:bg-white/10"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
