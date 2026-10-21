"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { useQuery } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { sessionAccuracy } from "@/lib/game/accuracy";
import { LEVEL_SEQUENCE } from "@/lib/utils";
import { LEVEL_SKILLS } from "@/lib/levels";
import MiniDie from "@/components/game/MiniDie";

const STAT_CARDS = (profile: { totalBoardsCleared: number; currentLevel: string; streakDays: number; coins: number }) => [
  { label: "Boards cleared", value: profile.totalBoardsCleared, icon: "🎲" },
  { label: "Current level", value: profile.currentLevel, icon: "📊" },
  { label: "Day streak", value: profile.streakDays, icon: "🔥" },
  { label: "Coins", value: profile.coins.toLocaleString(), icon: "💰" },
];

// Sublevels grouped by level number (1–5) for the level map.
const LEVEL_GROUPS = [1, 2, 3, 4, 5].map((n) => ({
  number: n,
  levels: LEVEL_SEQUENCE.map((level, i) => ({ level, i })).filter(({ level }) => level.startsWith(String(n))),
}));

const chipStyle = (selected: boolean): React.CSSProperties => ({
  background: selected ? "var(--color-brand)" : "var(--color-surface-2)",
  color: selected ? "var(--color-on-brand)" : "var(--color-text-primary)",
  border: `1px solid ${selected ? "var(--color-brand)" : "var(--color-line)"}`,
});

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const clerkUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const profiles = useQuery(
    api.profiles.getByUser,
    clerkUser?._id ? { userId: clerkUser._id } : "skip"
  );

  const selectedProfileId = activeProfileId ?? profiles?.[0]?._id;
  const profile = profiles?.find((p: any) => p._id === selectedProfileId);

  const sessions = useQuery(
    api.gameSessions.getForProfile,
    selectedProfileId
      ? { profileId: selectedProfileId as Id<"profiles">, limit: 10 }
      : "skip"
  );

  const wordBank = useQuery(
    api.wordBank.getForProfile,
    selectedProfileId ? { profileId: selectedProfileId as Id<"profiles"> } : "skip"
  );

  const practiceWords = (wordBank ?? []).filter((w: any) => w.needsPractice);

  const accuracyData = (sessions ?? [])
    .slice()
    .reverse()
    .map((s: any, i: number) => ({
      session: `#${i + 1}`,
      accuracy: Math.round(sessionAccuracy(s) * 100),
    }));

  const currentLevelIdx = LEVEL_SEQUENCE.indexOf(profile?.currentLevel as typeof LEVEL_SEQUENCE[number]);

  const isLoading = clerkUser === undefined || (clerkUser !== null && profiles === undefined);
  const hasNoProfile = !isLoading && !profile;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-6">
        <MiniDie face={5} className="w-12 h-12" />
        <p style={{ color: "var(--color-text-muted)" }}>Loading progress…</p>
      </div>
    );
  }

  if (hasNoProfile) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-6 text-center">
        <MiniDie face={1} tone="dim" className="w-12 h-12" />
        <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: "var(--color-text-primary)" }}>
          Progress
        </h1>
        <p style={{ color: "var(--color-text-muted)" }}>No profile found.</p>
        <a href="/play" className="btn-primary px-6 py-3">
          Go to play
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-balance" style={{ color: "var(--color-text-primary)" }}>
            Progress
          </h1>
          <p className="text-pretty" style={{ color: "var(--color-text-muted)" }}>Track reading progress</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-2xl text-sm font-bold transition-colors hover:bg-[var(--color-hover)]"
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-line)",
            color: "var(--color-text-primary)",
          }}
        >
          <span aria-hidden="true">📄</span> Download report
        </button>
      </div>

      {/* Profile tabs */}
      {(profiles?.length ?? 0) > 1 && (
        <div className="flex flex-wrap gap-2">
          {profiles?.map((p: any) => (
            <button
              key={p._id}
              onClick={() => setActiveProfileId(p._id)}
              aria-pressed={selectedProfileId === p._id}
              className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-semibold whitespace-nowrap transition-colors"
              style={chipStyle(selectedProfileId === p._id)}
            >
              <span aria-hidden="true">{p.avatarEmoji}</span> {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAT_CARDS(profile!).map(({ label, value, icon }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel p-4 text-center"
          >
            <div className="text-3xl mb-1" aria-hidden="true">{icon}</div>
            <div className="text-2xl font-extrabold tabular-nums" style={{ color: "var(--color-text-primary)" }}>
              {value}
            </div>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</div>
          </motion.div>
        ))}
      </div>

      {/* Accuracy chart */}
      {accuracyData.length > 0 && (
        <section className="panel p-4 sm:p-5">
          <h2 className="text-lg font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
            Accuracy (last {accuracyData.length} sessions)
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={accuracyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
              <XAxis dataKey="session" tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} stroke="var(--color-line-strong)" />
              <YAxis domain={[0, 100]} tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} unit="%" stroke="var(--color-line-strong)" />
              <Tooltip
                contentStyle={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-line-strong)",
                  borderRadius: "12px",
                  color: "var(--color-text-primary)",
                }}
                labelStyle={{ color: "var(--color-text-muted)" }}
                itemStyle={{ color: "var(--color-text-primary)" }}
                formatter={(v: number | undefined) => [`${v ?? 0}%`, "Accuracy"]}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="var(--color-brand-secondary)"
                strokeWidth={2}
                dot={{ fill: "var(--color-brand-secondary)", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Level progress */}
      <section className="panel p-4 sm:p-5" aria-labelledby="level-progress-heading">
        <h2 id="level-progress-heading" className="text-lg font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>
          Level progress
        </h2>
        {currentLevelIdx >= 0 && (
          <p className="text-sm mb-1" style={{ color: "var(--color-text-secondary)" }}>
            Playing now: <strong style={{ color: "var(--color-text-primary)" }}>{LEVEL_SEQUENCE[currentLevelIdx]}</strong>
            {" — "}
            {LEVEL_SKILLS[LEVEL_SEQUENCE[currentLevelIdx]]}
          </p>
        )}
        <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
          <span aria-hidden="true">✓</span> done · highlighted = playing now
        </p>
        <div className="flex flex-col gap-4">
          {LEVEL_GROUPS.map(({ number, levels }) => (
            <div key={number}>
              <h3 className="text-sm font-bold mb-2" style={{ color: "var(--color-text-secondary)" }}>
                Level {number}
              </h3>
              <ol className="flex flex-wrap gap-2" aria-label={`Level ${number} steps`}>
                {levels.map(({ level, i }) => {
                  const isCompleted = i < currentLevelIdx;
                  const isCurrent = i === currentLevelIdx;
                  return (
                    <li
                      key={level}
                      aria-current={isCurrent ? "step" : undefined}
                      title={`${level}: ${LEVEL_SKILLS[level]}`}
                      className="flex items-center justify-center gap-1 h-11 min-w-[3.25rem] px-2.5 rounded-xl text-sm font-bold tabular-nums"
                      style={
                        isCurrent
                          ? {
                              background: "var(--color-brand)",
                              color: "var(--color-on-brand)",
                              boxShadow: "0 0 0 3px var(--color-highlight)",
                            }
                          : isCompleted
                          ? {
                              background: "color-mix(in srgb, var(--color-success) 16%, var(--color-bg-surface))",
                              color: "var(--color-text-primary)",
                              border: "1px solid color-mix(in srgb, var(--color-success) 60%, transparent)",
                            }
                          : {
                              background: "transparent",
                              color: "var(--color-text-muted)",
                              border: "1px dashed var(--color-line-strong)",
                            }
                      }
                    >
                      {isCompleted && <span aria-hidden="true">✓</span>}
                      {level}
                      <span className="sr-only">
                        {isCompleted ? ", done" : isCurrent ? ", playing now" : ", not started"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* Session history */}
      {(sessions?.length ?? 0) > 0 && (
        <section className="panel p-4 sm:p-5">
          <h2 className="text-lg font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
            Recent sessions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--color-text-muted)" }}>
                  <th className="text-left font-semibold py-2 pr-4">Date</th>
                  <th className="text-left font-semibold py-2 pr-4">Level</th>
                  <th className="text-right font-semibold py-2 pr-4">Words</th>
                  <th className="text-right font-semibold py-2 pr-4">Accuracy</th>
                  <th className="text-right font-semibold py-2">Coins</th>
                </tr>
              </thead>
              <tbody>
                {sessions?.map((s: any) => (
                  <tr
                    key={s._id}
                    className="border-t"
                    style={{ borderColor: "var(--color-line)" }}
                  >
                    <td className="py-2 pr-4 whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
                      {new Date(s.completedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: "var(--color-brand)", color: "var(--color-on-brand)" }}
                      >
                        {s.level}
                      </span>
                    </td>
                    <td className="text-right py-2 pr-4 tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                      {s.wordsCorrect}
                    </td>
                    <td className="text-right py-2 pr-4 tabular-nums font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {Math.round(sessionAccuracy(s) * 100)}%
                    </td>
                    <td className="text-right py-2 tabular-nums font-semibold whitespace-nowrap" style={{ color: "var(--color-text-primary)" }}>
                      +{s.coinsEarned} <span aria-hidden="true">💰</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Words needing practice */}
      {practiceWords.length > 0 && (
        <section
          className="panel p-4 sm:p-5"
          style={{ borderColor: "color-mix(in srgb, var(--color-warning) 45%, transparent)" }}
        >
          <h2 className="text-lg font-bold mb-3" style={{ color: "var(--color-text-primary)" }}>
            Words to practice
          </h2>
          <div className="flex flex-wrap gap-3 pb-1">
            {practiceWords.map((w: any) => (
              <span
                key={w._id}
                className="px-3 py-2 font-bold"
                style={{
                  borderRadius: "var(--radius-card)",
                  fontFamily: "var(--font-word)",
                  fontSize: "var(--word-size)",
                  background: w.isNonsense ? "var(--card-silly)" : "var(--card-paper)",
                  color: w.isNonsense ? "var(--card-silly-ink)" : "var(--card-ink)",
                  boxShadow: `0 4px 0 ${w.isNonsense ? "var(--card-silly-edge)" : "var(--card-edge)"}`,
                }}
              >
                {w.word}
                {w.isNonsense && (
                  <>
                    <sup className="text-xs ml-0.5" aria-hidden="true">👽</sup>
                    <span className="sr-only"> (nonsense word)</span>
                  </>
                )}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
