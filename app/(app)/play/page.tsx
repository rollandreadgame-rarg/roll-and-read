/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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
import PickCategoryModal from "@/components/celebrations/PickCategoryModal";
import LevelUpOverlay from "@/components/celebrations/LevelUpOverlay";
import TutorialModal from "@/components/celebrations/TutorialModal";
import UpgradeModal from "@/components/celebrations/UpgradeModal";
import NonsenseCoachmark from "@/components/celebrations/NonsenseCoachmark";
import type { WordEntry } from "@/lib/game/boardGenerator";

export default function PlayPage() {
  useTheme();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNonsenseTip, setShowNonsenseTip] = useState(false);

  const wordRefs = useRef<Record<string, React.RefObject<HTMLButtonElement | null>>>({});

  const gameState = useGameState(profileId);

  // Catalog + owned ids for the reward-pick flow.
  const allStickers = useQuery(api.stickersDb.getAll);
  const profileStickers = useQuery(
    api.stickersDb.getForProfile,
    profileId ? { profileId: profileId as Id<"profiles"> } : "skip"
  );
  const ownedStickerIds = new Set(
    (profileStickers ?? []).map((ps: { stickerId: string }) => ps.stickerId)
  );

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
    showLevelLocked,
    dismissLevelLocked,
    pendingRewards,
    showPickCategory,
    handleBoardCompletePrimary,
    handleRewardClaimed,
    startNewBoard,
    rollDice,
    repeatWord,
    handleWordTap,
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

  // Does the current board contain any silly (nonsense) words?
  const boardHasNonsense =
    !!board?.rows?.some((r) => r.words.some((w) => w.isNonsense));

  // First-time coaching for silly words — shown once per profile, and never
  // while the tutorial is up so the two don't overlap.
  useEffect(() => {
    if (!profileId || !boardHasNonsense || showTutorial) return;
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(`nonsenseTipSeen:${profileId}`)) {
      setShowNonsenseTip(true);
    }
  }, [profileId, boardHasNonsense, showTutorial]);

  const dismissNonsenseTip = useCallback(() => {
    setShowNonsenseTip(false);
    if (profileId && typeof window !== "undefined") {
      localStorage.setItem(`nonsenseTipSeen:${profileId}`, "1");
    }
  }, [profileId]);

  // Sync theme from profile
  useEffect(() => {
    if (profile?.selectedTheme) {
      document.documentElement.setAttribute("data-theme", profile.selectedTheme);
    }
  }, [profile?.selectedTheme]);

  // Keyboard support: Spacebar rolls when idle, and repeats the current word
  // while a row is active (you can't roll again until the row is cleared).
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isRolling || !board) return;
      // preventDefault also stops Space from "clicking" a focused word card.
      e.preventDefault();
      if (activeRow === null) {
        rollDice();
      } else {
        repeatWord();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isRolling, activeRow, board, rollDice, repeatWord]);

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
      <div className="flex flex-col lg:flex-row flex-1 gap-3 p-3 lg:p-4 overflow-auto min-h-0">
        {/* Dice Panel — left on desktop, top on mobile */}
        <div className="lg:w-52 shrink-0">
          <div
            className="rounded-2xl p-2 h-full"
            style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <DicePanel
              isRolling={isRolling}
              diceResult={diceResult}
              clearedFaces={clearedRows}
              onRoll={rollDice}
              disabled={activeRow !== null || isRolling}
              rowActive={activeRow !== null}
              onRepeat={repeatWord}
            />
          </div>
        </div>

        {/* Game Board — right on desktop, below dice on mobile */}
        <div
          className="flex-1 rounded-2xl min-w-0"
          style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {/* Level label */}
          <div
            className="flex items-center justify-between px-4 py-2 border-b"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text-muted)" }}>
                {profile?.name ? `${profile.name}'s Board` : "Game Board"}
              </span>
              {boardHasNonsense && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 shrink-0"
                  style={{
                    background: "rgba(139,92,246,0.15)",
                    color: "var(--color-text-muted)",
                    border: "1px dashed rgba(139,92,246,0.6)",
                  }}
                  title="Cards with an alien are silly (not real) words — just sound them out"
                >
                  <span aria-hidden="true">👽</span>
                  <span className="hidden sm:inline">silly word = sound it out</span>
                  <span className="sm:hidden">silly word</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeRow !== null && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={repeatWord}
                  className="text-sm font-bold cursor-pointer"
                  style={{ color: "var(--color-brand)" }}
                  aria-label="Hear the word again"
                  title="Tap to hear the word again"
                >
                  🎧 Listen & Tap!
                </motion.button>
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
        pendingRewardCount={boardCompleteData.pendingRewardCount}
        onPrimary={handleBoardCompletePrimary}
      />

      <PickCategoryModal
        show={showPickCategory}
        profileId={profileId}
        reward={pendingRewards[0] ?? null}
        remaining={pendingRewards.length}
        allStickers={allStickers}
        ownedStickerIds={ownedStickerIds}
        onClaimed={handleRewardClaimed}
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

      <UpgradeModal
        show={showLevelLocked}
        reason="You've finished Level 1! Upgrade to unlock Levels 2–5 with all sublevels and the full word library."
        onClose={dismissLevelLocked}
      />

      <NonsenseCoachmark show={showNonsenseTip} onDismiss={dismissNonsenseTip} />
    </div>
  );
}
