"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { LEVEL_SEQUENCE } from "@/lib/utils";

const STAT_CARDS = (profile: { totalBoardsCleared: number; currentLevel: string; streakDays: number; coins: number }) => [
  { label: "Boards Cleared", value: profile.totalBoardsCleared, icon: "🎲" },
  { label: "Current Level", value: profile.currentLevel, icon: "📊" },
  { label: "Day Streak", value: profile.streakDays, icon: "🔥" },
  { label: "Coins", value: profile.coins.toLocaleString(), icon: "💰" },
];

export default function DashboardPage() {
  const { user } = useUser();
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
      accuracy: Math.round((s.firstAttemptCorrect / Math.max(s.wordsCorrect, 1)) * 100),
    }));

  const currentLevelIdx = LEVEL_SEQUENCE.indexOf(profile?.currentLevel as typeof LEVEL_SEQUENCE[number]);

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-6">
        <div className="text-5xl">📊</div>
        <p style={{ color: "var(--color-text-muted)" }}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-4 max-w-4xl mx-auto w-full gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold" style={{ color: "var(--color-text-primary)" }}>
            📊 Dashboard
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>Track reading progress</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-white/10"
          style={{ border: "1px solid rgba(255,255,255,0.15)", color: "var(--color-text-muted)" }}
        >
          📄 Download Report
        </button>
      </div>

      {/* Profile tabs */}
      {(profiles?.length ?? 0) > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {profiles?.map((p: any) => (
            <button
              key={p._id}
              onClick={() => setActiveProfileId(p._id)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap"
              style={{
                background: selectedProfileId === p._id ? "var(--color-brand)" : "rgba(255,255,255,0.08)",
                color: selectedProfileId === p._id ? "white" : "var(--color-text-muted)",
              }}
            >
              {p.avatarEmoji} {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAT_CARDS(profile).map(({ label, value, icon }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 text-center"
            style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="text-3xl mb-1">{icon}</div>
            <div className="text-2xl font-extrabold" style={{ color: "var(--color-text-primary)" }}>
              {value}
            </div>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</div>
          </motion.div>
        ))}
      </div>

      {/* Accuracy chart */}
      {accuracyData.length > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <h2 className="text-lg font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
            📈 Accuracy (Last {accuracyData.length} Sessions)
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={accuracyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="session" tick={{ fill: "#94A3B8", fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#94A3B8", fontSize: 12 }} unit="%" />
              <Tooltip
                contentStyle={{ background: "#1E293B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#F8FAFC" }}
                formatter={(v: number | undefined) => [`${v ?? 0}%`, "Accuracy"]}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="var(--color-brand)"
                strokeWidth={2}
                dot={{ fill: "var(--color-brand)", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Level progress */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
          🗺️ Level Progress
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {LEVEL_SEQUENCE.map((level, i) => {
            const isCompleted = i < currentLevelIdx;
            const isCurrent = i === currentLevelIdx;
            return (
              <div
                key={level}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: isCompleted
                      ? "var(--color-success)"
                      : isCurrent
                      ? "var(--color-brand)"
                      : "rgba(255,255,255,0.08)",
                    color: isCompleted || isCurrent ? "white" : "var(--color-text-muted)",
                    border: isCurrent ? "2px solid white" : "none",
                  }}
                >
                  {isCompleted ? "✓" : level}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Session history */}
      {(sessions?.length ?? 0) > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <h2 className="text-lg font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
            📋 Recent Sessions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--color-text-muted)" }}>
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-left py-2 pr-4">Level</th>
                  <th className="text-right py-2 pr-4">Words</th>
                  <th className="text-right py-2 pr-4">Accuracy</th>
                  <th className="text-right py-2">Coins</th>
                </tr>
              </thead>
              <tbody>
                {sessions?.map((s: any) => (
                  <tr
                    key={s._id}
                    className="border-t"
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}
                  >
                    <td className="py-2 pr-4" style={{ color: "var(--color-text-muted)" }}>
                      {new Date(s.completedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                        style={{ background: "var(--color-brand)" }}
                      >
                        {s.level}
                      </span>
                    </td>
                    <td className="text-right py-2 pr-4" style={{ color: "var(--color-text-primary)" }}>
                      {s.wordsCorrect}
                    </td>
                    <td className="text-right py-2 pr-4" style={{ color: "var(--color-success)" }}>
                      {Math.round((s.firstAttemptCorrect / Math.max(s.wordsCorrect, 1)) * 100)}%
                    </td>
                    <td className="text-right py-2" style={{ color: "var(--color-accent-gold)" }}>
                      +{s.coinsEarned}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Words needing practice */}
      {practiceWords.length > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}
        >
          <h2 className="text-lg font-bold mb-3" style={{ color: "#F59E0B" }}>
            🔁 Words to Practice
          </h2>
          <div className="flex flex-wrap gap-2">
            {practiceWords.map((w: any) => (
              <span
                key={w._id}
                className="px-3 py-1.5 rounded-xl text-sm font-bold"
                style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}
              >
                {w.word}
                {w.isNonsense && <sup className="text-xs ml-0.5">✦</sup>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
