"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { generateBoard, checkLevelAdvancement, type GameBoard, type WordEntry } from "@/lib/game/boardGenerator";
import { getNextLevel } from "@/lib/utils";
import { speakWord } from "@/lib/tts/webSpeechTTS";
import { playSound } from "@/lib/audio/soundManager";
import { sleep } from "@/lib/utils";

interface SessionStats {
  wordsCorrect: number;
  firstAttemptCorrect: number;
  wordsAttempted: number;
  wordsSkipped: number;
  hintsUsed: number;
  coinsEarned: number;
  startTime: number;
}

interface CoinPopup {
  id: string;
  amount: number;
  x: number;
  y: number;
}

interface RecentWord {
  word: string;
  level: string;
  coinValue: number;
}

export function useGameState(profileId: string | null) {
  const profile = useQuery(
    api.profiles.get,
    profileId ? { profileId: profileId as Id<"profiles"> } : "skip"
  );

  const wordPool = useQuery(
    api.wordLists.getForLevel,
    profile
      ? { level: profile.currentLevel, wordMode: profile.wordMode }
      : "skip"
  );

  const nextLevel = profile ? getNextLevel(profile.currentLevel) : null;
  const nextWordPool = useQuery(
    api.wordLists.getForLevel,
    profile && nextLevel
      ? { level: nextLevel, wordMode: profile.wordMode }
      : "skip"
  );

  const wordBankWords = useQuery(
    api.wordBank.getForProfile,
    profileId ? { profileId: profileId as Id<"profiles"> } : "skip"
  );

  const wordBankValue = useQuery(
    api.wordBank.getTotalValue,
    profileId ? { profileId: profileId as Id<"profiles"> } : "skip"
  );

  // Mutations
  const awardCoinsMut = useMutation(api.profiles.awardCoins);
  const addWordMut = useMutation(api.wordBank.addWord);
  const completedBoardMut = useMutation(api.profiles.completedBoard);
  const advanceLevelMut = useMutation(api.profiles.advanceLevel);
  const saveSessionMut = useMutation(api.gameSessions.save);
  const updateProfileMut = useMutation(api.profiles.update);

  // Local game state
  const [board, setBoard] = useState<GameBoard | null>(null);
  const [clearedRows, setClearedRows] = useState<number[]>([]);
  const [clearedWords, setClearedWords] = useState<Set<string>>(new Set());
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [diceResult, setDiceResult] = useState<number | null>(null);

  // Word identification state
  const [currentTarget, setCurrentTarget] = useState<WordEntry | null>(null);
  const [wrongWord, setWrongWord] = useState<string | null>(null);
  const [correctWord, setCorrectWord] = useState<string | null>(null);
  const [hintWordId, setHintWordId] = useState<string | null>(null);
  const [attemptsThisWord, setAttemptsThisWord] = useState(0);

  // UI feedback
  const [coinPopups, setCoinPopups] = useState<CoinPopup[]>([]);
  const [recentWords, setRecentWords] = useState<RecentWord[]>([]);
  const [localCoins, setLocalCoins] = useState(0);

  // Celebration state
  const [showRowBanner, setShowRowBanner] = useState(false);
  const [rowBannerData, setRowBannerData] = useState({ words: 0, coins: 0 });
  const [showBoardComplete, setShowBoardComplete] = useState(false);
  const [boardCompleteData, setBoardCompleteData] = useState({
    wordsAdded: 0,
    coinsEarned: 0,
    accuracy: 0,
  });
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState({ newLevel: "" });

  // Session tracking
  const sessionRef = useRef<SessionStats>({
    wordsCorrect: 0,
    firstAttemptCorrect: 0,
    wordsAttempted: 0,
    wordsSkipped: 0,
    hintsUsed: 0,
    coinsEarned: 0,
    startTime: Date.now(),
  });
  const rowWordCountRef = useRef<{ words: number; coins: number }>({ words: 0, coins: 0 });

  // Initialize coins from profile
  useEffect(() => {
    if (profile && localCoins === 0) {
      setLocalCoins(profile.coins);
    }
  }, [profile?.coins]);

  // Start a new board
  const startNewBoard = useCallback(() => {
    if (!wordPool || !profile) return;

    const newBoard = generateBoard({
      currentLevel: profile.currentLevel,
      boardsCleared: profile.boardsClearedAtLevel,
      wordPool: wordPool as WordEntry[],
      nextLevelPool: (nextWordPool ?? []) as WordEntry[],
    });

    setBoard(newBoard);
    setClearedRows([]);
    setClearedWords(new Set());
    setActiveRow(null);
    setDiceResult(null);
    setCurrentTarget(null);
    setWrongWord(null);
    setCorrectWord(null);
    setHintWordId(null);
    sessionRef.current = {
      wordsCorrect: 0,
      firstAttemptCorrect: 0,
      wordsAttempted: 0,
      wordsSkipped: 0,
      hintsUsed: 0,
      coinsEarned: 0,
      startTime: Date.now(),
    };
  }, [wordPool, profile, nextWordPool]);

  // Roll the dice
  const rollDice = useCallback(async () => {
    if (isRolling || !board || activeRow !== null) return;

    const available = [1, 2, 3, 4, 5, 6].filter((f) => !clearedRows.includes(f));
    if (available.length === 0) return;

    setIsRolling(true);
    playSound("diceRoll");

    const result = available[Math.floor(Math.random() * available.length)];
    await sleep(1400); // Dice animation duration

    setDiceResult(result);
    setIsRolling(false);
    playSound("diceLand");

    await sleep(500); // Dramatic pause

    setActiveRow(result);

    // Speak first word in the row
    const row = board.rows.find((r) => r.dieNumber === result);
    if (row) {
      const remaining = row.words.filter((w) => !clearedWords.has(w._id));
      if (remaining.length > 0) {
        const target = remaining[Math.floor(Math.random() * remaining.length)];
        setCurrentTarget(target);
        setAttemptsThisWord(0);
        rowWordCountRef.current = { words: 0, coins: 0 };
        await sleep(300);
        speakWord(target.word);
      }
    }
  }, [isRolling, board, activeRow, clearedRows, clearedWords]);

  // Handle word tap
  const handleWordTap = useCallback(
    async (tappedWord: WordEntry, cardRect?: DOMRect) => {
      if (!currentTarget || !profile || !profileId) return;

      sessionRef.current.wordsAttempted++;

      if (tappedWord._id === currentTarget._id) {
        // CORRECT
        const wasFirstAttempt = attemptsThisWord === 0;
        if (wasFirstAttempt) sessionRef.current.firstAttemptCorrect++;
        sessionRef.current.wordsCorrect++;
        sessionRef.current.coinsEarned += currentTarget.coinValue;

        // Visual feedback
        setCorrectWord(currentTarget._id);
        setHintWordId(null);
        playSound("correct");

        // Coin popup
        if (cardRect) {
          const popup: CoinPopup = {
            id: `${Date.now()}-${Math.random()}`,
            amount: currentTarget.coinValue,
            x: cardRect.left + cardRect.width / 2,
            y: cardRect.top,
          };
          setCoinPopups((prev) => [...prev, popup]);
          setTimeout(() => {
            setCoinPopups((prev) => prev.filter((p) => p.id !== popup.id));
          }, 900);
        }

        // Optimistic coin update
        setLocalCoins((c) => c + currentTarget.coinValue);
        rowWordCountRef.current.words++;
        rowWordCountRef.current.coins += currentTarget.coinValue;

        // Update word list
        const newCleared = new Set(clearedWords).add(currentTarget._id);
        setClearedWords(newCleared);

        // Add to recent words
        setRecentWords((prev) => [
          { word: currentTarget.word, level: currentTarget.level, coinValue: currentTarget.coinValue },
          ...prev.slice(0, 19),
        ]);

        // Persist to Convex (optimistic)
        awardCoinsMut({
          profileId: profileId as Id<"profiles">,
          amount: currentTarget.coinValue,
        }).catch(console.error);

        addWordMut({
          profileId: profileId as Id<"profiles">,
          wordId: currentTarget._id as Id<"word_lists">,
          word: currentTarget.word,
          level: currentTarget.level,
          isNonsense: currentTarget.isNonsense,
          coinValue: currentTarget.coinValue,
          needsPractice: false,
        }).catch(console.error);

        await sleep(200);
        setCorrectWord(null);
        playSound("wordFly");

        // Check if row is done
        const row = board?.rows.find((r) => r.dieNumber === activeRow);
        if (row) {
          const remainingInRow = row.words.filter(
            (w) => !newCleared.has(w._id)
          );
          if (remainingInRow.length === 0) {
            // Row complete
            await sleep(400);
            handleRowComplete(activeRow!);
          } else {
            // Next word
            await sleep(400);
            const nextTarget = remainingInRow[Math.floor(Math.random() * remainingInRow.length)];
            setCurrentTarget(nextTarget);
            setAttemptsThisWord(0);
            setWrongWord(null);
            speakWord(nextTarget.word);
          }
        }
      } else {
        // WRONG
        const newAttempts = attemptsThisWord + 1;
        setAttemptsThisWord(newAttempts);
        setWrongWord(tappedWord._id);
        playSound("wrong");

        const speakRate = newAttempts >= 2 ? 0.7 : 0.85;

        // Hint system
        if (newAttempts === 3) {
          setHintWordId(currentTarget._id);
          sessionRef.current.hintsUsed++;
          setTimeout(() => setHintWordId(null), 1000);
        } else if (newAttempts >= 5) {
          setHintWordId(currentTarget._id);
          sessionRef.current.hintsUsed++;
        }

        // After 7 attempts, skip word
        if (newAttempts >= 7) {
          sessionRef.current.wordsSkipped++;
          setHintWordId(null);

          // Mark as needs practice
          addWordMut({
            profileId: profileId as Id<"profiles">,
            wordId: currentTarget._id as Id<"word_lists">,
            word: currentTarget.word,
            level: currentTarget.level,
            isNonsense: currentTarget.isNonsense,
            coinValue: currentTarget.coinValue,
            needsPractice: true,
          }).catch(console.error);

          // Move to next word
          const newCleared = new Set(clearedWords).add(currentTarget._id);
          setClearedWords(newCleared);
          setWrongWord(null);

          const row = board?.rows.find((r) => r.dieNumber === activeRow);
          if (row) {
            const remaining = row.words.filter((w) => !newCleared.has(w._id));
            if (remaining.length === 0) {
              handleRowComplete(activeRow!);
            } else {
              await sleep(500);
              const nextTarget = remaining[Math.floor(Math.random() * remaining.length)];
              setCurrentTarget(nextTarget);
              setAttemptsThisWord(0);
              speakWord(nextTarget.word, speakRate);
            }
          }
          return;
        }

        await sleep(350);
        setWrongWord(null);
        await sleep(450);
        speakWord(currentTarget.word, speakRate);
      }
    },
    [currentTarget, attemptsThisWord, clearedWords, board, activeRow, profile, profileId]
  );

  // Handle row complete
  const handleRowComplete = useCallback(
    async (rowNumber: number) => {
      playSound("rowComplete");

      // Show banner
      setRowBannerData(rowWordCountRef.current);
      setShowRowBanner(true);
      setTimeout(() => setShowRowBanner(false), 2500);

      // Mark row cleared
      const newClearedRows = [...clearedRows, rowNumber];
      setClearedRows(newClearedRows);
      setActiveRow(null);
      setCurrentTarget(null);

      // Update board row as cleared
      if (board) {
        const updatedRows = board.rows.map((r) =>
          r.dieNumber === rowNumber ? { ...r, cleared: true } : r
        );
        setBoard({ ...board, rows: updatedRows });
      }

      await sleep(600);

      if (newClearedRows.length === 6) {
        // Board complete
        await handleBoardComplete(newClearedRows);
      }
    },
    [clearedRows, board, profile, profileId]
  );

  // Handle board complete
  const handleBoardComplete = useCallback(
    async (finalClearedRows: number[]) => {
      if (!profile || !profileId) return;
      const sess = sessionRef.current;
      const duration = Math.round((Date.now() - sess.startTime) / 1000);
      const accuracy =
        sess.wordsCorrect > 0 ? sess.firstAttemptCorrect / sess.wordsCorrect : 0;

      playSound("boardComplete");

      await sleep(500);

      setBoardCompleteData({
        wordsAdded: sess.wordsCorrect,
        coinsEarned: sess.coinsEarned,
        accuracy,
      });
      setShowBoardComplete(true);

      // Save to Convex
      completedBoardMut({
        profileId: profileId as Id<"profiles">,
        accuracy,
      }).catch(console.error);

      saveSessionMut({
        profileId: profileId as Id<"profiles">,
        level: profile.currentLevel,
        boardsPlayed: 1,
        wordsCorrect: sess.wordsCorrect,
        firstAttemptCorrect: sess.firstAttemptCorrect,
        wordsAttempted: sess.wordsAttempted,
        wordsSkipped: sess.wordsSkipped,
        hintsUsed: sess.hintsUsed,
        coinsEarned: sess.coinsEarned,
        stickersEarned: 0,
        duration,
      }).catch(console.error);

      // Check for level advancement
      const newBoardsCleared = (profile.boardsClearedAtLevel || 0) + 1;
      const newHistory = [...(profile.accuracyHistory || []), accuracy].slice(-10);
      if (checkLevelAdvancement(newBoardsCleared, newHistory)) {
        const next = getNextLevel(profile.currentLevel);
        if (next) {
          setTimeout(async () => {
            setShowBoardComplete(false);
            await sleep(300);
            setLevelUpData({ newLevel: next });
            setShowLevelUp(true);
            advanceLevelMut({
              profileId: profileId as Id<"profiles">,
              nextLevel: next,
            }).catch(console.error);
            playSound("levelUp");
          }, 3000);
        }
      }
    },
    [profile, profileId]
  );

  const handlePlayAgain = useCallback(() => {
    setShowBoardComplete(false);
    startNewBoard();
  }, [startNewBoard]);

  const handleLevelUpClose = useCallback(() => {
    setShowLevelUp(false);
    startNewBoard();
  }, [startNewBoard]);

  const markTutorialSeen = useCallback(() => {
    if (!profileId) return;
    updateProfileMut({
      profileId: profileId as Id<"profiles">,
      hasSeenTutorial: true,
    }).catch(console.error);
  }, [profileId]);

  return {
    // Data
    profile,
    board,
    clearedRows,
    clearedWords,
    activeRow,
    isRolling,
    diceResult,
    currentTarget,
    wrongWord,
    correctWord,
    hintWordId,
    coinPopups,
    recentWords,
    localCoins,
    wordBankCount: wordBankWords?.length ?? 0,
    wordBankValue: wordBankValue ?? 0,
    // Celebrations
    showRowBanner,
    rowBannerData,
    showBoardComplete,
    boardCompleteData,
    showLevelUp,
    levelUpData,
    // Actions
    startNewBoard,
    rollDice,
    handleWordTap,
    handlePlayAgain,
    handleLevelUpClose,
    markTutorialSeen,
    isReady: !!wordPool && !!profile,
  };
}
