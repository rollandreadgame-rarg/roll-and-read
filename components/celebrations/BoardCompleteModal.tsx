"use client";

import { useEffect, useId, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import confetti from "canvas-confetti";
import Sparkles from "@/components/ui/sparkles";

interface BoardCompleteModalProps {
  show: boolean;
  wordsAdded: number;
  coinsEarned: number;
  accuracy: number;
  streakDays: number;
  theme: string;
  pendingRewardCount: number;
  onPrimary: () => void; // "Pick my sticker(s)!" when rewards pending, else "Play Another Board"
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

// Gold blended toward the theme's ink: pale gold on dark themes, deep amber on
// light ones — readable as a headline in all five themes.
const GOLD_INK = "var(--color-gold-text)";

export default function BoardCompleteModal({
  show,
  wordsAdded,
  coinsEarned,
  accuracy,
  streakDays,
  theme,
  pendingRewardCount,
  onPrimary,
}: BoardCompleteModalProps) {
  const mascot = MASCOTS[theme] ?? "🎉";
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);

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

  // Dialog keyboard support: focus the main button on open; Escape continues.
  const onPrimaryRef = useRef(onPrimary);
  useEffect(() => {
    onPrimaryRef.current = onPrimary;
  }, [onPrimary]);
  useEffect(() => {
    if (!show) return;
    const raf = requestAnimationFrame(() => primaryRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.repeat) onPrimaryRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [show]);

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
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.65, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.65, y: 40 }}
            transition={{ type: "spring", damping: 16, stiffness: 220, delay: 0.1 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="relative w-full max-w-sm rounded-[28px] p-7 sm:p-8 text-center overflow-x-hidden overflow-y-auto max-h-[calc(100dvh-32px)]"
              style={{
                background:
                  "radial-gradient(120% 60% at 50% 0%, color-mix(in srgb, var(--color-accent-gold) 16%, transparent), transparent 70%), var(--color-bg-surface)",
                border: "1px solid var(--color-line)",
                boxShadow: "0 24px 64px -16px rgba(0, 0, 0, 0.5)",
              }}
            >
              <Sparkles count={14} />

              {/* Mascot */}
              <motion.div
                animate={{ y: [0, -12, 0], rotate: [0, -5, 5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="text-7xl mb-4 relative z-10"
                aria-hidden="true"
              >
                {mascot}
              </motion.div>

              {/* Headline */}
              <motion.h2
                id={titleId}
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ delay: 0.3, duration: 0.5, ease: "backOut" }}
                className="text-4xl font-extrabold mb-2 relative z-10 text-balance"
                style={{ color: GOLD_INK }}
              >
                <span aria-hidden="true">🎉 </span>You did it!<span aria-hidden="true"> 🎉</span>
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mb-6 relative z-10 text-pretty"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Amazing reading! Keep it up!
              </motion.p>

              {/* Reward teaser (the actual picking happens in PickCategoryModal) */}
              {pendingRewardCount > 0 && (
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="mb-5 relative z-10 rounded-2xl py-3 px-4"
                  style={{
                    background: "color-mix(in srgb, var(--color-accent-gold) 16%, var(--color-bg-surface))",
                    border: "1px solid color-mix(in srgb, var(--color-accent-gold) 55%, transparent)",
                  }}
                >
                  <div className="text-base font-extrabold" style={{ color: "var(--color-text-primary)" }}>
                    <span aria-hidden="true">🎁 </span>
                    {pendingRewardCount} sticker{pendingRewardCount > 1 ? "s" : ""} to pick!
                  </div>
                </motion.div>
              )}

              {/* Stats */}
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="grid grid-cols-2 gap-3 mb-6 relative z-10"
              >
                {[
                  { label: "Words added", value: wordsAdded, icon: "📚" },
                  { label: "Coins earned", value: coinsEarned, icon: "💰" },
                  { label: "Accuracy", value: `${Math.round(accuracy * 100)}%`, icon: "🎯" },
                  { label: "Day streak", value: streakDays, icon: "🔥" },
                ].map(({ label, value, icon }) => (
                  <div
                    key={label}
                    className="rounded-2xl p-3"
                    style={{
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-line)",
                    }}
                  >
                    <div className="text-2xl mb-1" aria-hidden="true">{icon}</div>
                    <div className="text-xl font-extrabold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
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
                transition={{ delay: 0.75 }}
                className="flex flex-col gap-3 relative z-10"
              >
                <button
                  ref={primaryRef}
                  onClick={onPrimary}
                  className="btn-primary w-full text-lg py-3.5"
                >
                  {pendingRewardCount > 0 ? (
                    <>
                      <span aria-hidden="true">🎁 </span>Pick my stickers!
                    </>
                  ) : (
                    "Play another board"
                  )}
                </button>

                <Link
                  href="/word-bank"
                  className="w-full py-3 rounded-2xl font-bold text-center transition-colors hover:border-[var(--color-line-strong)]"
                  style={{
                    background: "var(--color-surface-2)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-line)",
                    minHeight: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span aria-hidden="true">📚&nbsp;</span>View Word Bank
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
