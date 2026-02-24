"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface BoardCompleteModalProps {
  show: boolean;
  wordsAdded: number;
  coinsEarned: number;
  accuracy: number;
  streakDays: number;
  theme: string;
  onPlayAgain: () => void;
}

const MASCOTS: Record<string, string> = {
  ocean: "🐙",
  space: "🦝",
  forest: "🐉",
  candy: "🐻",
  classic: "🦉",
};

export default function BoardCompleteModal({
  show,
  wordsAdded,
  coinsEarned,
  accuracy,
  streakDays,
  theme,
  onPlayAgain,
}: BoardCompleteModalProps) {
  const mascot = MASCOTS[theme] ?? "🎉";

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/80"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", damping: 18, stiffness: 200, delay: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl"
              style={{ background: "var(--color-bg-surface)" }}
            >
              {/* Mascot */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                className="text-6xl mb-4"
              >
                {mascot}
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.15, 1] }}
                transition={{ delay: 0.3, duration: 0.5, ease: "backOut" }}
                className="text-4xl font-extrabold mb-2"
                style={{ color: "var(--color-accent-gold)" }}
              >
                🎉 YOU DID IT! 🎉
              </motion.h1>

              <p className="mb-6" style={{ color: "var(--color-text-muted)" }}>
                Amazing reading! Keep it up!
              </p>

              {/* Stats */}
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-2 gap-3 mb-6"
              >
                {[
                  { label: "Words Added", value: wordsAdded, icon: "📚" },
                  { label: "Coins Earned", value: coinsEarned, icon: "💰" },
                  { label: "Accuracy", value: `${Math.round(accuracy * 100)}%`, icon: "🎯" },
                  { label: "Day Streak", value: streakDays, icon: "🔥" },
                ].map(({ label, value, icon }) => (
                  <div
                    key={label}
                    className="rounded-2xl p-3"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <div className="text-2xl mb-1">{icon}</div>
                    <div
                      className="text-xl font-extrabold"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {value}
                    </div>
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {label}
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* Buttons */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="flex flex-col gap-3"
              >
                <motion.button
                  onClick={onPlayAgain}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3 rounded-2xl font-extrabold text-white text-lg"
                  style={{
                    background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-secondary) 100%)",
                  }}
                >
                  🎲 Play Another Board
                </motion.button>

                <Link
                  href="/word-bank"
                  className="w-full py-3 rounded-2xl font-bold text-center transition-colors hover:bg-white/10"
                  style={{ color: "var(--color-text-muted)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  📚 View Word Bank
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
