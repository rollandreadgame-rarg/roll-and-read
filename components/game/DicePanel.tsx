"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Dice3D from "./Dice3D";
import MiniDie from "./MiniDie";

interface DicePanelProps {
  isRolling: boolean;
  diceResult: number | null;
  clearedFaces: number[];
  onRoll: () => void;
  disabled: boolean;
  rowActive: boolean;
  onRepeat: () => void;
}

const ALL_FACES = [1, 2, 3, 4, 5, 6];

export default function DicePanel({
  isRolling,
  diceResult,
  clearedFaces,
  onRoll,
  disabled,
  rowActive,
  onRepeat,
}: DicePanelProps) {
  const canRoll = !isRolling && !disabled;
  // While a row is active you can't roll again — so the Roll button's spot
  // becomes the "Hear it again" replay button instead.
  const showRepeat = rowActive && !isRolling;

  return (
    <div className="flex flex-row lg:flex-col items-center gap-4 lg:gap-5 p-3 lg:p-5">
      {/* 3D Dice */}
      <motion.div
        className="shrink-0 py-1"
        animate={
          diceResult && !isRolling
            ? { x: [0, -2, 2, -1, 1, 0], transition: { duration: 0.1 } }
            : {}
        }
      >
        <Dice3D result={diceResult} isRolling={isRolling} />
      </motion.div>

      <div className="flex flex-col gap-3 flex-1 w-full min-w-0">
        {/* Roll Button — becomes "Hear it again" while a row is active */}
        {/* aria-disabled, not disabled, while rolling: a disabled button
            drops keyboard focus, and the same button becomes "Hear it again". */}
        <motion.button
          data-roll-button
          onClick={showRepeat ? onRepeat : canRoll ? onRoll : undefined}
          aria-disabled={!showRepeat && !canRoll}
          className={cn(
            "btn-primary w-full py-3 px-4 min-h-[56px]",
            "text-lg font-extrabold select-none",
            "flex items-center justify-center gap-2"
          )}
          aria-label={showRepeat ? "Hear the word again" : "Roll the dice"}
        >
          {isRolling ? (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              Rolling…
            </motion.span>
          ) : showRepeat ? (
            <>
              <span aria-hidden="true">🔊</span> Hear it again
            </>
          ) : (
            <>
              <span aria-hidden="true">🎲</span> Roll
            </>
          )}
        </motion.button>

        {/* Written instruction: how to repeat the spoken word */}
        <p
          className="hidden lg:block text-center text-sm leading-snug"
          style={{ color: "var(--color-text-muted)" }}
        >
          {showRepeat ? "Press space to hear it again" : "Press space to roll"}
        </p>

        {/* Face tracker: which rows are still to play */}
        <div
          className="grid grid-cols-6 gap-1.5 w-full"
          role="group"
          aria-label="Rows left to play"
          style={{ color: "var(--color-text-muted)" }}
        >
          {ALL_FACES.map((face) => {
            const isCleared = clearedFaces.includes(face);
            const isCurrent = !isCleared && face === diceResult;
            return (
              <div
                key={face}
                className={cn(
                  "relative aspect-square rounded-lg flex items-center justify-center transition-opacity duration-300",
                  isCleared && "opacity-35"
                )}
                style={
                  isCurrent
                    ? { boxShadow: "0 0 0 2px var(--color-highlight)" }
                    : undefined
                }
                aria-label={`Row ${face}: ${isCleared ? "done" : "to play"}`}
                role="img"
              >
                <MiniDie face={face} tone={isCleared ? "dim" : "lit"} className="w-full h-full" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
