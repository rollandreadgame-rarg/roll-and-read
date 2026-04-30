"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { speakWord } from "@/lib/tts/webSpeechTTS";
import { playSound } from "@/lib/audio/soundManager";

const PRACTICE_COIN_REWARD = 3;

interface PracticeWord {
  _id: Id<"word_bank">;
  word: string;
  level: string;
  isNonsense: boolean;
  coinValue: number;
}

export default function PracticePage() {
  const { user } = useCurrentUser();
  const clerkUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const profiles = useQuery(
    api.profiles.getByUser,
    clerkUser?._id ? { userId: clerkUser._id } : "skip"
  );

  const profileId = profiles?.[0]?._id as Id<"profiles"> | undefined;
  const wordBank = useQuery(
    api.wordBank.getForProfile,
    profileId ? { profileId } : "skip"
  );

  const markPracticed = useMutation(api.wordBank.markPracticed);
  const awardCoins = useMutation(api.profiles.awardCoins);

  // Snapshot the practice queue once per session — re-querying after each
  // mutation would shrink it mid-drill and skip ahead unpredictably.
  const initialQueue = useMemo<PracticeWord[]>(() => {
    if (!wordBank) return [];
    return (wordBank as any[])
      .filter((w) => w.needsPractice)
      .map((w) => ({
        _id: w._id,
        word: w.word,
        level: w.level,
        isNonsense: w.isNonsense,
        coinValue: w.coinValue,
      }));
  }, [wordBank?.length]);

  const [idx, setIdx] = useState(0);
  const [resultsBatch, setResultsBatch] = useState<{ gotIt: number; stillHard: number; coinsEarned: number }>({
    gotIt: 0,
    stillHard: 0,
    coinsEarned: 0,
  });
  const [done, setDone] = useState(false);

  const current: PracticeWord | undefined = initialQueue[idx];

  // Auto-speak each word as it appears.
  useEffect(() => {
    if (current) {
      const t = setTimeout(() => speakWord(current.word), 150);
      return () => clearTimeout(t);
    }
  }, [current?._id]);

  const advance = () => {
    if (idx + 1 >= initialQueue.length) {
      setDone(true);
    } else {
      setIdx(idx + 1);
    }
  };

  const handleGotIt = async () => {
    if (!current || !profileId) return;
    playSound("correct");
    setResultsBatch((p) => ({
      ...p,
      gotIt: p.gotIt + 1,
      coinsEarned: p.coinsEarned + PRACTICE_COIN_REWARD,
    }));
    await Promise.all([
      markPracticed({ wordBankId: current._id, stillNeedsPractice: false }),
      awardCoins({ profileId, amount: PRACTICE_COIN_REWARD }),
    ]);
    advance();
  };

  const handleStillHard = async () => {
    if (!current) return;
    playSound("wrong");
    setResultsBatch((p) => ({ ...p, stillHard: p.stillHard + 1 }));
    await markPracticed({ wordBankId: current._id, stillNeedsPractice: true });
    advance();
  };

  const handleSkip = () => {
    advance();
  };

  // Loading
  if (!clerkUser || !profiles || !wordBank) {
    return (
      <div className="p-8 text-center" style={{ color: "var(--color-text-muted)" }}>
        Loading…
      </div>
    );
  }

  // Empty queue
  if (initialQueue.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <div className="text-6xl mb-4">🎯</div>
        <h1
          className="text-3xl font-extrabold mb-2 text-balance"
          style={{ color: "var(--color-text-primary)" }}
        >
          All caught up!
        </h1>
        <p className="mb-6 text-pretty" style={{ color: "var(--color-text-muted)" }}>
          No words need extra practice right now. Keep playing — words you
          struggle with will show up here.
        </p>
        <Link
          href="/play"
          className="inline-block px-6 py-3 rounded-2xl font-bold text-white"
          style={{ background: "var(--color-brand)" }}
        >
          🎲 Back to Play
        </Link>
      </div>
    );
  }

  // Done with the round
  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1
          className="text-3xl font-extrabold mb-2 text-balance"
          style={{ color: "var(--color-text-primary)" }}
        >
          Practice complete!
        </h1>
        <div
          className="grid grid-cols-3 gap-3 my-6 rounded-2xl p-4"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div>
            <div
              className="text-2xl font-extrabold tabular-nums"
              style={{ color: "var(--color-text-primary)" }}
            >
              {resultsBatch.gotIt}
            </div>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Got it
            </div>
          </div>
          <div>
            <div
              className="text-2xl font-extrabold tabular-nums"
              style={{ color: "var(--color-text-primary)" }}
            >
              {resultsBatch.stillHard}
            </div>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Still hard
            </div>
          </div>
          <div>
            <div
              className="text-2xl font-extrabold tabular-nums"
              style={{ color: "var(--color-accent-gold)" }}
            >
              💰 {resultsBatch.coinsEarned}
            </div>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Coins earned
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/play"
            className="px-6 py-3 rounded-2xl font-bold text-white"
            style={{ background: "var(--color-brand)" }}
          >
            🎲 Back to Play
          </Link>
          <Link
            href="/word-bank"
            className="px-6 py-3 rounded-2xl font-semibold"
            style={{
              border: "1px solid rgba(255,255,255,0.15)",
              color: "var(--color-text-primary)",
            }}
          >
            📚 Word Bank
          </Link>
        </div>
      </div>
    );
  }

  // Drill
  const progress = Math.round((idx / initialQueue.length) * 100);
  return (
    <div className="mx-auto max-w-md px-4 py-8 flex flex-col items-center">
      <div className="w-full mb-6">
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${progress}%`,
              background: "var(--color-brand)",
            }}
          />
        </div>
        <div
          className="text-xs mt-2 text-center tabular-nums"
          style={{ color: "var(--color-text-muted)" }}
        >
          {idx + 1} of {initialQueue.length}
        </div>
      </div>

      <h1
        className="text-sm font-bold uppercase tracking-wide mb-1"
        style={{ color: "var(--color-text-muted)" }}
      >
        🎯 Practice Mode
      </h1>
      <p
        className="text-xs mb-6 text-center text-pretty"
        style={{ color: "var(--color-text-muted)" }}
      >
        Listen, read, and tap how you did.
      </p>

      <div
        className="w-full rounded-3xl px-6 py-12 text-center mb-6"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          className="text-5xl font-extrabold mb-2 tracking-wide"
          style={{
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-word)",
          }}
        >
          {current?.word}
          {current?.isNonsense && <span className="text-2xl ml-1">✦</span>}
        </div>
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Level {current?.level}
        </div>
        <button
          onClick={() => current && speakWord(current.word)}
          className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "var(--color-text-primary)",
          }}
        >
          🔊 Hear again
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full mb-3">
        <button
          onClick={handleStillHard}
          className="py-4 rounded-2xl font-bold transition-colors"
          style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.4)",
            color: "var(--color-text-primary)",
          }}
        >
          😬 Still hard
        </button>
        <button
          onClick={handleGotIt}
          className="py-4 rounded-2xl font-bold text-white"
          style={{
            background: "linear-gradient(135deg, var(--color-success), color-mix(in srgb, var(--color-success) 70%, black))",
          }}
        >
          ✅ Got it (+{PRACTICE_COIN_REWARD}💰)
        </button>
      </div>
      <button
        onClick={handleSkip}
        className="text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        Skip for now
      </button>
    </div>
  );
}
