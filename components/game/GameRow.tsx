"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import WordCard from "./WordCard";
import MiniDie from "./MiniDie";
import type { GameRow as GameRowType } from "@/lib/game/boardGenerator";
import type { WordEntry } from "@/lib/game/boardGenerator";

interface GameRowProps {
  row: GameRowType;
  isActive: boolean;
  clearedWords: Set<string>;
  wrongWord: string | null;
  correctWord: string | null;
  hintWordId: string | null;
  onWordTap: (word: WordEntry, rect?: DOMRect) => void;
}

export default function GameRow({
  row,
  isActive,
  clearedWords,
  wrongWord,
  correctWord,
  hintWordId,
  onWordTap,
}: GameRowProps) {
  if (row.cleared) return null;

  const activeWords = row.words.filter((w) => !clearedWords.has(w._id));

  return (
    <motion.div
      layout
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scaleY: 0 }}
      transition={{ duration: 0.3, ease: "easeIn" }}
      className={cn(
        "flex items-center gap-2.5 sm:gap-3 px-2 sm:px-3 py-2.5 sm:py-3 rounded-[18px] transition-colors duration-200",
        isActive ? "row-active-pulse" : ""
      )}
      style={{
        transformOrigin: "top center",
        color: "var(--color-text-muted)",
        background: isActive
          ? "color-mix(in srgb, var(--color-highlight) 10%, var(--color-bg-surface))"
          : undefined,
      }}
      aria-label={`Row ${row.dieNumber}${isActive ? ", your turn" : ""}`}
      role="group"
    >
      {/* Row marker: the die face that opens this row */}
      <MiniDie
        face={row.dieNumber}
        tone={isActive ? "lit" : "dim"}
        className={cn(
          "transition-all duration-200",
          isActive ? "size-10 sm:size-11 drop-shadow-md" : "size-8 sm:size-9"
        )}
      />

      {/* Word cards */}
      <div className="flex flex-wrap gap-2.5 sm:gap-3 flex-1 min-w-0">
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
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
