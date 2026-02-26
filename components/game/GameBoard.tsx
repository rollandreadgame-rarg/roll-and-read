"use client";

import { AnimatePresence } from "framer-motion";
import GameRow from "./GameRow";
import type { GameBoard as GameBoardType } from "@/lib/game/boardGenerator";
import type { WordEntry } from "@/lib/game/boardGenerator";

interface GameBoardProps {
  board: GameBoardType;
  activeRow: number | null;
  clearedWords: Set<string>;
  wrongWord: string | null;
  correctWord: string | null;
  hintWordId: string | null;
  onWordTap: (word: WordEntry) => void;
  wordRefs?: Record<string, React.RefObject<HTMLButtonElement | null>>;
}

export default function GameBoard({
  board,
  activeRow,
  clearedWords,
  wrongWord,
  correctWord,
  hintWordId,
  onWordTap,
  wordRefs,
}: GameBoardProps) {
  return (
    <div
      className="flex flex-col gap-1.5 p-3"
      role="region"
      aria-label="Game board"
    >
      <AnimatePresence mode="popLayout">
        {board.rows.map((row) => (
          !row.cleared && (
            <GameRow
              key={row.dieNumber}
              row={row}
              isActive={activeRow === row.dieNumber}
              clearedWords={clearedWords}
              wrongWord={wrongWord}
              correctWord={correctWord}
              hintWordId={hintWordId}
              onWordTap={onWordTap}
              wordRefs={wordRefs}
            />
          )
        ))}
      </AnimatePresence>
    </div>
  );
}
