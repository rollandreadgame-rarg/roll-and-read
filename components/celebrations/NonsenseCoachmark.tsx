"use client";

import { useEffect, useId, useRef } from "react";
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
  const titleId = useId();

  // Escape dismisses too (it never steals focus — it's a non-blocking tip).
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.repeat) onDismissRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(calc(100vw-32px),420px)]"
          role="status"
          aria-live="polite"
          aria-labelledby={titleId}
        >
          <div
            className="rounded-[22px] p-4 sm:p-5 flex items-start gap-4"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-line)",
              boxShadow: "0 18px 48px -14px rgba(0, 0, 0, 0.45)",
            }}
          >
            {/* A sample silly-word card, drawn just like the real ones */}
            <div
              aria-hidden="true"
              className="relative shrink-0 mt-2 ml-2 flex items-center justify-center px-3 border-2 border-dashed font-bold"
              style={{
                minWidth: 64,
                height: 52,
                borderRadius: "var(--radius-card)",
                background: "var(--card-silly)",
                color: "var(--card-silly-ink)",
                borderColor: "var(--card-silly-edge)",
                boxShadow: "0 4px 0 color-mix(in srgb, var(--card-silly-edge) 55%, var(--card-silly))",
                fontFamily: "var(--font-word)",
                fontSize: 22,
                lineHeight: 1,
              }}
            >
              zub
              <span
                className="absolute -top-2 -left-2 flex items-center justify-center rounded-full"
                style={{
                  width: 24,
                  height: 24,
                  fontSize: 14,
                  lineHeight: 1,
                  background: "var(--card-silly-edge)",
                  boxShadow: "0 0 0 2px var(--card-paper)",
                }}
              >
                👽
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <p id={titleId} className="font-bold text-lg mb-1" style={{ color: "var(--color-text-primary)" }}>
                Meet the silly words!
              </p>
              <p className="text-sm mb-3" style={{ color: "var(--color-text-secondary)" }}>
                A light purple card with a dashed purple border and an alien <span aria-hidden="true">👽</span> is a{" "}
                <strong>silly word</strong>. It isn&apos;t a real word. Just sound it out!
              </p>
              <button
                onClick={onDismiss}
                className="btn-primary text-sm px-5 py-2"
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
