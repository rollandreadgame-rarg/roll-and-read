/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { generateBoard, type GameBoard, type WordEntry } from "@/lib/game/boardGenerator";
import type { MilestoneTrigger } from "@/lib/game/milestones";
import { parseSavedBoard, savedBoardKey, type SavedBoard } from "@/lib/game/savedBoard";
import { getNextLevel, isValidLevel, normalizeLevel } from "@/lib/levels";
import { isLevelAllowed, type Plan } from "@/convex/subscriptionConfig";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { speakWord, cancelSpeech, preloadWords } from "@/lib/tts/webSpeechTTS";
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

// Player's local calendar day, for streaks (the server compares these strings).
function localDateString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function useGameState(profileId: string | null) {
  const profile = useQuery(
    api.profiles.get,
    profileId ? { profileId: profileId as Id<"profiles"> } : "skip"
  );

  // The plan decides whether the next sublevel may be previewed / unlocked.
  const { user } = useCurrentUser();
  const account = useQuery(api.users.getByClerkId, user?.id ? { clerkId: user.id } : "skip");
  const plan = (account?.plan ?? "free") as Plan;

  // A reader stranded on a retired sublevel plays the level it maps to (and is
  // moved there for real by the effect below).
  const level = profile ? normalizeLevel(profile.currentLevel) : null;

  const wordPool = useQuery(
    api.wordLists.getForLevel,
    profile && level ? { level, wordMode: profile.wordMode } : "skip"
  );

  // Nonsense-only mode has too few words per sublevel to fill a 30-card board;
  // the rest of the board is filled from the same level's real words.
  const fillPool = useQuery(
    api.wordLists.getForLevel,
    profile && level && profile.wordMode === "nonsense" ? { level, wordMode: "real" } : "skip"
  );

  const nextLevel = level ? getNextLevel(level) : null;
  const canAdvance = !!nextLevel && account !== undefined && isLevelAllowed(plan, nextLevel);
  const nextWordPool = useQuery(
    api.wordLists.getForLevel,
    profile && nextLevel && canAdvance
      ? { level: nextLevel, wordMode: profile.wordMode === "nonsense" ? "mixed" : profile.wordMode }
      : "skip"
  );

  // Review words from earlier sublevels. The seed rotates the older levels
  // every 3 boards; the last result is kept while a new one loads so a board
  // never starts without review words just because the query is in flight.
  const reviewSeed = profile ? Math.floor(profile.totalBoardsCleared / 3) : 0;
  const reviewQuery = useQuery(
    api.wordLists.getReviewPool,
    profile && level ? { level, wordMode: profile.wordMode, seed: reviewSeed } : "skip"
  );
  const [reviewCache, setReviewCache] = useState<{ level: string; words: WordEntry[] } | null>(null);
  useEffect(() => {
    if (reviewQuery && level) setReviewCache({ level, words: reviewQuery as WordEntry[] });
  }, [reviewQuery, level]);
  const reviewReady = !!level && reviewCache?.level === level;
  const reviewPool = reviewReady ? reviewCache!.words : [];

  // Words this reader is still practising come back on the board.
  const practiceWords = useQuery(
    api.wordBank.getPracticeWords,
    profileId ? { profileId: profileId as Id<"profiles"> } : "skip"
  );

  const wordBankStats = useQuery(
    api.wordBank.getStats,
    profileId ? { profileId: profileId as Id<"profiles"> } : "skip"
  );

  // Mutations
  const startBoardMut = useMutation(api.profiles.startBoard);
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

  // Async-safety for the tap/roll handlers, which sleep between steps:
  // - turnRef bumps whenever the target word changes; a continuation that
  //   wakes up in a different turn stops instead of speaking a stale word.
  // - busyRef locks taps while a correct answer / skip is resolving.
  // - rollingRef locks rolling from the click until the row is active.
  // - wrongTapRef lets only the latest wrong tap re-speak the word.
  // - attemptsRef/clearedRef mirror state so rapid taps never read stale values.
  const turnRef = useRef(0);
  const busyRef = useRef(false);
  const rollingRef = useRef(false);
  const wrongTapRef = useRef(0);
  const attemptsRef = useRef(0);
  const clearedRef = useRef<Set<string>>(new Set());
  const [rollBusy, setRollBusy] = useState(false);

  const setTarget = (t: WordEntry | null) => {
    turnRef.current++;
    attemptsRef.current = 0;
    setCurrentTarget(t);
  };
  const commitCleared = (next: Set<string>) => {
    clearedRef.current = next;
    setClearedWords(next);
  };

  // Stop speech and any pending continuation when leaving the play page.
  useEffect(() => () => {
    turnRef.current++;
    cancelSpeech();
  }, []);

  // UI feedback
  const [coinPopups, setCoinPopups] = useState<CoinPopup[]>([]);
  const [recentWords, setRecentWords] = useState<RecentWord[]>([]);
  const [localCoins, setLocalCoins] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showLevelLocked, setShowLevelLocked] = useState(false);

  // Celebration state
  const [showRowBanner, setShowRowBanner] = useState(false);
  const [rowBannerData, setRowBannerData] = useState({ words: 0, coins: 0 });
  const [showBoardComplete, setShowBoardComplete] = useState(false);
  const [boardCompleteData, setBoardCompleteData] = useState<{
    wordsAdded: number;
    coinsEarned: number;
    accuracy: number;
    pendingRewardCount: number;
  }>({
    wordsAdded: 0,
    coinsEarned: 0,
    accuracy: 0,
    pendingRewardCount: 0,
  });
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState({ newLevel: "" });

  // Reward-choice queue: milestones become "pick a category" prompts after the
  // board-complete modal. Level-up is deferred until the picks are claimed.
  const [pendingRewards, setPendingRewards] = useState<MilestoneTrigger[]>([]);
  const [showPickCategory, setShowPickCategory] = useState(false);
  const deferredLevelUpRef = useRef<string | null>(null);
  // Free reader who earned the next level: show the upgrade prompt after the
  // rewards (not on top of them), at most once per session.
  const deferredLockedRef = useRef(false);
  const lockPromptShownRef = useRef(false);

  const restoredPicksRef = useRef(false);
  const restoreCheckedRef = useRef<string | null>(null);

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

  // Mutation wrapper: retry once, then surface error.
  // Tier-gating errors thrown by the backend (LEVEL_LOCKED, PROFILE_LIMIT_REACHED)
  // surface as an upgrade prompt rather than a generic save error.
  const safeMutate = useCallback(
    async <T,>(fn: () => Promise<T>, label: string): Promise<T | undefined> => {
      const isGatingError = (err: unknown) =>
        err instanceof Error &&
        (err.message.includes("LEVEL_LOCKED") || err.message.includes("PROFILE_LIMIT_REACHED"));

      try {
        return await fn();
      } catch (e) {
        if (isGatingError(e)) {
          setShowLevelLocked(true);
          return undefined;
        }
        // Retry once
        try {
          return await fn();
        } catch (retryErr) {
          if (isGatingError(retryErr)) {
            setShowLevelLocked(true);
            return undefined;
          }
          console.error(`[${label}] mutation failed after retry:`, retryErr);
          setSaveError("Couldn't save — check your connection");
          setTimeout(() => setSaveError(null), 4000);
          return undefined;
        }
      }
    },
    []
  );

  // Initialize coins from profile
  useEffect(() => {
    if (profile && localCoins === 0) {
      setLocalCoins(profile.coins);
    }
  }, [profile?.coins]);

  // Move a reader off a retired sublevel (the server allows exactly this move).
  const repairingLevelRef = useRef(false);
  useEffect(() => {
    if (!profile || !profileId || isValidLevel(profile.currentLevel) || repairingLevelRef.current) return;
    repairingLevelRef.current = true;
    safeMutate(
      () => advanceLevelMut({ profileId: profileId as Id<"profiles">, nextLevel: normalizeLevel(profile.currentLevel) }),
      "repairLevel"
    );
  }, [profile?.currentLevel, profileId]);

  // The board in progress is saved per reader on this device (see
  // lib/game/savedBoard.ts); the first board after arriving resumes it.
  const boardKey = profileId ? savedBoardKey(profileId) : null;
  const resumeCheckedRef = useRef<string | null>(null);
  const tryResumeBoard = (): boolean => {
    if (!boardKey || !profile || !level || resumeCheckedRef.current === boardKey) return false;
    resumeCheckedRef.current = boardKey;
    let saved: SavedBoard | null = null;
    try {
      saved = parseSavedBoard(localStorage.getItem(boardKey), {
        level,
        wordMode: profile.wordMode,
        now: Date.now(),
      });
    } catch {
      saved = null;
    }
    if (!saved) return false;
    preloadWords(saved.board.rows.flatMap((r) => r.words.map((w) => w.word)));
    busyRef.current = false;
    rollingRef.current = false;
    setRollBusy(false);
    setBoard(saved.board);
    setClearedRows(saved.clearedRows);
    commitCleared(new Set(saved.clearedWords));
    setActiveRow(saved.activeRow);
    setDiceResult(saved.activeRow);
    const words = saved.board.rows.flatMap((r) => r.words);
    // Not spoken here: iPhone/iPad only play audio after a tap, so the reader
    // taps "Hear the word again".
    setTarget(words.find((w) => w._id === saved.targetId) ?? null);
    setWrongWord(null);
    setCorrectWord(null);
    setHintWordId(null);
    sessionRef.current = { ...saved.session };
    rowWordCountRef.current = { words: 0, coins: 0 };
    return true;
  };

  useEffect(() => {
    if (!boardKey || !board || !level || !profile) return;
    try {
      if (clearedRows.length >= 6) {
        localStorage.removeItem(boardKey);
        return;
      }
      const saved: SavedBoard = {
        v: 1,
        level,
        wordMode: profile.wordMode,
        savedAt: Date.now(),
        board,
        clearedRows,
        clearedWords: [...clearedWords],
        activeRow,
        targetId: currentTarget?._id ?? null,
        session: { ...sessionRef.current },
      };
      localStorage.setItem(boardKey, JSON.stringify(saved));
    } catch {
      // Storage unavailable (private mode): the board just won't survive a reload.
    }
  }, [boardKey, board, clearedRows, clearedWords, activeRow, currentTarget, wrongWord]);

  // Start a new board
  const startNewBoard = useCallback(() => {
    if (!wordPool || !profile || !level || !reviewReady || practiceWords === undefined) return;
    if (profile.wordMode === "nonsense" && fillPool === undefined) return;
    if (tryResumeBoard()) return;

    const newBoard = generateBoard({
      currentLevel: level,
      boardsCleared: profile.boardsClearedAtLevel,
      wordPool: wordPool as WordEntry[],
      nextLevelPool: canAdvance ? ((nextWordPool ?? []) as WordEntry[]) : [],
      fillPool: (fillPool ?? []) as WordEntry[],
      recentAccuracy: profile.accuracyHistory ?? [],
      reviewPool,
      practicePool: (practiceWords ?? []) as WordEntry[],
    });
    preloadWords(newBoard.rows.flatMap((r) => r.words.map((w) => w.word)));
    if (profileId) {
      safeMutate(() => startBoardMut({ profileId: profileId as Id<"profiles"> }), "startBoard");
    }

    busyRef.current = false;
    rollingRef.current = false;
    setRollBusy(false);
    setBoard(newBoard);
    setClearedRows([]);
    commitCleared(new Set());
    setActiveRow(null);
    setDiceResult(null);
    setTarget(null);
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
  }, [wordPool, fillPool, profile, level, nextWordPool, canAdvance, reviewPool, reviewReady, practiceWords]);

  // Roll the dice
  const rollDice = useCallback(async () => {
    if (rollingRef.current || !board || activeRow !== null) return;

    // Cross-check both clearedRows state AND each row's cleared flag on the board
    const available = board.rows
      .filter((r) => !r.cleared && !clearedRows.includes(r.dieNumber))
      .map((r) => r.dieNumber);
    if (available.length === 0) return;

    // Locked from the click until the row is active — the Roll button would
    // otherwise re-enable in the gap between the dice landing and activation.
    rollingRef.current = true;
    setRollBusy(true);
    const turn = turnRef.current;
    try {
      setIsRolling(true);
      playSound("diceRoll");

      const result = available[Math.floor(Math.random() * available.length)];
      await sleep(1400); // Dice animation duration

      setDiceResult(result);
      setIsRolling(false);
      playSound("diceLand");

      await sleep(500); // Dramatic pause
      if (turnRef.current !== turn) return; // board changed / page left

      // Safety check: verify row is still uncleared before activating
      const row = board.rows.find((r) => r.dieNumber === result && !r.cleared);
      if (!row) return;

      const remaining = row.words.filter((w) => !clearedRef.current.has(w._id));
      // If the row has no words left (shouldn't happen with new boards), auto-clear it
      if (remaining.length === 0) {
        await handleRowCompleteRef.current(result);
        return;
      }

      setActiveRow(result);

      const target = remaining[Math.floor(Math.random() * remaining.length)];
      setTarget(target);
      rowWordCountRef.current = { words: 0, coins: 0 };
      const speakTurn = turnRef.current;
      await sleep(300);
      if (turnRef.current === speakTurn) speakWord(target.word);
    } finally {
      rollingRef.current = false;
      setRollBusy(false);
    }
  }, [board, activeRow, clearedRows]);

  // Re-speak the word the player is currently looking for (spacebar / on-screen
  // "Hear it again" button). No-op unless a row is active and not mid-roll.
  const repeatWord = useCallback(() => {
    if (activeRow === null || !currentTarget || rollingRef.current || busyRef.current) return;
    speakWord(currentTarget.word);
  }, [activeRow, currentTarget]);

  // Handle word tap
  const handleWordTap = useCallback(
    async (tappedWord: WordEntry, cardRect?: DOMRect) => {
      if (!currentTarget || !profile || !profileId || busyRef.current) return;
      const target = currentTarget;
      const turn = turnRef.current;

      sessionRef.current.wordsAttempted++;

      if (tappedWord._id === target._id) {
        // CORRECT — lock input until the next word (or row clear) is set up.
        busyRef.current = true;
        try {
          const misses = attemptsRef.current;
          const wasFirstAttempt = misses === 0;
          if (wasFirstAttempt) sessionRef.current.firstAttemptCorrect++;
          sessionRef.current.wordsCorrect++;
          sessionRef.current.coinsEarned += target.coinValue;

          // Visual feedback
          setCorrectWord(target._id);
          setHintWordId(null);
          setWrongWord(null);
          playSound("correct");

          // Coin popup
          if (cardRect) {
            const popup: CoinPopup = {
              id: `${Date.now()}-${Math.random()}`,
              amount: target.coinValue,
              x: cardRect.left + cardRect.width / 2,
              y: cardRect.top,
            };
            setCoinPopups((prev) => [...prev, popup]);
            setTimeout(() => {
              setCoinPopups((prev) => prev.filter((p) => p.id !== popup.id));
            }, 900);
          }

          // Optimistic coin update
          setLocalCoins((c) => c + target.coinValue);
          rowWordCountRef.current.words++;
          rowWordCountRef.current.coins += target.coinValue;

          // Update word list
          const newCleared = new Set(clearedRef.current).add(target._id);
          commitCleared(newCleared);

          // Add to recent words
          setRecentWords((prev) => [
            { word: target.word, level: target.level, coinValue: target.coinValue },
            ...prev.slice(0, 19),
          ]);

          // Persist to Convex (optimistic with retry). The server pays the
          // word's coins when it banks the word.
          safeMutate(
            () => addWordMut({
              profileId: profileId as Id<"profiles">,
              wordId: target._id as Id<"word_lists">,
              word: target.word,
              level: target.level,
              isNonsense: target.isNonsense,
              coinValue: target.coinValue,
              needsPractice: false,
              missesBeforeCorrect: misses,
            }),
            "addWord"
          );

          await sleep(200);
          if (turnRef.current !== turn) return;
          setCorrectWord(null);
          playSound("wordFly");

          // Check if row is done
          const row = board?.rows.find((r) => r.dieNumber === activeRow);
          if (row) {
            const remainingInRow = row.words.filter((w) => !newCleared.has(w._id));
            await sleep(400);
            if (turnRef.current !== turn) return;
            if (remainingInRow.length === 0) {
              await handleRowCompleteRef.current(activeRow!);
            } else {
              const nextTarget = remainingInRow[Math.floor(Math.random() * remainingInRow.length)];
              setTarget(nextTarget);
              speakWord(nextTarget.word);
            }
          }
        } finally {
          busyRef.current = false;
        }
        return;
      }

      // WRONG
      const newAttempts = ++attemptsRef.current;
      const myTap = ++wrongTapRef.current;
      setWrongWord(tappedWord._id);
      playSound("wrong");

      const speakRate = newAttempts >= 2 ? 0.7 : 0.85;

      // Hint system
      if (newAttempts === 3) {
        setHintWordId(target._id);
        sessionRef.current.hintsUsed++;
        setTimeout(() => {
          if (turnRef.current === turn) setHintWordId(null);
        }, 1000);
      } else if (newAttempts >= 5) {
        setHintWordId(target._id);
        sessionRef.current.hintsUsed++;
      }

      // After 7 attempts, skip word
      if (newAttempts >= 7) {
        busyRef.current = true;
        try {
          sessionRef.current.wordsSkipped++;
          setHintWordId(null);

          // Mark as needs practice
          safeMutate(
            () => addWordMut({
              profileId: profileId as Id<"profiles">,
              wordId: target._id as Id<"word_lists">,
              word: target.word,
              level: target.level,
              isNonsense: target.isNonsense,
              coinValue: target.coinValue,
              needsPractice: true,
            }),
            "addWord:needsPractice"
          );

          // Move to next word
          const newCleared = new Set(clearedRef.current).add(target._id);
          commitCleared(newCleared);
          setWrongWord(null);

          const row = board?.rows.find((r) => r.dieNumber === activeRow);
          if (row) {
            const remaining = row.words.filter((w) => !newCleared.has(w._id));
            if (remaining.length === 0) {
              await handleRowCompleteRef.current(activeRow!);
            } else {
              await sleep(500);
              if (turnRef.current !== turn) return;
              const nextTarget = remaining[Math.floor(Math.random() * remaining.length)];
              setTarget(nextTarget);
              speakWord(nextTarget.word, speakRate);
            }
          }
        } finally {
          busyRef.current = false;
        }
        return;
      }

      // Re-speak — only if this is still the same word AND no newer wrong tap
      // has happened (mashing cards must not queue a pile of replays).
      await sleep(350);
      if (turnRef.current !== turn) return;
      if (wrongTapRef.current === myTap) setWrongWord(null);
      await sleep(450);
      if (turnRef.current !== turn || wrongTapRef.current !== myTap || busyRef.current) return;
      speakWord(target.word, speakRate);
    },
    [currentTarget, board, activeRow, profile, profileId]
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
      setTarget(null);
      const turn = turnRef.current;

      // Update board row as cleared
      if (board) {
        const updatedRows = board.rows.map((r) =>
          r.dieNumber === rowNumber ? { ...r, cleared: true } : r
        );
        setBoard({ ...board, rows: updatedRows });
      }

      await sleep(600);
      if (turnRef.current !== turn) return;

      if (newClearedRows.length === 6) {
        // Board complete
        await handleBoardComplete(newClearedRows);
      } else if (newClearedRows.length === 5) {
        // Auto-activate the one remaining row — no roll needed
        const lastRow = board?.rows.find((r) => !newClearedRows.includes(r.dieNumber));
        if (lastRow) {
          const remaining = lastRow.words.filter((w) => !clearedRef.current.has(w._id));
          if (remaining.length > 0) {
            setDiceResult(lastRow.dieNumber);
            setActiveRow(lastRow.dieNumber);
            rowWordCountRef.current = { words: 0, coins: 0 };
            const target = remaining[Math.floor(Math.random() * remaining.length)];
            setTarget(target);
            const speakTurn = turnRef.current;
            await sleep(300);
            if (turnRef.current === speakTurn) speakWord(target.word);
          } else {
            // Last row has no words left — count it cleared too.
            await handleRowCompleteRef.current(lastRow.dieNumber);
          }
        }
      }
    },
    [clearedRows, board, profile, profileId]
  );
  // Called from handlers created before it (tap/roll); a ref avoids stale or
  // temporal-dead-zone references to the latest version.
  const handleRowCompleteRef = useRef(handleRowComplete);
  handleRowCompleteRef.current = handleRowComplete;

  // Handle board complete
  const handleBoardComplete = useCallback(
    async (_finalClearedRows: number[]) => {
      if (!profile || !profileId) return;
      const sess = sessionRef.current;
      const duration = Math.round((Date.now() - sess.startTime) / 1000);
      // Skipped words (7 misses) count against accuracy — otherwise a board
      // of 15 first-try words + 15 skips would score 100% and level the reader up.
      const answered = sess.wordsCorrect + sess.wordsSkipped;
      const accuracy = answered > 0 ? sess.firstAttemptCorrect / answered : 0;

      playSound("boardComplete");

      await sleep(500);

      // The server records the board and decides what it earned: accuracy
      // from its own count of answers, sticker picks, and whether the reader
      // moves up (or would, if the plan included the next level).
      const result = await safeMutate(
        () => completedBoardMut({ profileId: profileId as Id<"profiles">, accuracy, localDate: localDateString() }),
        "completedBoard"
      );
      const boardAccuracy = result?.accuracy ?? accuracy;
      const milestones = (result?.milestones ?? []) as MilestoneTrigger[];
      deferredLockedRef.current = !!result?.levelLocked && !lockPromptShownRef.current;

      // Do NOT auto-grant. Queue the milestone choices for the pick flow (the
      // server holds the same queue), and stash the level-up so it fires only
      // after every reward is claimed.
      setPendingRewards(milestones);
      deferredLevelUpRef.current = result?.levelUp ?? null;

      setBoardCompleteData({
        wordsAdded: sess.wordsCorrect,
        coinsEarned: sess.coinsEarned,
        accuracy: boardAccuracy,
        pendingRewardCount: milestones.length,
      });
      setShowBoardComplete(true);

      safeMutate(
        () => saveSessionMut({
          profileId: profileId as Id<"profiles">,
          level: level ?? profile.currentLevel,
          boardsPlayed: 1,
          wordsCorrect: sess.wordsCorrect,
          firstAttemptCorrect: sess.firstAttemptCorrect,
          wordsAttempted: sess.wordsAttempted,
          wordsSkipped: sess.wordsSkipped,
          hintsUsed: sess.hintsUsed,
          coinsEarned: sess.coinsEarned,
          stickersEarned: milestones.length,
          duration,
        }),
        "saveSession"
      );
    },
    [profile, profileId, level]
  );

  // After the reward queue empties, resolve a deferred level-up or start a new board.
  const resolveAfterRewards = useCallback(async () => {
    const next = deferredLevelUpRef.current;
    if (next) {
      deferredLevelUpRef.current = null;
      // Celebrate only once the server has actually moved the reader up.
      const ok = await safeMutate(
        async () => {
          await advanceLevelMut({ profileId: profileId as Id<"profiles">, nextLevel: next });
          return true;
        },
        "advanceLevel"
      );
      if (ok) {
        setLevelUpData({ newLevel: next });
        setShowLevelUp(true);
        playSound("levelUp");
        return;
      }
    }
    if (deferredLockedRef.current) {
      deferredLockedRef.current = false;
      lockPromptShownRef.current = true;
      setShowLevelLocked(true);
    }
    startNewBoard();
  }, [profileId, startNewBoard]);

  // Board-complete modal primary button: start the pick sequence, or move on.
  const handleBoardCompletePrimary = useCallback(() => {
    setShowBoardComplete(false);
    if (pendingRewards.length > 0) {
      setShowPickCategory(true);
    } else {
      resolveAfterRewards();
    }
  }, [pendingRewards, resolveAfterRewards]);

  // Advance the reward queue; when it empties, resolve level-up / new board.
  const handleRewardClaimed = useCallback(() => {
    setPendingRewards((prev) => {
      const next = prev.slice(1);
      if (next.length === 0) {
        setShowPickCategory(false);
        if (restoredPicksRef.current) {
          // Picks left over from an earlier visit: the current board stays.
          restoredPicksRef.current = false;
        } else {
          setTimeout(resolveAfterRewards, 50); // let the modal unmount cleanly
        }
      }
      return next;
    });
  }, [resolveAfterRewards]);

  // On arriving with a board ready, offer any picks left unclaimed last time
  // (kept on the server, so they follow the reader to any device).
  useEffect(() => {
    if (!profileId || !board || !profile || restoreCheckedRef.current === profileId) return;
    restoreCheckedRef.current = profileId;
    // Picks saved in this browser before the server kept them: offered once
    // for readers the server has no record for (it allows a few such claims).
    let legacy: MilestoneTrigger[] = [];
    try {
      const key = `rr:pendingRewards:${profileId}`;
      const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
      if (Array.isArray(parsed)) legacy = parsed.slice(0, 3);
      localStorage.removeItem(key);
    } catch {
      legacy = [];
    }
    if (showBoardComplete || showPickCategory || pendingRewards.length > 0) return;
    const stored = (profile.pendingRewards ?? legacy) as MilestoneTrigger[];
    if (stored.length === 0) return;
    restoredPicksRef.current = true;
    setPendingRewards(stored);
    setShowPickCategory(true);
  }, [profileId, board, profile]);

  const handleLevelUpClose = useCallback(() => {
    setShowLevelUp(false);
    // Clear the finished board first. If the new level's word pool hasn't
    // loaded yet, startNewBoard() bails; leaving board=null lets the play
    // page's `isReady && !board` effect regenerate once the pool arrives,
    // instead of stranding the player on an all-cleared board.
    setBoard(null);
    startNewBoard();
  }, [startNewBoard]);

  const markTutorialSeen = useCallback(() => {
    if (!profileId) return;
    safeMutate(
      () => updateProfileMut({ profileId: profileId as Id<"profiles">, hasSeenTutorial: true }),
      "markTutorialSeen"
    );
  }, [profileId]);

  return {
    // Data
    profile,
    board,
    clearedRows,
    clearedWords,
    activeRow,
    isRolling,
    rollBusy,
    diceResult,
    currentTarget,
    wrongWord,
    correctWord,
    hintWordId,
    coinPopups,
    recentWords,
    localCoins,
    wordBankCount: wordBankStats?.count ?? 0,
    wordBankValue: wordBankStats?.value ?? 0,
    // Celebrations
    showRowBanner,
    rowBannerData,
    showBoardComplete,
    boardCompleteData,
    showLevelUp,
    levelUpData,
    saveError,
    showLevelLocked,
    dismissLevelLocked: () => setShowLevelLocked(false),
    // Reward picking
    pendingRewards,
    showPickCategory,
    handleBoardCompletePrimary,
    handleRewardClaimed,
    // Actions
    startNewBoard,
    rollDice,
    repeatWord,
    handleWordTap,
    handleLevelUpClose,
    markTutorialSeen,
    isReady:
      !!wordPool &&
      !!profile &&
      reviewReady &&
      practiceWords !== undefined &&
      (profile.wordMode !== "nonsense" || fillPool !== undefined),
  };
}
