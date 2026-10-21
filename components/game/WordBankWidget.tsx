"use client";

import { motion } from "framer-motion";

interface WordBankWidgetProps {
  wordCount: number;
  onOpen: () => void;
}

export default function WordBankWidget({ wordCount, onOpen }: WordBankWidgetProps) {
  return (
    <motion.button
      key={wordCount}
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 0.3, ease: "backOut" }}
      onClick={onOpen}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-sm tabular-nums transition-colors hover:bg-[var(--color-hover)]"
      aria-label="Open word bank"
      style={{ color: "var(--color-text-primary)" }}
    >
      <span aria-hidden="true">📚</span>
      <span>{wordCount}</span>
    </motion.button>
  );
}
