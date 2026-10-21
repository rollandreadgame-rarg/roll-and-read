"use client";

import { useEffect, useId, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import ShootingStars from "@/components/ui/shooting-stars";
import { isValidLevel, LEVEL_SKILLS } from "@/lib/levels";

interface LevelUpOverlayProps {
  show: boolean;
  newLevel: string;
  onClose: () => void;
}

const GOLD = ["#FFD700", "#FFA500", "#FFFACD", "#FF6B6B", "#FFFFFF"];

// Gold blended toward the theme's ink: pale gold on dark themes, deep amber on
// light ones — readable as a headline in all five themes.
const GOLD_INK = "var(--color-gold-text)";

export default function LevelUpOverlay({ show, newLevel, onClose }: LevelUpOverlayProps) {
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const skill = isValidLevel(newLevel) ? LEVEL_SKILLS[newLevel] : null;

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => {
      // Centre burst
      confetti({ particleCount: 180, spread: 120, origin: { y: 0.5 }, colors: GOLD, scalar: 1.2 });
      // Side cannons
      setTimeout(() => {
        confetti({ particleCount: 100, angle: 55, spread: 90, origin: { x: 0, y: 0.6 }, colors: GOLD });
        confetti({ particleCount: 100, angle: 125, spread: 90, origin: { x: 1, y: 0.6 }, colors: GOLD });
      }, 400);
      // Second wave
      setTimeout(() => {
        confetti({ particleCount: 80, spread: 100, origin: { y: 0.3 }, colors: GOLD, gravity: 0.4 });
      }, 800);
    }, 250);
    return () => clearTimeout(t);
  }, [show]);

  // Dialog keyboard support: focus the main button on open; Escape continues.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!show) return;
    const raf = requestAnimationFrame(() => primaryRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.repeat) onCloseRef.current();
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
          {/* Background: the theme's own table colour with a pool of gold light */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{
              background:
                "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-accent-gold) 32%, transparent) 0%, transparent 65%), color-mix(in srgb, var(--color-bg-primary) 94%, transparent)",
            }}
          />

          {/* Shooting stars */}
          <ShootingStars />

          {/* Content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center p-4 sm:p-6"
          >
            {/* Expanding ring */}
            <motion.div
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 5, opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="absolute w-32 h-32 rounded-full"
              style={{ border: "4px solid var(--color-accent-gold)" }}
            />

            {/* Inner glow burst */}
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute w-40 h-40 rounded-full"
              style={{ background: "radial-gradient(circle, var(--color-accent-gold) 0%, transparent 70%)" }}
            />

            <div
              className="relative z-10 w-full max-w-sm rounded-[28px] px-7 pt-6 pb-7 sm:px-8 sm:pb-8"
              style={{
                background: "var(--color-bg-surface)",
                border: "2px solid color-mix(in srgb, var(--color-accent-gold) 70%, transparent)",
                boxShadow:
                  "0 0 0 6px color-mix(in srgb, var(--color-accent-gold) 18%, transparent), 0 24px 64px -16px rgba(0, 0, 0, 0.5)",
              }}
            >
              {/* Trophy */}
              <motion.div
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: "spring", damping: 10, stiffness: 180 }}
                className="text-8xl sm:text-9xl mb-3 drop-shadow-xl"
                aria-hidden="true"
              >
                🏆
              </motion.div>

              {/* Level up */}
              <motion.h2
                id={titleId}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.25, 1], opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.55, ease: "backOut" }}
                className="text-5xl sm:text-6xl font-extrabold mb-3 text-balance"
                style={{ color: GOLD_INK }}
              >
                Level up!
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85 }}
                className="text-2xl font-bold mb-1"
                style={{ color: "var(--color-text-primary)" }}
              >
                You unlocked Level {newLevel}!
              </motion.p>

              {skill && (
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  className="text-base mb-2"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Next up: {skill}
                </motion.p>
              )}

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
                className="mb-7 text-lg"
                style={{ color: "var(--color-text-secondary)" }}
              >
                New words are waiting on your next board.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.3 }}
              >
                <button
                  ref={primaryRef}
                  onClick={onClose}
                  className="btn-primary w-full px-10 py-4 text-xl"
                >
                  Let&apos;s go!<span aria-hidden="true"> 🚀</span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
