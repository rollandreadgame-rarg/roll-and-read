"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import confetti from "canvas-confetti";
import Sparkles from "@/components/ui/sparkles";
import ShimmerButton from "@/components/ui/shimmer-button";

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

const THEME_COLORS: Record<string, string[]> = {
  ocean:   ["#0891B2", "#06B6D4", "#67E8F9", "#FFFFFF"],
  space:   ["#7C3AED", "#A78BFA", "#DDD6FE", "#FFFFFF"],
  forest:  ["#15803D", "#4ADE80", "#86EFAC", "#FFFFFF"],
  candy:   ["#DB2777", "#F472B6", "#FDE68A", "#FFFFFF"],
  classic: ["#2563EB", "#60A5FA", "#FCD34D", "#FFFFFF"],
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

  useEffect(() => {
    if (!show) return;
    const themeColors = THEME_COLORS[theme] ?? THEME_COLORS.ocean;
    const t = setTimeout(() => {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 }, colors: themeColors });
      setTimeout(() => {
        confetti({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.6 }, colors: themeColors });
        confetti({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors: themeColors });
      }, 300);
    }, 200);
    return () => clearTimeout(t);
  }, [show, theme]);

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.65, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.65, y: 40 }}
            transition={{ type: "spring", damping: 16, stiffness: 220, delay: 0.1 }}
            role="dialog"
            aria-modal="true"
            aria-label="Board complete"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="relative w-full max-w-sm rounded-3xl p-8 text-center overflow-hidden"
              style={{
                background: "linear-gradient(160deg, var(--color-bg-surface) 0%, rgba(30,41,59,0.95) 100%)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              }}
            >
              <Sparkles count={14} />

              {/* Mascot */}
              <motion.div
                animate={{ y: [0, -12, 0], rotate: [0, -5, 5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="text-7xl mb-4 relative z-10"
              >
                {mascot}
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ delay: 0.3, duration: 0.5, ease: "backOut" }}
                className="text-4xl font-extrabold mb-2 relative z-10 text-balance"
                style={{
                  color: "var(--color-accent-gold)",
                  textShadow: "0 0 30px rgba(245,158,11,0.5)",
                }}
              >
                🎉 YOU DID IT! 🎉
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mb-6 relative z-10 text-pretty"
                style={{ color: "var(--color-text-muted)" }}
              >
                Amazing reading! Keep it up!
              </motion.p>

              {/* Stats */}
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="grid grid-cols-2 gap-3 mb-6 relative z-10"
              >
                {[
                  { label: "Words Added", value: wordsAdded, icon: "📚" },
                  { label: "Coins Earned", value: coinsEarned, icon: "💰" },
                  { label: "Accuracy", value: `${Math.round(accuracy * 100)}%`, icon: "🎯" },
                  { label: "Day Streak", value: streakDays, icon: "🔥" },
                ].map(({ label, value, icon }) => (
                  <motion.div
                    key={label}
                    whileHover={{ scale: 1.04 }}
                    className="rounded-2xl p-3 transition-colors"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="text-2xl mb-1">{icon}</div>
                    <div className="text-xl font-extrabold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                      {value}
                    </div>
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {label}
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Buttons */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.75 }}
                className="flex flex-col gap-3 relative z-10"
              >
                <ShimmerButton
                  onClick={onPlayAgain}
                  className="w-full text-lg py-3"
                  background="linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-secondary) 100%)"
                >
                  🎲 Play Another Board
                </ShimmerButton>

                <Link
                  href="/word-bank"
                  className="w-full py-3 rounded-2xl font-bold text-center transition-all hover:bg-white/10"
                  style={{
                    color: "var(--color-text-muted)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    minHeight: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
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
