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
      aria-label={`Word card: ${word.word}${word.isNonsense ? " — silly word, sound it out" : ""}`}
      role="button"
      className={cn(
        "relative min-h-[56px] px-3 py-2 rounded-xl flex-1 basis-[72px]",
        "font-bold select-none cursor-pointer",
        "border-2 transition-all duration-150",
        "flex items-center justify-center",
        // Silly (nonsense) words get a dashed border so they read as "not real"
        // even in grayscale / for colorblind kids — layers on top of the state color below.
        word.isNonsense && "border-dashed",
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
      {/* Silly (nonsense) word: "outer space" backdrop so the whole slot reads as
          an alien/not-real word. Hidden on correct so the success burst stays clean. */}
      {word.isNonsense && !isCorrect && (
        <span
          className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
          aria-hidden="true"
          style={{
            // Flat, uniform dark-purple space tint. No top highlight or inset
            // "stars" — those rendered as a thick light band crowding the word.
            // A faint glow sits low/center so the top stays dark for contrast.
            background:
              "radial-gradient(circle at 50% 95%, rgba(129,140,248,0.18) 0%, transparent 55%)," +
              "linear-gradient(180deg, #2c0a54 0%, #371263 100%)",
          }}
        />
      )}

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

      {/* Word text — for silly words, add a dark text-shadow so the bold letters
          stay high-contrast and legible over the purple space backdrop. */}
      <span
        className="relative z-10"
        style={
          word.isNonsense
            ? { textShadow: "0 1px 2px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.85)" }
            : undefined
        }
      >
        {word.word}
      </span>

      {/* Silly (nonsense) word markers. Two redundant, hard-to-miss cues:
          a big alien (top-left) for non-readers/ELLs, and the ✦ star (top-right)
          kept as a secondary signifier. */}
      {word.isNonsense && (
        <>
          <span
            className="absolute -top-1 -left-1 z-20 flex items-center justify-center rounded-full bg-violet-600 shadow-md ring-1 ring-white/80"
            aria-hidden="true"
            title="Silly word — not a real word, just sound it out!"
            style={{
              width: "20px",
              height: "20px",
              fontSize: "13px",
              lineHeight: 1,
            }}
          >
            👽
          </span>
          <span
            className="absolute top-1 right-1.5 z-20 font-bold text-amber-300"
            aria-hidden="true"
            style={{ fontSize: "11px" }}
          >
            ✦
          </span>
        </>
      )}
    </motion.button>
  );
}
