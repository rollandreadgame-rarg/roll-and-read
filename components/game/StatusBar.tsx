"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface StatusBarProps {
  coins: number;
  wordCount: number;
  wordBankValue: number;
  recentWords: { word: string; level: string; coinValue: number }[];
  level: string;
}

export default function StatusBar({
  coins,
  wordCount,
  wordBankValue,
  recentWords,
  level,
}: StatusBarProps) {
  const [showWordBank, setShowWordBank] = useState(false);
  const [prevCoins, setPrevCoins] = useState(coins);

  if (coins !== prevCoins) {
    setPrevCoins(coins);
  }

  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!showWordBank) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowWordBank(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showWordBank]);

  return (
    <>
      {/* Status Bar */}
      <div
        className="sticky bottom-0 z-40 flex items-center justify-between gap-3 px-4 sm:px-6 py-2 pb-[max(8px,calc(env(safe-area-inset-bottom)+8px))] border-t"
        style={{
          background: "color-mix(in srgb, var(--color-bg-surface) 95%, transparent)",
          borderColor: "var(--color-line)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Coins */}
        <div className="flex items-center gap-2" role="img" aria-label={`${coins} coins`}>
          <span className="text-xl" aria-hidden="true">💰</span>
          <motion.span
            key={coins}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="font-extrabold text-lg tabular-nums"
            aria-hidden="true"
            style={{ color: "var(--color-gold-text)" }}
          >
            {coins.toLocaleString()}
          </motion.span>
        </div>

        {/* Word Bank - tappable */}
        <button
          onClick={() => setShowWordBank(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors hover:bg-[var(--color-hover)]"
          aria-label={`Word bank: ${wordCount} words. Open`}
          aria-haspopup="dialog"
        >
          <span className="text-xl" aria-hidden="true">📚</span>
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {wordCount} words
          </span>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            💎 {wordBankValue.toLocaleString()}
          </span>
        </button>

        {/* Level badge (phones show it here; the board header shows it on wider screens) */}
        <div
          className="sm:hidden px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ background: "var(--color-brand)", color: "var(--color-on-brand)" }}
        >
          Level {level}
        </div>
      </div>

      {/* Word Bank Drawer */}
      <AnimatePresence>
        {showWordBank && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60"
              onClick={() => setShowWordBank(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6 max-w-xl mx-auto border-t border-x"
              style={{ background: "var(--color-bg-surface)", borderColor: "var(--color-line)", maxHeight: "70vh", overflowY: "auto" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="wordbank-drawer-title"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 id="wordbank-drawer-title" className="text-xl font-extrabold" style={{ color: "var(--color-text-primary)" }}>
                  Word bank
                </h2>
                <button
                  ref={closeRef}
                  onClick={() => setShowWordBank(false)}
                  className="p-2 rounded-xl hover:bg-[var(--color-hover)]"
                  style={{ color: "var(--color-text-muted)" }}
                  aria-label="Close word bank"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-center">
                <div className="rounded-xl p-3" style={{ background: "var(--color-surface-2)" }}>
                  <div className="text-2xl font-extrabold" style={{ color: "var(--color-gold-text)" }}>
                    {wordCount}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>Words learned</div>
                </div>
                <div className="rounded-xl p-3" style={{ background: "var(--color-surface-2)" }}>
                  <div className="text-2xl font-extrabold" style={{ color: "var(--color-brand-secondary)" }}>
                    💎 {wordBankValue.toLocaleString()}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>Coin value</div>
                </div>
              </div>

              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>
                Recently added
              </h3>
              <div className="flex flex-col gap-2 mb-4">
                {recentWords.length === 0 ? (
                  <p className="text-center py-4" style={{ color: "var(--color-text-muted)" }}>
                    No words yet — start rolling!
                  </p>
                ) : (
                  recentWords.slice(0, 10).map((w, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ background: "var(--color-surface-2)" }}
                    >
                      <span className="font-bold text-lg" style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-word)" }}>
                        {w.word}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "var(--color-brand)", color: "var(--color-on-brand)" }}
                        >
                          {w.level}
                        </span>
                        <span style={{ color: "var(--color-gold-text)", fontSize: "12px" }}>
                          +{w.coinValue}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Link
                href="/word-bank"
                className="btn-primary flex items-center justify-center w-full py-3 text-center"
                onClick={() => setShowWordBank(false)}
              >
                See all my words
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
