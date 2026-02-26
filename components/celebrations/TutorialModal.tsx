"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface TutorialModalProps {
  show: boolean;
  onClose: () => void;
}

const SLIDES = [
  {
    emoji: "🎲",
    title: "Roll the Dice!",
    desc: "Click ROLL (or press Spacebar) to throw the dice and activate a row.",
  },
  {
    emoji: "👂",
    title: "Listen, then Tap!",
    desc: "Listen for the word, then tap it on the board. The right word glows!",
  },
  {
    emoji: "📚",
    title: "Words Fly to Your Bank!",
    desc: "Correct words are collected in your Word Bank and earn you coins!",
  },
  {
    emoji: "🏆",
    title: "Clear All 6 Rows!",
    desc: "Clear all rows to complete the board and earn amazing rewards!",
  },
];

export default function TutorialModal({ show, onClose }: TutorialModalProps) {
  const [slide, setSlide] = useState(0);

  const next = () => {
    if (slide < SLIDES.length - 1) setSlide((s) => s + 1);
    else onClose();
  };

  const current = SLIDES[slide];

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: "spring", damping: 20 }}
            role="dialog"
            aria-modal="true"
            aria-label="How to play tutorial"
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl"
              style={{ background: "var(--color-bg-surface)" }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-7xl mb-6">{current.emoji}</div>
                  <h2
                    className="text-2xl font-extrabold mb-3"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {current.title}
                  </h2>
                  <p className="text-base mb-8" style={{ color: "var(--color-text-muted)" }}>
                    {current.desc}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Dots */}
              <div className="flex justify-center gap-2 mb-6" role="list" aria-label="Tutorial progress">
                {SLIDES.map((_, i) => (
                  <div
                    key={i}
                    role="listitem"
                    aria-label={`Step ${i + 1} of ${SLIDES.length}${i === slide ? " (current)" : ""}`}
                    className="h-2 rounded-full transition-all"
                    style={{
                      background: i === slide ? "var(--color-brand)" : "rgba(255,255,255,0.2)",
                      width: i === slide ? "20px" : "8px",
                    }}
                  />
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  aria-label="Skip tutorial"
                  className="flex-1 py-3 rounded-2xl font-semibold transition-colors hover:bg-white/10"
                  style={{ color: "var(--color-text-muted)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  Skip
                </button>
                <motion.button
                  onClick={next}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 py-3 rounded-2xl font-extrabold text-white"
                  style={{ background: "var(--color-brand)" }}
                >
                  {slide < SLIDES.length - 1 ? "Next →" : "Let's Play! 🎲"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
