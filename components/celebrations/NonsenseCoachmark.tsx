"use client";

import { motion, AnimatePresence } from "framer-motion";

interface NonsenseCoachmarkProps {
  show: boolean;
  onDismiss: () => void;
}

/**
 * One-time coaching popup shown the first time a player sees a board that
 * contains silly (nonsense) words. Teaches the convention so kids and English
 * learners don't mistake a nonsense word for a real one. Non-blocking — the
 * player can ignore it and keep playing; dismissal is persisted per profile.
 */
export default function NonsenseCoachmark({ show, onDismiss }: NonsenseCoachmarkProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,420px)]"
          role="status"
          aria-live="polite"
        >
          <div
            className="rounded-2xl p-4 shadow-xl flex items-start gap-3"
            style={{
              background: "var(--color-bg-surface)",
              border: "2px dashed rgba(139,92,246,0.7)",
            }}
          >
            <div className="text-3xl shrink-0" aria-hidden="true">
              👽
            </div>
            <div className="flex-1">
              <p className="font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>
                Meet the silly words!
              </p>
              <p className="text-sm mb-3" style={{ color: "var(--color-text-muted)" }}>
                Cards with an alien <span aria-hidden="true">👽</span> and a dashed border are{" "}
                <strong>silly words</strong> — they aren&apos;t real words. Just sound them out!
              </p>
              <button
                onClick={onDismiss}
                className="text-sm font-bold rounded-full px-4 py-1.5 text-white"
                style={{ background: "var(--color-brand)" }}
              >
                Got it!
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
