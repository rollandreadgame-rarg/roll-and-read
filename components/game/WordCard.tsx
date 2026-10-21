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
  onTap: (word: WordEntry, rect?: DOMRect) => void;
  hintTarget?: boolean;
}

/**
 * A printed word card. In the active row it is card stock with dark ink and a
 * thick bottom edge you can press; in waiting rows it lies flat and quiet so
 * the active row is unmistakable.
 */
export default function WordCard({
  word,
  isActive,
  isCorrect,
  isWrong,
  isCleared,
  onTap,
  hintTarget,
}: WordCardProps) {
  if (isCleared) return null;

  const silly = word.isNonsense;
  const live = isActive && !isCorrect;

  // Paper, ink and edge colours for the current state
  let paper = "var(--card-paper)";
  let ink = "var(--card-ink)";
  let border = "transparent";
  let edge = "var(--card-edge)";
  if (silly) {
    paper = "var(--card-silly)";
    ink = "var(--card-silly-ink)";
    border = "var(--card-silly-edge)";
    edge = "color-mix(in srgb, var(--card-silly-edge) 55%, var(--card-silly))";
  }
  if (isWrong) {
    paper = "var(--card-wrong)";
    border = "var(--color-error)";
    edge = "color-mix(in srgb, var(--color-error) 55%, white)";
  }
  if (isCorrect) {
    paper = "var(--card-correct)";
    ink = "#0F3D25";
    border = "var(--color-success)";
    edge = "color-mix(in srgb, var(--color-success) 60%, white)";
  }
  if (isActive && hintTarget && !isCorrect) {
    border = "var(--color-accent-gold)";
  }

  const restingStyle: React.CSSProperties = {
    background: "var(--color-surface-2)",
    color: "var(--color-text-muted)",
    borderColor: silly ? "color-mix(in srgb, var(--card-silly-edge) 70%, var(--color-surface-2))" : "var(--color-line)",
    boxShadow: "none",
  };

  const raisedStyle: React.CSSProperties = {
    background: paper,
    color: ink,
    borderColor: border,
    boxShadow: `0 4px 0 ${edge}, 0 10px 18px -8px rgba(0, 0, 0, 0.45)`,
  };

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.8, y: 8 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
        x: isWrong ? [0, -9, 9, -6, 6, -3, 3, 0] : 0,
      }}
      exit={{ opacity: 0, scale: 0.5, y: -24, transition: { duration: 0.22 } }}
      transition={{
        layout: { duration: 0.3, ease: "easeInOut" },
        opacity: { duration: 0.2 },
        scale: { duration: 0.18 },
        y: { duration: 0.18 },
        x: isWrong ? { duration: 0.2, times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1] } : { duration: 0.15 },
      }}
      whileHover={live ? { y: -3, transition: { duration: 0.12 } } : {}}
      whileTap={live ? { y: 3, scale: 0.98 } : {}}
      onClick={(e) => live && onTap(word, e.currentTarget.getBoundingClientRect())}
      disabled={!live}
      aria-label={`Word card: ${word.word}${silly ? " — silly word, sound it out" : ""}`}
      className={cn(
        "relative min-h-[60px] sm:min-h-[66px] px-3 py-2 flex-1 basis-[76px]",
        "flex items-center justify-center whitespace-nowrap",
        "font-bold leading-none select-none border-2",
        "transition-[background-color,border-color,box-shadow,color] duration-150",
        silly && "border-dashed",
        live ? "cursor-pointer" : "cursor-default",
      )}
      style={{
        borderRadius: "var(--radius-card)",
        fontFamily: "var(--font-word)",
        fontSize: "calc(var(--word-size) * 1.2)",
        ...(isActive || isCorrect ? raisedStyle : restingStyle),
        animation: isCorrect
          ? "correct-burst 0.5s ease-out forwards"
          : live && hintTarget
          ? "hint-glow 1.2s ease-in-out infinite"
          : undefined,
      }}
    >
      {/* Correct: a soft green flash */}
      <AnimatePresence>
        {isCorrect && (
          <motion.span
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: "var(--radius-card)",
              background: "radial-gradient(circle, rgba(47,184,115,0.45) 0%, transparent 70%)",
            }}
            initial={{ opacity: 0.9, scale: 1 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      <span className="relative z-10">{word.word}</span>

      {/* Silly (nonsense) word: dashed border plus an alien badge, so it reads
          as "not a real word" without relying on colour alone. */}
      {silly && (
        <span
          className="absolute -top-2 -left-2 z-20 flex items-center justify-center rounded-full shadow-md"
          aria-hidden="true"
          title="Silly word — not a real word, just sound it out!"
          style={{
            width: 24,
            height: 24,
            fontSize: 14,
            lineHeight: 1,
            background: "var(--card-silly-edge)",
            boxShadow: "0 0 0 2px var(--card-paper)",
            opacity: isActive ? 1 : 0.8,
          }}
        >
          👽
        </span>
      )}
    </motion.button>
  );
}
