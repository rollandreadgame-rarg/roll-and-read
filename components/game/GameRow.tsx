"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import WordCard from "./WordCard";
import type { GameRow as GameRowType } from "@/lib/game/boardGenerator";
import type { WordEntry } from "@/lib/game/boardGenerator";

interface GameRowProps {
  row: GameRowType;
  isActive: boolean;
  clearedWords: Set<string>;
  wrongWord: string | null;
  correctWord: string | null;
  hintWordId: string | null;
  onWordTap: (word: WordEntry) => void;
  wordRefs?: Record<string, React.RefObject<HTMLButtonElement | null>>;
}

export default function GameRow({
  row,
  isActive,
  clearedWords,
  wrongWord,
  correctWord,
  hintWordId,
  onWordTap,
  wordRefs,
}: GameRowProps) {
  if (row.cleared) return null;

  const activeWords = row.words.filter((w) => !clearedWords.has(w._id));

  return (
    <motion.div
      layout
      initial={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: "hidden" }}
      transition={{ duration: 0.4, ease: "easeIn" }}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200",
        isActive
          ? "bg-indigo-950/40 border border-indigo-400/30"
          : "border border-transparent"
      )}
    >
      {/* Row number */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center",
          "text-sm font-bold shrink-0 transition-colors",
          isActive
            ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/40"
            : "bg-slate-700 text-slate-400"
        )}
        aria-label={`Row ${row.dieNumber}`}
      >
        {row.dieNumber}
      </div>

      {/* Word cards */}
      <div className="flex flex-wrap gap-2 flex-1">
        <AnimatePresence mode="popLayout">
          {activeWords.map((word) => (
            <WordCard
              key={word._id}
              word={word}
              isActive={isActive}
              isCorrect={correctWord === word._id}
              isWrong={wrongWord === word._id}
              isCleared={clearedWords.has(word._id)}
              hintTarget={hintWordId === word._id}
              onTap={onWordTap}
              wordRef={wordRefs?.[word._id]}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
