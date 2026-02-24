"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { WordEntry } from "@/lib/game/boardGenerator";

interface WordCardProps {
  word: WordEntry;
  isActive: boolean;
  isCorrect: boolean;
  isWrong: boolean;
  isCleared: boolean;
  onTap: (word: WordEntry) => void;
  wordRef?: React.RefObject<HTMLButtonElement | null>;
  hintTarget?: boolean;
}

export default function WordCard({
  word,
  isActive,
  isCorrect,
  isWrong,
  isCleared,
  onTap,
  wordRef,
  hintTarget,
}: WordCardProps) {
  if (isCleared) return null;

  return (
    <motion.button
      ref={wordRef}
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: isActive ? 1 : 0.55,
        scale: 1,
        x: isWrong ? [0, -8, 8, -5, 5, -2, 2, 0] : 0,
      }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      transition={{
        layout: { duration: 0.3, ease: "easeInOut" },
        opacity: { duration: 0.2 },
        scale: { duration: 0.15 },
        x: isWrong ? { duration: 0.35, times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1] } : { duration: 0.15 },
      }}
      whileHover={isActive ? { scale: 1.05, transition: { duration: 0.15 } } : {}}
      whileTap={isActive ? { scale: 0.97 } : {}}
      onClick={() => isActive && !isCorrect && onTap(word)}
      disabled={!isActive || isCorrect}
      aria-label={`Word card: ${word.word}${word.isNonsense ? " (nonsense word)" : ""}`}
      role="button"
      className={cn(
        "relative min-h-[56px] min-w-[80px] px-4 py-3 rounded-xl",
        "font-bold select-none cursor-pointer",
        "border-2 transition-colors duration-150",
        "flex items-center justify-center",
        !isActive && "opacity-55 cursor-not-allowed",
        isActive && !isCorrect && !isWrong && !hintTarget &&
          "border-indigo-400 shadow-lg shadow-indigo-400/40 text-white bg-slate-800/80",
        isActive && hintTarget && !isCorrect &&
          "border-amber-400 shadow-lg shadow-amber-400/50 text-white bg-slate-800/80",
        isWrong && "border-red-500 bg-slate-800/80",
        !isActive && !isCorrect &&
          "border-slate-600 text-slate-300 bg-slate-800/60",
        isCorrect &&
          "border-emerald-400 bg-emerald-500 text-white shadow-lg shadow-emerald-400/40",
      )}
      style={{ fontSize: "var(--word-size)", willChange: "transform" }}
    >
      {/* Word text */}
      <span>{word.word}</span>

      {/* Nonsense word marker */}
      {word.isNonsense && (
        <span
          className="absolute top-1 right-1.5 text-xs font-bold text-amber-400"
          aria-hidden="true"
          style={{ fontSize: "10px" }}
        >
          ✦
        </span>
      )}
    </motion.button>
  );
}
