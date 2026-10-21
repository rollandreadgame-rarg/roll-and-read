"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { speakWord, cancelSpeech } from "@/lib/tts/webSpeechTTS";
import { playSound } from "@/lib/audio/soundManager";
import MiniDie from "@/components/game/MiniDie";

const PRACTICE_COIN_REWARD = 3;

interface PracticeWord {
  _id: Id<"word_bank">;
  word: string;
  level: string;
  isNonsense: boolean;
  coinValue: number;
}

const secondaryButtonStyle: React.CSSProperties = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-line)",
  color: "var(--color-text-primary)",
};

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

  // Family/classroom accounts pick which reader is practising.
  const [chosenProfileId, setChosenProfileId] = useState<Id<"profiles"> | null>(null);
  const profileId = (chosenProfileId ?? profiles?.[0]?._id) as Id<"profiles"> | undefined;
  const wordBank = useQuery(
    api.wordBank.getForProfile,
    profileId ? { profileId } : "skip"
  );

  const markPracticed = useMutation(api.wordBank.markPracticed);
  const awardCoins = useMutation(api.profiles.awardCoins);

  // Snapshot the practice queue once per reader — re-querying after each
  // mutation would shrink it mid-drill and skip ahead unpredictably.
  const [snapshot, setSnapshot] = useState<{ profileId: string; queue: PracticeWord[] } | null>(null);
  useEffect(() => {
    if (!wordBank || !profileId || snapshot?.profileId === profileId) return;
    setSnapshot({
      profileId,
      queue: (wordBank as any[])
        .filter((w) => w.needsPractice)
        .map((w) => ({
          _id: w._id,
          word: w.word,
          level: w.level,
          isNonsense: w.isNonsense,
          coinValue: w.coinValue,
        })),
    });
  }, [wordBank, profileId, snapshot?.profileId]);
  const initialQueue = useMemo<PracticeWord[]>(
    () => (snapshot && snapshot.profileId === profileId ? snapshot.queue : []),
    [snapshot, profileId]
  );

  const switchReader = (id: Id<"profiles">) => {
    if (id === profileId) return;
    cancelSpeech();
    setChosenProfileId(id);
    setSnapshot(null);
    setIdx(0);
    setDone(false);
    setResultsBatch({ gotIt: 0, stillHard: 0, coinsEarned: 0 });
  };

  // One answer at a time — a double tap must not award coins twice.
  const [busy, setBusy] = useState(false);

  const [idx, setIdx] = useState(0);
  const [resultsBatch, setResultsBatch] = useState<{ gotIt: number; stillHard: number; coinsEarned: number }>({
    gotIt: 0,
    stillHard: 0,
    coinsEarned: 0,
  });
  const [done, setDone] = useState(false);

  const current: PracticeWord | undefined = initialQueue[idx];

  // Auto-speak each word as it appears.
  const currentWord = current?.word;
  const currentId = current?._id;
  useEffect(() => {
    if (!currentWord) return;
    const t = setTimeout(() => speakWord(currentWord), 150);
    return () => clearTimeout(t);
  }, [currentId, currentWord]);

  useEffect(() => () => cancelSpeech(), []);

  const advance = () => {
    if (idx + 1 >= initialQueue.length) {
      setDone(true);
    } else {
      setIdx(idx + 1);
    }
  };

  const handleGotIt = async () => {
    if (!current || !profileId || busy) return;
    setBusy(true);
    playSound("correct");
    try {
      await Promise.all([
        markPracticed({ wordBankId: current._id, stillNeedsPractice: false }),
        awardCoins({ profileId, amount: PRACTICE_COIN_REWARD }),
      ]);
      setResultsBatch((p) => ({
        ...p,
        gotIt: p.gotIt + 1,
        coinsEarned: p.coinsEarned + PRACTICE_COIN_REWARD,
      }));
    } catch (err) {
      console.error("[practice] save failed:", err);
    } finally {
      setBusy(false);
      advance();
    }
  };

  const handleStillHard = async () => {
    if (!current || busy) return;
    setBusy(true);
    playSound("wrong");
    setResultsBatch((p) => ({ ...p, stillHard: p.stillHard + 1 }));
    try {
      await markPracticed({ wordBankId: current._id, stillNeedsPractice: true });
    } catch (err) {
      console.error("[practice] save failed:", err);
    } finally {
      setBusy(false);
      advance();
    }
  };

  const handleSkip = () => {
    advance();
  };

  const readerPicker =
    profiles && profiles.length > 1 ? (
      <div className="flex flex-wrap justify-center gap-2 mb-6" role="group" aria-label="Choose who is practising">
        {(profiles as any[]).map((p) => (
          <button
            key={p._id}
            onClick={() => switchReader(p._id)}
            aria-pressed={p._id === profileId}
            className="shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors"
            style={{
              background: p._id === profileId ? "var(--color-brand)" : "var(--color-surface-2)",
              color: p._id === profileId ? "var(--color-on-brand)" : "var(--color-text-primary)",
              border: `1px solid ${p._id === profileId ? "var(--color-brand)" : "var(--color-line)"}`,
            }}
          >
            <span aria-hidden="true">{p.avatarEmoji}</span> {p.name}
          </button>
        ))}
      </div>
    ) : null;

  // Loading
  if (!clerkUser || !profiles || !wordBank || !snapshot) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center" style={{ color: "var(--color-text-muted)" }}>
        <MiniDie face={4} className="w-10 h-10" />
        Loading…
      </div>
    );
  }

  // Empty queue
  if (initialQueue.length === 0) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-12 text-center">
        {readerPicker}
        <div className="text-6xl mb-4" aria-hidden="true">🎯</div>
        <h1
          className="text-2xl sm:text-3xl font-extrabold mb-2 text-balance"
          style={{ color: "var(--color-text-primary)" }}
        >
          All caught up!
        </h1>
        <p className="mb-6 text-pretty" style={{ color: "var(--color-text-muted)" }}>
          No words need extra practice right now. Keep playing — words you
          struggle with will show up here.
        </p>
        <Link href="/play" className="btn-primary inline-flex items-center justify-center px-6 py-3">
          Back to play
        </Link>
      </div>
    );
  }

  // Done with the round
  if (done) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-12 text-center">
        <div className="text-6xl mb-4" aria-hidden="true">🎉</div>
        <h1
          className="text-2xl sm:text-3xl font-extrabold mb-2 text-balance"
          style={{ color: "var(--color-text-primary)" }}
        >
          Practice complete!
        </h1>
        <div className="panel grid grid-cols-3 gap-3 my-6 p-4">
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
              className="text-2xl font-extrabold tabular-nums whitespace-nowrap"
              style={{ color: "var(--color-text-primary)" }}
            >
              <span aria-hidden="true">💰</span> {resultsBatch.coinsEarned}
            </div>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Coins earned
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Link href="/play" className="btn-primary inline-flex items-center justify-center px-6 py-3">
            Back to play
          </Link>
          <Link
            href="/word-bank"
            className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-semibold transition-colors hover:bg-[var(--color-hover)]"
            style={secondaryButtonStyle}
          >
            <span aria-hidden="true" className="mr-1.5">📚</span> Word bank
          </Link>
        </div>
      </div>
    );
  }

  // Drill
  const progress = Math.round((idx / initialQueue.length) * 100);
  const silly = !!current?.isNonsense;
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:py-8 flex flex-col items-center">
      {readerPicker}
      <div className="w-full mb-6">
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
        >
          <div
            className="h-full transition-all"
            style={{
              width: `${progress}%`,
              background: "var(--color-brand-secondary)",
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
        className="text-2xl sm:text-3xl font-extrabold mb-1 text-balance"
        style={{ color: "var(--color-text-primary)" }}
      >
        Practice
      </h1>
      <p
        className="text-sm mb-6 text-center text-pretty"
        style={{ color: "var(--color-text-muted)" }}
      >
        Listen, read, and tap how you did.
      </p>

      {/* The word, printed on a paper card */}
      <div
        className="relative w-full px-6 py-10 text-center mb-4"
        style={{
          borderRadius: "var(--radius-card)",
          background: silly ? "var(--card-silly)" : "var(--card-paper)",
          color: silly ? "var(--card-silly-ink)" : "var(--card-ink)",
          border: silly ? "2px dashed var(--card-silly-edge)" : "2px solid transparent",
          boxShadow: `0 4px 0 ${silly ? "color-mix(in srgb, var(--card-silly-edge) 55%, var(--card-silly))" : "var(--card-edge)"}, 0 10px 18px -8px rgba(0, 0, 0, 0.45)`,
        }}
      >
        <div
          className="text-5xl font-bold mb-3 break-words"
          style={{ fontFamily: "var(--font-word)" }}
        >
          {current?.word}
          {current?.isNonsense && (
            <>
              <span className="text-2xl ml-1" aria-hidden="true">👽</span>
              <span className="sr-only"> (nonsense word)</span>
            </>
          )}
        </div>
        <div
          className="text-xs font-semibold"
          style={{ color: `color-mix(in srgb, ${silly ? "var(--card-silly-ink)" : "var(--card-ink)"} 72%, ${silly ? "var(--card-silly)" : "var(--card-paper)"})` }}
        >
          Level {current?.level}
        </div>
      </div>
      <button
        onClick={() => current && speakWord(current.word)}
        className="mb-6 px-4 py-2 rounded-2xl text-sm font-semibold transition-colors hover:bg-[var(--color-hover)]"
        style={secondaryButtonStyle}
      >
        <span aria-hidden="true">🔊</span> Hear again
      </button>

      <div className="grid grid-cols-2 gap-3 w-full mb-3">
        <button
          onClick={handleStillHard}
          disabled={busy}
          className="py-4 px-2 rounded-2xl font-bold transition-colors hover:bg-[var(--color-hover)] disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            ...secondaryButtonStyle,
            border: "1px solid color-mix(in srgb, var(--color-error) 55%, var(--color-line))",
          }}
        >
          <span aria-hidden="true">😬</span> Still hard
        </button>
        <button
          onClick={handleGotIt}
          disabled={busy}
          className="btn-primary py-4 px-2"
        >
          <span aria-hidden="true">✅</span> Got it (+{PRACTICE_COIN_REWARD}<span aria-hidden="true">💰</span><span className="sr-only"> coins</span>)
        </button>
      </div>
      <button
        onClick={handleSkip}
        className="text-sm underline underline-offset-4 px-3"
        style={{ color: "var(--color-text-muted)" }}
      >
        Skip for now
      </button>
    </div>
  );
}
