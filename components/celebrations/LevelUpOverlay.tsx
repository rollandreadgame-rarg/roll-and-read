"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import ShimmerButton from "@/components/ui/shimmer-button";
import ShootingStars from "@/components/ui/shooting-stars";

interface LevelUpOverlayProps {
  show: boolean;
  newLevel: string;
  onClose: () => void;
}

const GOLD = ["#FFD700", "#FFA500", "#FFFACD", "#FF6B6B", "#FFFFFF"];

export default function LevelUpOverlay({ show, newLevel, onClose }: LevelUpOverlayProps) {
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

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Background */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{
              background: "radial-gradient(ellipse at center, rgba(245,158,11,0.3) 0%, rgba(0,0,0,0.96) 65%)",
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
            aria-label="Level up"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center p-6"
          >
            {/* Expanding ring */}
            <motion.div
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 5, opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="absolute w-32 h-32 rounded-full"
              style={{ border: "4px solid #F59E0B" }}
            />

            {/* Inner glow burst */}
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute w-40 h-40 rounded-full"
              style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 70%)" }}
            />

            {/* Trophy */}
            <motion.div
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring", damping: 10, stiffness: 180 }}
              className="text-9xl mb-4 relative z-10 drop-shadow-2xl"
            >
              🏆
            </motion.div>

            {/* LEVEL UP */}
            <motion.h1
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.25, 1], opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.55, ease: "backOut" }}
              className="text-6xl font-extrabold mb-2 relative z-10 text-balance"
              style={{
                color: "var(--color-accent-gold)",
                textShadow: "0 0 60px rgba(245,158,11,0.8), 0 4px 20px rgba(0,0,0,0.5)",
              }}
            >
              LEVEL UP!
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85 }}
              className="text-2xl font-bold mb-2 relative z-10"
              style={{ color: "var(--color-text-primary)" }}
            >
              You unlocked Level {newLevel}!
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="mb-10 relative z-10 text-lg"
              style={{ color: "var(--color-text-muted)" }}
            >
              🎴 3 free sticker pulls incoming!
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3 }}
              className="relative z-10"
            >
              <ShimmerButton
                onClick={onClose}
                className="px-10 py-4 text-xl"
                background="linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
                shimmerColor="rgba(255,255,255,0.35)"
              >
                Let&apos;s Go! 🚀
              </ShimmerButton>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
