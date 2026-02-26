"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Dice3D from "./Dice3D";

interface DicePanelProps {
  isRolling: boolean;
  diceResult: number | null;
  clearedFaces: number[];
  onRoll: () => void;
  disabled: boolean;
}

const ALL_FACES = [1, 2, 3, 4, 5, 6];

export default function DicePanel({
  isRolling,
  diceResult,
  clearedFaces,
  onRoll,
  disabled,
}: DicePanelProps) {
  const canRoll = !isRolling && !disabled;

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* 3D Dice */}
      <motion.div
        animate={
          diceResult && !isRolling
            ? { x: [0, -2, 2, -1, 1, 0], transition: { duration: 0.1 } }
            : {}
        }
      >
        <Dice3D result={diceResult} isRolling={isRolling} />
      </motion.div>

      {/* Roll Button */}
      <motion.button
        onClick={onRoll}
        disabled={!canRoll}
        whileTap={canRoll ? { scale: 0.95 } : {}}
        whileHover={canRoll ? { scale: 1.03 } : {}}
        className={cn(
          "w-full py-3 px-6 rounded-2xl",
          "text-lg font-extrabold uppercase",
          "transition-all duration-200 select-none",
          "min-h-[56px]",
          canRoll
            ? "text-white shadow-lg shadow-indigo-600/40 hover:shadow-indigo-500/60 cursor-pointer"
            : "opacity-50 cursor-not-allowed text-slate-400 bg-slate-700 border border-slate-600"
        )}
        style={
          canRoll
            ? {
                background:
                  "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-secondary) 100%)",
              }
            : {}
        }
        aria-label="Roll the dice"
      >
        {isRolling ? (
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          >
            Rolling...
          </motion.span>
        ) : (
          "🎲 Roll!"
        )}
      </motion.button>

      {/* Face indicators */}
      <div className="flex gap-2" role="group" aria-label="Dice face status">
        {ALL_FACES.map((face) => {
          const isCleared = clearedFaces.includes(face);
          return (
            <div
              key={face}
              className={cn(
                "size-8 rounded-full flex items-center justify-center",
                "text-xs font-bold transition-all duration-300",
                isCleared
                  ? "bg-slate-700 text-slate-500 opacity-50"
                  : "text-white shadow-sm",
                !isCleared && face === diceResult && "ring-2 ring-white"
              )}
              style={
                !isCleared
                  ? { background: "var(--color-brand)" }
                  : {}
              }
              aria-label={`Face ${face}: ${isCleared ? "cleared" : "available"}`}
            >
              {face}
            </div>
          );
        })}
      </div>
    </div>
  );
}
