"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useGameState } from "@/hooks/useGameState";
import { useTheme } from "@/providers/ThemeProvider";
import { initAudio } from "@/lib/audio/soundManager";
import ProfileSelector from "@/components/game/ProfileSelector";
import GameBoard from "@/components/game/GameBoard";
import DicePanel from "@/components/game/DicePanel";
import StatusBar from "@/components/game/StatusBar";
import CoinPopup from "@/components/game/CoinPopup";
import RowClearBanner from "@/components/celebrations/RowClearBanner";
import BoardCompleteModal from "@/components/celebrations/BoardCompleteModal";
import LevelUpOverlay from "@/components/celebrations/LevelUpOverlay";
import TutorialModal from "@/components/celebrations/TutorialModal";
import type { WordEntry } from "@/lib/game/boardGenerator";
import { Id } from "@/convex/_generated/dataModel";

export default function PlayPage() {
  const { theme } = useTheme();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const wordRefs = useRef<Record<string, React.RefObject<HTMLButtonElement | null>>>({});

  const gameState = useGameState(profileId);

  const {
    profile,
    board,
    clearedRows,
    clearedWords,
    activeRow,
    isRolling,
    diceResult,
    wrongWord,
    correctWord,
    hintWordId,
    coinPopups,
    recentWords,
    localCoins,
    wordBankCount,
    wordBankValue,
    showRowBanner,
    rowBannerData,
    showBoardComplete,
    boardCompleteData,
    showLevelUp,
    levelUpData,
    startNewBoard,
    rollDice,
    handleWordTap,
    handlePlayAgain,
    handleLevelUpClose,
    markTutorialSeen,
    isReady,
  } = gameState;

  // Initialize board when ready
  useEffect(() => {
    if (isReady && !board) {
      initAudio();
      startNewBoard();
    }
  }, [isReady, board]);

  // Show tutorial for first-time players
  useEffect(() => {
    if (profile && !profile.hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, [profile?.hasSeenTutorial]);

  // Sync theme from profile
  useEffect(() => {
    if (profile?.selectedTheme) {
      document.documentElement.setAttribute("data-theme", profile.selectedTheme);
    }
  }, [profile?.selectedTheme]);

  // Keyboard support: Spacebar to roll
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isRolling && activeRow === null && board) {
        e.preventDefault();
        rollDice();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isRolling, activeRow, board, rollDice]);

  const handleWordTapWithRect = useCallback(
    (word: WordEntry) => {
      const ref = wordRefs.current[word._id];
      const rect = ref?.current?.getBoundingClientRect();
      handleWordTap(word, rect);
    },
    [handleWordTap]
  );

  const handleTutorialClose = useCallback(() => {
    setShowTutorial(false);
    markTutorialSeen();
  }, [markTutorialSeen]);

  // Show profile selector if not selected
  if (!profileId) {
    return <ProfileSelector onSelect={setProfileId} />;
  }

  // Loading state
  if (!isReady || !board) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-6xl"
        >
          🎲
        </motion.div>
        <p className="font-semibold" style={{ color: "var(--color-text-muted)" }}>
          Loading your game...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Main game area */}
      <div className="flex flex-col lg:flex-row flex-1 gap-2 p-2 lg:p-4 overflow-auto">
        {/* Dice Panel — left on desktop, top on mobile */}
        <div className="lg:w-48 shrink-0">
          <div
            className="rounded-2xl p-2"
            style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <DicePanel
              isRolling={isRolling}
              diceResult={diceResult}
              clearedFaces={clearedRows}
              onRoll={rollDice}
              disabled={activeRow !== null || isRolling}
            />
          </div>
        </div>

        {/* Game Board — right on desktop, below dice on mobile */}
        <div
          className="flex-1 rounded-2xl overflow-hidden"
          style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {/* Level label */}
          <div
            className="flex items-center justify-between px-4 py-2 border-b"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <span className="text-sm font-semibold" style={{ color: "var(--color-text-muted)" }}>
              {profile?.name ? `${profile.name}'s Board` : "Game Board"}
            </span>
            <div className="flex items-center gap-2">
              {activeRow !== null && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-sm font-bold"
                  style={{ color: "var(--color-brand)" }}
                >
                  🎧 Listen & Tap!
                </motion.span>
              )}
              <span
                className="text-xs px-2 py-1 rounded-full font-bold text-white"
                style={{ background: "var(--color-brand)" }}
              >
                Level {profile?.currentLevel}
              </span>
            </div>
          </div>

          <GameBoard
            board={board}
            activeRow={activeRow}
            clearedWords={clearedWords}
            wrongWord={wrongWord}
            correctWord={correctWord}
            hintWordId={hintWordId}
            onWordTap={handleWordTapWithRect}
            wordRefs={wordRefs.current}
          />
        </div>
      </div>

      {/* Coin popups */}
      {coinPopups.map((popup) => (
        <CoinPopup key={popup.id} {...popup} />
      ))}

      {/* Status Bar */}
      <StatusBar
        coins={localCoins}
        wordCount={wordBankCount}
        wordBankValue={wordBankValue}
        recentWords={recentWords}
        level={profile?.currentLevel ?? "1A"}
      />

      {/* Celebrations */}
      <RowClearBanner
        show={showRowBanner}
        wordsAdded={rowBannerData.words}
        coinsEarned={rowBannerData.coins}
      />

      <BoardCompleteModal
        show={showBoardComplete}
        wordsAdded={boardCompleteData.wordsAdded}
        coinsEarned={boardCompleteData.coinsEarned}
        accuracy={boardCompleteData.accuracy}
        streakDays={profile?.streakDays ?? 0}
        theme={profile?.selectedTheme ?? "ocean"}
        onPlayAgain={handlePlayAgain}
      />

      <LevelUpOverlay
        show={showLevelUp}
        newLevel={levelUpData.newLevel}
        onClose={handleLevelUpClose}
      />

      <TutorialModal
        show={showTutorial}
        onClose={handleTutorialClose}
      />
    </div>
  );
}
