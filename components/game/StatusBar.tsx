"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
  const [coinDelta, setCoinDelta] = useState(0);

  if (coins !== prevCoins) {
    const delta = coins - prevCoins;
    setPrevCoins(coins);
    if (delta > 0) setCoinDelta(delta);
  }

  return (
    <>
      {/* Status Bar */}
      <div
        className="sticky bottom-0 z-40 flex items-center justify-between px-4 py-3 border-t"
        style={{
          background: "color-mix(in srgb, var(--color-bg-surface) 95%, transparent)",
          borderColor: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Coins */}
        <div className="flex items-center gap-2">
          <span className="text-xl">💰</span>
          <motion.span
            key={coins}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="font-extrabold text-lg"
            style={{ color: "var(--color-accent-gold)" }}
          >
            {coins.toLocaleString()}
          </motion.span>
        </div>

        {/* Word Bank - tappable */}
        <button
          onClick={() => setShowWordBank(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors hover:bg-white/10"
          aria-label="Open word bank"
        >
          <span className="text-xl">📚</span>
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {wordCount} words
          </span>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            • 💎 {wordBankValue.toLocaleString()}
          </span>
        </button>

        {/* Level badge */}
        <div
          className="px-3 py-1 rounded-full text-xs font-bold text-white"
          style={{ background: "var(--color-brand)" }}
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
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6"
              style={{ background: "var(--color-bg-surface)", maxHeight: "70vh", overflowY: "auto" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-extrabold" style={{ color: "var(--color-text-primary)" }}>
                  📚 Word Bank
                </h2>
                <button
                  onClick={() => setShowWordBank(false)}
                  className="p-2 rounded-lg hover:bg-white/10"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-center">
                <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="text-2xl font-extrabold" style={{ color: "var(--color-accent-gold)" }}>
                    {wordCount}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>Total Words</div>
                </div>
                <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="text-2xl font-extrabold" style={{ color: "var(--color-brand)" }}>
                    💎 {wordBankValue.toLocaleString()}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>Coin Value</div>
                </div>
              </div>

              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>
                Recently Added
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
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    >
                      <span className="font-bold" style={{ color: "var(--color-text-primary)" }}>
                        {w.word}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "var(--color-brand)", color: "white" }}
                        >
                          {w.level}
                        </span>
                        <span style={{ color: "var(--color-accent-gold)", fontSize: "12px" }}>
                          +{w.coinValue}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Link
                href="/word-bank"
                className="block w-full py-3 rounded-xl text-center font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--color-brand)" }}
                onClick={() => setShowWordBank(false)}
              >
                View All Words →
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
