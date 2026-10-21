"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useId, useRef, type ReactNode } from "react";
import MiniDie from "@/components/game/MiniDie";

interface TutorialModalProps {
  show: boolean;
  onClose: () => void;
}

const SLIDES: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: <MiniDie face={5} className="w-20 h-20" />,
    title: "Roll the die",
    desc: "Tap Roll to throw the die and see how many dots you get.",
  },
  {
    icon: (
      <span className="flex items-center gap-2">
        <MiniDie face={3} className="w-12 h-12" />
        <span className="text-4xl" aria-hidden="true">✨</span>
      </span>
    ),
    title: "Find the row with that many dots",
    desc: "The row with the same dots lights up. That's the row you play.",
  },
  {
    icon: <span aria-hidden="true">👂</span>,
    title: "Listen",
    desc: "Listen to the word. Press the space bar to hear it again.",
  },
  {
    icon: <span aria-hidden="true">👆</span>,
    title: "Tap the word you hear",
    desc: "Tap the card that matches. Right answers earn coins and go into your Word Bank.",
  },
  {
    icon: <span aria-hidden="true">🏆</span>,
    title: "Clear all 6 rows",
    desc: "Clear every row to finish the board and earn rewards!",
  },
];

export default function TutorialModal({ show, onClose }: TutorialModalProps) {
  const [slide, setSlide] = useState(0);
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);

  // The modal stays mounted between profiles, so reset to the first slide each
  // time it opens — otherwise a new profile sees it starting on the last slide.
  useEffect(() => {
    if (!show) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlide(0);
  }, [show]);

  // Dialog keyboard support: focus the main button on open, Escape skips.
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

  const next = () => {
    if (slide < SLIDES.length - 1) setSlide((s) => s + 1);
    else onClose();
  };

  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: "spring", damping: 20 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full max-w-sm rounded-[28px] p-7 sm:p-8 text-center"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-line)",
                boxShadow: "0 24px 64px -16px rgba(0, 0, 0, 0.45)",
              }}
            >
              <h2
                id={titleId}
                className="text-sm font-semibold mb-5"
                style={{ color: "var(--color-text-muted)" }}
              >
                How to play
              </h2>

              <AnimatePresence mode="wait">
                <motion.div
                  key={slide}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.2 }}
                  aria-live="polite"
                >
                  <div className="text-7xl mb-6 h-20 flex items-center justify-center">
                    {current.icon}
                  </div>
                  <h3
                    className="text-2xl font-extrabold mb-3"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {current.title}
                  </h3>
                  <p className="text-base mb-8" style={{ color: "var(--color-text-secondary)" }}>
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
                      background: i === slide ? "var(--color-brand)" : "var(--color-line-strong)",
                      width: i === slide ? "20px" : "8px",
                    }}
                  />
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  aria-label="Skip tutorial"
                  className="flex-1 py-3 rounded-2xl font-semibold transition-colors hover:bg-[var(--color-hover)]"
                  style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-line)" }}
                >
                  Skip
                </button>
                <button
                  ref={primaryRef}
                  onClick={next}
                  className="btn-primary flex-1 py-3 text-base"
                >
                  {isLast ? "Let's play!" : "Next"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
