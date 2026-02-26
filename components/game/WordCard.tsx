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
      initial={{ opacity: 0, scale: 0.75, y: 8 }}
      animate={{
        opacity: isActive ? 1 : 0.5,
        scale: 1,
        y: 0,
        x: isWrong ? [0, -9, 9, -6, 6, -3, 3, 0] : 0,
      }}
      exit={{ opacity: 0, scale: 0.4, y: -16, transition: { duration: 0.22 } }}
      transition={{
        layout: { duration: 0.3, ease: "easeInOut" },
        opacity: { duration: 0.2 },
        scale: { duration: 0.18 },
        y: { duration: 0.25 },
        x: isWrong ? { duration: 0.2, times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1] } : { duration: 0.15 },
      }}
      whileHover={isActive && !isCorrect ? { scale: 1.07, y: -2, transition: { duration: 0.12 } } : {}}
      whileTap={isActive ? { scale: 0.94 } : {}}
      onClick={() => isActive && !isCorrect && onTap(word)}
      disabled={!isActive || isCorrect}
      aria-label={`Word card: ${word.word}${word.isNonsense ? " (nonsense word)" : ""}`}
      role="button"
      className={cn(
        "relative min-h-[56px] px-3 py-2 rounded-xl flex-1 basis-[72px]",
        "font-bold select-none cursor-pointer",
        "border-2 transition-all duration-150",
        "flex items-center justify-center",
        !isActive && "cursor-not-allowed",
        // Inactive
        !isActive && !isCorrect &&
          "border-slate-600/70 text-slate-400 bg-slate-800/50",
        // Active normal
        isActive && !isCorrect && !isWrong && !hintTarget &&
          "border-indigo-400 text-white bg-slate-800/90",
        // Hint target
        isActive && hintTarget && !isCorrect &&
          "border-amber-400 text-white bg-slate-800/90",
        // Wrong
        isWrong && "border-red-500 bg-red-950/40 text-white",
        // Correct
        isCorrect &&
          "border-emerald-400 bg-emerald-500 text-white",
      )}
      style={{
        fontSize: "var(--word-size)",
        boxShadow: isCorrect
          ? "0 0 0 0 rgba(52,211,153,0), 0 4px 20px rgba(52,211,153,0.4)"
          : isWrong
          ? "0 0 0 2px rgba(239,68,68,0.5)"
          : isActive && hintTarget
          ? "0 0 8px 2px rgba(245,158,11,0.5), 0 0 24px 4px rgba(245,158,11,0.2)"
          : isActive
          ? "0 0 8px 2px rgba(99,102,241,0.5), 0 0 24px 4px rgba(99,102,241,0.2)"
          : undefined,
        animation: isCorrect
          ? "correct-burst 0.5s ease-out forwards"
          : isActive && hintTarget
          ? "hint-glow 1.2s ease-in-out infinite"
          : isActive && !isWrong
          ? "glow-pulse 2s ease-in-out infinite"
          : undefined,
      }}
    >
      {/* Shimmer on active hover */}
      {isActive && !isCorrect && (
        <span
          className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
          style={{
            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)",
            backgroundSize: "200% 100%",
            animation: "shimmer-sweep 2.5s linear infinite",
          }}
        />
      )}

      {/* Correct burst overlay */}
      <AnimatePresence>
        {isCorrect && (
          <motion.span
            className="absolute inset-0 rounded-xl pointer-events-none"
            initial={{ opacity: 0.8, scale: 1 }}
            animate={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            style={{ background: "radial-gradient(circle, rgba(52,211,153,0.6) 0%, transparent 70%)" }}
          />
        )}
      </AnimatePresence>

      {/* Word text */}
      <span className="relative z-10">{word.word}</span>

      {/* Nonsense word marker */}
      {word.isNonsense && (
        <span
          className="absolute top-1 right-1.5 font-bold text-amber-400"
          aria-hidden="true"
          style={{ fontSize: "10px" }}
        >
          ✦
        </span>
      )}
    </motion.button>
  );
}
