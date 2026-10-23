/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

export default function PlayPage() {
  const { setTheme } = useTheme();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNonsenseTip, setShowNonsenseTip] = useState(false);

  const gameState = useGameState(profileId);

  // Catalog + owned ids for the reward-pick flow — only loaded once a board is
  // finished (the catalog is ~600 stickers; no need to fetch it every session).
  const needStickers = gameState.showBoardComplete || gameState.showPickCategory;
  const allStickers = useQuery(api.stickersDb.getAll, needStickers ? {} : "skip");
  const profileStickers = useQuery(
    api.stickersDb.getForProfile,
    profileId && needStickers ? { profileId: profileId as Id<"profiles"> } : "skip"
  );
  const ownedStickerIds = useMemo(
    () => new Set((profileStickers ?? []).map((ps: { stickerId: string }) => ps.stickerId)),
    [profileStickers]
  );

  const {
    profile,
    board,
    clearedRows,
    clearedWords,
    activeRow,
    isRolling,
    rollBusy,
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

  // Sync theme from profile through the ThemeProvider so there's a single
  // writer of data-theme (avoids the provider and this page fighting over it).
  useEffect(() => {
    if (profile?.selectedTheme) {
      setTheme(profile.selectedTheme as "ocean" | "space" | "forest" | "candy" | "classic");
    }
  }, [profile?.selectedTheme]);

  // Screen-reader announcements for what the eyes get from animation: which
  // row was rolled, right and wrong taps, and the hint.
  const [announcement, setAnnouncement] = useState("");
  const announce = useCallback((msg: string) => {
    // Clear first so the same message twice in a row is still read.
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(msg));
  }, []);
  const wordText = useCallback(
    (id: string | null) => board?.rows.flatMap((r) => r.words).find((w) => w._id === id)?.word,
    [board]
  );
  useEffect(() => {
    if (activeRow !== null) announce(`Row ${activeRow}. Listen, then tap the word.`);
  }, [activeRow]);
  useEffect(() => {
    const word = wordText(correctWord);
    if (word) announce(`Yes! ${word}.`);
  }, [correctWord]);
  useEffect(() => {
    if (wrongWord) announce("Not that one. Listen again.");
  }, [wrongWord]);
  useEffect(() => {
    const word = wordText(hintWordId);
    if (word) announce(`Hint: the word is ${word}.`);
  }, [hintWordId]);

  // Keep keyboard focus in the game. Cleared cards and the reader picker leave
  // the page, which would drop focus to the top of the page and make keyboard
  // and screen-reader players Tab through the menu again. When focus falls to
  // the page body, move it to the next card in the row, or to the Roll button.
  const gameAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!board) return;
    const t = window.setTimeout(() => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      const area = gameAreaRef.current;
      if (!area) return;
      const next =
        (activeRow !== null &&
          area.querySelector<HTMLButtonElement>('button[aria-label^="Word card"]:not([disabled])')) ||
        area.querySelector<HTMLButtonElement>("[data-roll-button]");
      next?.focus();
    }, 400); // after the card's exit animation
    return () => window.clearTimeout(t);
  }, [board, activeRow, clearedWords, isRolling]);

  // Keyboard support: Spacebar rolls when idle, and repeats the current word
  // while a row is active (you can't roll again until the row is cleared).
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isRolling || rollBusy || !board) return;
      // Never roll behind an open dialog (tutorial, rewards, level-up, ...).
      if (
        showTutorial || showNonsenseTip || showBoardComplete ||
        showPickCategory || showLevelUp || showLevelLocked
      ) {
        return;
      }
      // Don't hijack Space when a control is focused — Space is the native
      // activation key for buttons/word cards/links, which keyboard and
      // screen-reader users rely on. Only use it as a roll/repeat shortcut
      // when focus is on the page body, not an interactive element.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest(
          "button, a, input, textarea, select, [role='button'], [contenteditable='true']"
        )
      ) {
        return;
      }
      e.preventDefault();
      if (activeRow === null) {
        rollDice();
      } else {
        repeatWord();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    isRolling, rollBusy, activeRow, board, rollDice, repeatWord, showTutorial, showNonsenseTip,
    showBoardComplete, showPickCategory, showLevelUp, showLevelLocked,
  ]);

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
    <div className="table-surface flex flex-col flex-1 overflow-hidden">
      {/* Main game area */}
      <div ref={gameAreaRef} className="flex flex-col lg:flex-row flex-1 gap-3 lg:gap-5 p-3 lg:p-6 overflow-auto min-h-0 w-full max-w-[1280px] mx-auto">
        {/* Dice Panel — left on desktop, top on mobile */}
        <div className="lg:w-60 shrink-0">
          <div className="panel lg:sticky lg:top-4">
            <DicePanel
              isRolling={isRolling}
              diceResult={diceResult}
              clearedFaces={clearedRows}
              onRoll={rollDice}
              disabled={activeRow !== null || isRolling || rollBusy}
              rowActive={activeRow !== null}
              onRepeat={repeatWord}
            />
          </div>
        </div>

        {/* Game Board — right on desktop, below dice on mobile */}
        <div className="panel flex-1 min-w-0 self-start w-full">
          {/* Board header: whose board, what to do next, level */}
          <div
            className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b"
            style={{ borderColor: "var(--color-line)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base sm:text-lg font-bold truncate" style={{ color: "var(--color-text-primary)" }}>
                {profile?.name ? `${profile.name}'s board` : "Game board"}
              </h1>
              {boardHasNonsense && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 shrink-0"
                  style={{
                    background: "color-mix(in srgb, var(--card-silly-edge) 14%, transparent)",
                    color: "var(--color-text-secondary)",
                    border: "1px dashed var(--card-silly-edge)",
                  }}
                  title="Cards with an alien are silly (not real) words — just sound them out"
                >
                  <span aria-hidden="true">👽</span>
                  <span className="hidden sm:inline">silly word = sound it out</span>
                  <span className="sm:hidden">silly word</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <p
                className="hidden md:block text-sm font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                {activeRow !== null ? "Listen, then tap the word" : "Roll to pick a row"}
              </p>
              <span
                className="text-xs px-2.5 py-1 rounded-full font-bold"
                style={{ background: "var(--color-brand)", color: "var(--color-on-brand)" }}
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
            onWordTap={handleWordTap}
          />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

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
