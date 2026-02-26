"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const LEVEL_TABS = [
  { label: "All", value: "all" },
  { label: "Level 1", value: "1" },
  { label: "Level 2", value: "2" },
  { label: "Level 3", value: "3" },
  { label: "Level 4", value: "4" },
  { label: "Level 5", value: "5" },
];

type WordMode = "all" | "real" | "nonsense";

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

  const totalValue = useMemo(
    () => (wordBank ?? []).reduce((sum: any, w: any) => sum + w.coinValue, 0),
    [wordBank]
  );

  return (
    <div className="flex flex-col flex-1 p-4 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold mb-1 text-balance" style={{ color: "var(--color-text-primary)" }}>
          📚 Word Bank
        </h1>
        <p className="text-pretty" style={{ color: "var(--color-text-muted)" }}>
          You know{" "}
          <strong style={{ color: "var(--color-brand)" }}>{wordBank?.length ?? 0} words</strong>{" "}
          worth{" "}
          <strong style={{ color: "var(--color-accent-gold)" }}>
            💎 {totalValue.toLocaleString()} coins
          </strong>
        </p>
      </div>

      {/* Profile tabs */}
      {(profiles?.length ?? 0) > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {profiles?.map((p: any) => (
            <button
              key={p._id}
              onClick={() => setActiveProfileId(p._id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors"
              style={{
                background:
                  selectedProfile === p._id
                    ? "var(--color-brand)"
                    : "rgba(255,255,255,0.08)",
                color:
                  selectedProfile === p._id ? "white" : "var(--color-text-muted)",
              }}
            >
              {p.avatarEmoji} {p.name}
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
          className="w-full px-4 py-3 rounded-xl text-base"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "var(--color-text-primary)",
          }}
        />
      </div>

      {/* Level filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {LEVEL_TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setLevelFilter(value)}
            className="px-3 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors"
            style={{
              background:
                levelFilter === value ? "var(--color-brand)" : "rgba(255,255,255,0.08)",
              color: levelFilter === value ? "white" : "var(--color-text-muted)",
            }}
          >
            {label}
          </button>
        ))}

        {/* Mode filter */}
        <div className="ml-auto flex gap-1">
          {(["all", "real", "nonsense"] as WordMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setModeFilter(m)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors capitalize"
              style={{
                background: modeFilter === m ? "rgba(255,255,255,0.15)" : "transparent",
                color: modeFilter === m ? "var(--color-text-primary)" : "var(--color-text-muted)",
              }}
            >
              {m === "all" ? "All" : m === "real" ? "Real" : "✦ Nonsense"}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm mb-3" style={{ color: "var(--color-text-muted)" }}>
        {filteredWords.length} word{filteredWords.length !== 1 ? "s" : ""} shown
      </div>

      {/* Word grid */}
      {filteredWords.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 py-16">
          <div className="text-5xl">📚</div>
          <p className="text-lg font-semibold" style={{ color: "var(--color-text-muted)" }}>
            {(wordBank?.length ?? 0) === 0
              ? "No words yet — roll the dice to start building your collection!"
              : "No words match your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredWords.map((w: any, i: number) => (
              <motion.div
                key={w._id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="rounded-xl p-3 flex flex-col gap-1"
                style={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="flex items-start justify-between">
                  <span
                    className="font-bold text-lg"
                    style={{ color: "var(--color-text-primary)", fontSize: "var(--word-size)" }}
                  >
                    {w.word}
                    {w.isNonsense && (
                      <sup className="text-xs ml-0.5" style={{ color: "#F59E0B" }}>✦</sup>
                    )}
                  </span>
                  {w.timesCorrect >= 5 && <span title="Read 5+ times">🏆</span>}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full text-white font-bold"
                    style={{ background: "var(--color-brand)" }}
                  >
                    {w.level}
                  </span>
                  <span className="text-xs" style={{ color: "var(--color-accent-gold)" }}>
                    💰 {w.coinValue}
                  </span>
                  {w.needsPractice && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: "#F59E0B22", color: "#F59E0B" }}
                    >
                      Keep practicing
                    </span>
                  )}
                </div>

                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Read {w.timesCorrect}×
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
