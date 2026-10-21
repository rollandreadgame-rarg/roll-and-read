"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import MiniDie from "@/components/game/MiniDie";

const LEVEL_TABS = [
  { label: "All", value: "all" },
  { label: "Level 1", value: "1" },
  { label: "Level 2", value: "2" },
  { label: "Level 3", value: "3" },
  { label: "Level 4", value: "4" },
  { label: "Level 5", value: "5" },
];

type WordMode = "all" | "real" | "nonsense";

const chipStyle = (selected: boolean): React.CSSProperties => ({
  background: selected ? "var(--color-brand)" : "var(--color-surface-2)",
  color: selected ? "var(--color-on-brand)" : "var(--color-text-primary)",
  border: `1px solid ${selected ? "var(--color-brand)" : "var(--color-line)"}`,
});

// Small text on a paper word card: ink softened toward the paper, still ≥ 4.5:1.
const CARD_MUTED = "color-mix(in srgb, var(--card-ink) 72%, var(--card-paper))";

export default function WordBankPage() {
  const { user } = useCurrentUser();
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState<WordMode>("all");
  const [search, setSearch] = useState("");

  const clerkUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  const profiles = useQuery(
    api.profiles.getByUser,
    clerkUser?._id ? { userId: clerkUser._id } : "skip"
  );

  const selectedProfile = activeProfileId ?? profiles?.[0]?._id;

  const wordBank = useQuery(
    api.wordBank.getForProfile,
    selectedProfile ? { profileId: selectedProfile as Id<"profiles"> } : "skip"
  );

  const filteredWords = useMemo(
    () => (wordBank ?? []).filter((w: any) => {
      if (levelFilter !== "all" && !w.level.startsWith(levelFilter)) return false;
      if (modeFilter === "real" && w.isNonsense) return false;
      if (modeFilter === "nonsense" && !w.isNonsense) return false;
      if (search && !w.word.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [wordBank, levelFilter, modeFilter, search]
  );

  // "Known" = read correctly at least once (a word skipped after 7 misses is
  // in the bank for practice but not learned yet).
  const learned = useMemo(() => (wordBank ?? []).filter((w: any) => w.timesCorrect > 0), [wordBank]);
  const totalValue = useMemo(
    () => learned.reduce((sum: number, w: any) => sum + w.coinValue, 0),
    [learned]
  );

  return (
    <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-1 text-balance" style={{ color: "var(--color-text-primary)" }}>
          Word bank
        </h1>
        <p className="text-pretty" style={{ color: "var(--color-text-muted)" }}>
          You know{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>{learned.length} words</strong>{" "}
          worth{" "}
          <strong className="tabular-nums" style={{ color: "var(--color-text-primary)" }}>
            <span aria-hidden="true">💰</span> {totalValue.toLocaleString()} coins
          </strong>
        </p>
      </div>

      {/* Profile tabs */}
      {(profiles?.length ?? 0) > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {profiles?.map((p: any) => (
            <button
              key={p._id}
              onClick={() => setActiveProfileId(p._id)}
              aria-pressed={selectedProfile === p._id}
              className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-colors"
              style={chipStyle(selectedProfile === p._id)}
            >
              <span aria-hidden="true">{p.avatarEmoji}</span> {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search words..."
          aria-label="Search words"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl text-base placeholder:text-[var(--color-text-muted)]"
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-line-strong)",
            color: "var(--color-text-primary)",
          }}
        />
      </div>

      {/* Filters: level chips wrap; word-type toggle sits on its own row on phones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by level">
          {LEVEL_TABS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setLevelFilter(value)}
              aria-pressed={levelFilter === value}
              className="shrink-0 px-3 py-1.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-colors"
              style={chipStyle(levelFilter === value)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Mode filter */}
        <div
          className="flex gap-1 p-1 rounded-2xl self-start sm:self-auto"
          role="group"
          aria-label="Filter by word type"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
        >
          {(["all", "real", "nonsense"] as WordMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setModeFilter(m)}
              aria-pressed={modeFilter === m}
              className="shrink-0 px-3 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors"
              style={{
                background: modeFilter === m ? "var(--color-bg-surface)" : "transparent",
                color: modeFilter === m ? "var(--color-text-primary)" : "var(--color-text-muted)",
                boxShadow: modeFilter === m ? "0 0 0 1px var(--color-line-strong)" : "none",
              }}
            >
              {m === "all" ? "All" : m === "real" ? "Real" : "👽 Silly"}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm mb-3" style={{ color: "var(--color-text-muted)" }}>
        {filteredWords.length} word{filteredWords.length !== 1 ? "s" : ""} shown
      </div>

      {/* Word grid */}
      {wordBank === undefined ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 py-16">
          <MiniDie face={3} className="w-10 h-10" />
          <p className="text-lg font-semibold" style={{ color: "var(--color-text-muted)" }}>
            Loading your words…
          </p>
        </div>
      ) : filteredWords.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 py-16 text-center">
          <div className="text-5xl" aria-hidden="true">📚</div>
          <p className="text-lg font-semibold text-pretty" style={{ color: "var(--color-text-muted)" }}>
            {(wordBank?.length ?? 0) === 0
              ? "No words yet — roll the dice to start building your collection!"
              : "No words match your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-4 pb-1">
          <AnimatePresence mode="popLayout">
            {filteredWords.map((w: any, i: number) => {
              const silly = !!w.isNonsense;
              const ink = silly ? "var(--card-silly-ink)" : "var(--card-ink)";
              return (
                <motion.div
                  key={w._id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="p-3 flex flex-col gap-1.5 min-w-0"
                  style={{
                    borderRadius: "var(--radius-card)",
                    background: silly ? "var(--card-silly)" : "var(--card-paper)",
                    color: ink,
                    border: silly ? "2px dashed var(--card-silly-edge)" : "2px solid transparent",
                    boxShadow: `0 4px 0 ${silly ? "color-mix(in srgb, var(--card-silly-edge) 55%, var(--card-silly))" : "var(--card-edge)"}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className="font-bold leading-tight break-words min-w-0"
                      style={{ color: ink, fontFamily: "var(--font-word)", fontSize: "calc(var(--word-size) * 1.15)" }}
                    >
                      {w.word}
                      {silly && (
                        <>
                          <sup className="text-xs ml-0.5" aria-hidden="true">👽</sup>
                          <span className="sr-only"> (nonsense word)</span>
                        </>
                      )}
                    </span>
                    {w.timesCorrect >= 5 && (
                      <span role="img" aria-label="Read 5+ times" title="Read 5+ times">🏆</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: "var(--color-brand)", color: "var(--color-on-brand)" }}
                    >
                      {w.level}
                    </span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: CARD_MUTED }}>
                      <span aria-hidden="true">💰</span> {w.coinValue}
                    </span>
                    {w.needsPractice && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                        style={{
                          background: "color-mix(in srgb, var(--color-warning) 22%, var(--card-paper))",
                          color: "var(--card-ink)",
                          border: "1px solid color-mix(in srgb, var(--color-warning) 70%, transparent)",
                        }}
                      >
                        Keep practicing
                      </span>
                    )}
                  </div>

                  <div className="text-xs" style={{ color: silly ? "var(--card-silly-ink)" : CARD_MUTED }}>
                    {w.timesCorrect > 0 ? `Read ${w.timesCorrect}×` : "Not read yet"}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
