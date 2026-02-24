"use client";

import { motion, AnimatePresence } from "framer-motion";

interface LevelUpOverlayProps {
  show: boolean;
  newLevel: string;
  onClose: () => void;
}

export default function LevelUpOverlay({ show, newLevel, onClose }: LevelUpOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: "radial-gradient(ellipse at center, #F59E0B44 0%, rgba(0,0,0,0.95) 70%)" }}
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center p-6"
          >
            {/* Golden flash */}
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute w-40 h-40 rounded-full"
              style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 70%)" }}
            />

            {/* Trophy */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring", damping: 12 }}
              className="text-8xl mb-4"
            >
              🏆
            </motion.div>

            {/* LEVEL UP text */}
            <motion.h1
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: 0.5, duration: 0.5, ease: "backOut" }}
              className="text-5xl font-extrabold mb-2"
              style={{ color: "var(--color-accent-gold)", textShadow: "0 0 40px rgba(245,158,11,0.6)" }}
            >
              LEVEL UP!
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-xl font-bold mb-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              You unlocked Level {newLevel}!
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mb-8"
              style={{ color: "var(--color-text-muted)" }}
            >
              🎴 3 free sticker pulls incoming!
            </motion.p>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              onClick={onClose}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="px-8 py-4 rounded-2xl font-extrabold text-xl text-white"
              style={{
                background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                boxShadow: "0 8px 32px rgba(245,158,11,0.4)",
              }}
            >
              Let's Go! 🚀
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
