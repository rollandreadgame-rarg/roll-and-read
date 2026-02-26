"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { useQuery } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { LEVEL_SEQUENCE } from "@/lib/utils";

// ─── ProfileCard ─────────────────────────────────────────────────────────────
// Separate component so each card calls its own useQuery hooks (Rules of Hooks)

function ProfileCard({ profile }: { profile: any }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const sessions = useQuery(api.gameSessions.getForProfile, {
    profileId: profile._id as Id<"profiles">,
    limit: 8,
  });

  const wordBank = useQuery(api.wordBank.getForProfile, {
    profileId: profile._id as Id<"profiles">,
  });

  const wordsLearned = wordBank?.length ?? 0;
  const practiceWords = (wordBank ?? []).filter((w: any) => w.needsPractice);

  const avgAccuracy =
    profile.accuracyHistory.length > 0
      ? Math.round(
          profile.accuracyHistory.reduce(
            (a: number, b: number) => a + b,
            0
          ) / profile.accuracyHistory.length
        )
      : null;

  const lastPlayedStr = profile.lastPlayedAt
    ? new Date(profile.lastPlayedAt).toLocaleDateString()
    : "Never";

  const levelIdx = LEVEL_SEQUENCE.indexOf(
    profile.currentLevel as (typeof LEVEL_SEQUENCE)[number]
  );

  const accuracyData = (sessions ?? [])
    .slice()
    .reverse()
    .map((s: any, i: number) => ({
      session: `#${i + 1}`,
      accuracy: Math.round(
        (s.firstAttemptCorrect / Math.max(s.wordsCorrect, 1)) * 100
      ),
    }));

  return (
    <motion.div
      layout
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* ── Card Summary (always visible) ── */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full text-left p-5"
        aria-expanded={isExpanded}
        aria-controls={`profile-detail-${profile._id}`}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">{profile.avatarEmoji}</span>
          <div className="flex-1 min-w-0">
            <div
              className="font-extrabold text-lg truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              {profile.name}
            </div>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ background: "var(--color-brand)" }}
            >
              Level {profile.currentLevel}
            </span>
          </div>
          <span
            className="text-lg shrink-0 transition-transform duration-200"
            style={{
              color: "var(--color-text-muted)",
              display: "inline-block",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            ▾
          </span>
        </div>

        {/* Quick stats grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            { label: "Boards", value: profile.totalBoardsCleared },
            {
              label: "Avg Accuracy",
              value: avgAccuracy !== null ? `${avgAccuracy}%` : "—",
              color:
                avgAccuracy !== null
                  ? avgAccuracy >= 70
                    ? "var(--color-success)"
                    : "#F59E0B"
                  : "var(--color-text-muted)",
            },
            { label: "Words Learned", value: wordsLearned },
            {
              label: "To Practice",
              value: practiceWords.length,
              color: practiceWords.length > 0 ? "#F59E0B" : "var(--color-text-primary)",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl p-2.5 text-center"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              <div
                className="font-extrabold text-lg tabular-nums"
                style={{ color: color ?? "var(--color-text-primary)" }}
              >
                {value}
              </div>
              <div
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-3 text-xs text-right"
          style={{ color: "var(--color-text-muted)" }}
        >
          Last played: {lastPlayedStr}
        </div>
      </button>

      {/* ── Expanded Detail ── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={`profile-detail-${profile._id}`}
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div
              className="px-5 pb-5 flex flex-col gap-5"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              {/* 4 stat tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-5">
                {[
                  { label: "Current Level", value: profile.currentLevel, icon: "📊" },
                  { label: "Boards Cleared", value: profile.totalBoardsCleared, icon: "🎲" },
                  {
                    label: "Avg Accuracy",
                    value: avgAccuracy !== null ? `${avgAccuracy}%` : "—",
                    icon: "🎯",
                  },
                  { label: "Words Learned", value: wordsLearned, icon: "📚" },
                ].map(({ label, value, icon }) => (
                  <div
                    key={label}
                    className="rounded-xl p-3 text-center"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="text-2xl mb-1">{icon}</div>
                    <div
                      className="font-extrabold text-lg tabular-nums"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {value}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Level progress */}
              <div>
                <h3
                  className="text-sm font-bold mb-3"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Level Progress
                </h3>
                <div className="flex gap-1.5 overflow-x-auto pb-2">
                  {LEVEL_SEQUENCE.map((level, i) => {
                    const isCompleted = i < levelIdx;
                    const isCurrent = i === levelIdx;
                    return (
                      <div
                        key={level}
                        className="flex flex-col items-center gap-1 shrink-0"
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{
                            background: isCompleted
                              ? "var(--color-success)"
                              : isCurrent
                              ? "var(--color-brand)"
                              : "rgba(255,255,255,0.08)",
                            color:
                              isCompleted || isCurrent
                                ? "white"
                                : "var(--color-text-muted)",
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

              {/* Accuracy trend chart */}
              {accuracyData.length > 0 && (
                <div>
                  <h3
                    className="text-sm font-bold mb-3"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Accuracy Trend (Last {accuracyData.length} Sessions)
                  </h3>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={accuracyData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="session"
                        tick={{ fill: "#94A3B8", fontSize: 11 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "#94A3B8", fontSize: 11 }}
                        unit="%"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#1E293B",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "12px",
                          color: "#F8FAFC",
                        }}
                        formatter={(v: number | undefined) => [
                          `${v ?? 0}%`,
                          "Accuracy",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="accuracy"
                        stroke="var(--color-brand)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-brand)", r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Recent sessions table */}
              {sessions === undefined ? (
                <p
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Loading sessions...
                </p>
              ) : sessions.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">🎲</div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    No game sessions yet
                  </p>
                </div>
              ) : (
                <div>
                  <h3
                    className="text-sm font-bold mb-3"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Recent Sessions
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ color: "var(--color-text-muted)" }}>
                          <th className="text-left py-2 pr-3 font-semibold">Date</th>
                          <th className="text-left py-2 pr-3 font-semibold">Level</th>
                          <th className="text-right py-2 pr-3 font-semibold">Correct</th>
                          <th className="text-right py-2 pr-3 font-semibold">Accuracy</th>
                          <th className="text-right py-2 font-semibold">Coins</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s: any) => (
                          <tr
                            key={s._id}
                            className="border-t"
                            style={{ borderColor: "rgba(255,255,255,0.06)" }}
                          >
                            <td
                              className="py-1.5 pr-3"
                              style={{ color: "var(--color-text-muted)" }}
                            >
                              {new Date(s.completedAt).toLocaleDateString()}
                            </td>
                            <td className="py-1.5 pr-3">
                              <span
                                className="px-1.5 py-0.5 rounded-full text-xs font-bold text-white"
                                style={{ background: "var(--color-brand)" }}
                              >
                                {s.level}
                              </span>
                            </td>
                            <td
                              className="text-right py-1.5 pr-3 tabular-nums"
                              style={{ color: "var(--color-text-primary)" }}
                            >
                              {s.wordsCorrect}
                            </td>
                            <td
                              className="text-right py-1.5 pr-3 tabular-nums font-semibold"
                              style={{ color: "var(--color-success)" }}
                            >
                              {Math.round(
                                (s.firstAttemptCorrect /
                                  Math.max(s.wordsCorrect, 1)) *
                                  100
                              )}
                              %
                            </td>
                            <td
                              className="text-right py-1.5 tabular-nums"
                              style={{ color: "var(--color-accent-gold)" }}
                            >
                              +{s.coinsEarned}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Needs practice words */}
              {practiceWords.length > 0 && (
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.25)",
                  }}
                >
                  <h3
                    className="text-sm font-bold mb-2"
                    style={{ color: "#F59E0B" }}
                  >
                    🔁 Needs Practice ({practiceWords.length} words)
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {practiceWords.map((w: any) => (
                      <span
                        key={w._id}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold"
                        style={{
                          background: "rgba(245,158,11,0.15)",
                          color: "#F59E0B",
                        }}
                      >
                        {w.word}
                        {w.isNonsense && (
                          <sup className="text-xs ml-0.5">✦</sup>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── TeacherPage ─────────────────────────────────────────────────────────────

export default function TeacherPage() {
  const { user } = useCurrentUser();

  const clerkUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const profiles = useQuery(
    api.profiles.getByUser,
    clerkUser?._id ? { userId: clerkUser._id } : "skip"
  );

  // Overview stats from profile data only (no extra queries)
  const totalBoards = (profiles ?? []).reduce(
    (sum: number, p: any) => sum + p.totalBoardsCleared,
    0
  );
  const profileAvgAccuracies = (profiles ?? [])
    .map((p: any) =>
      p.accuracyHistory.length > 0
        ? p.accuracyHistory.reduce((a: number, b: number) => a + b, 0) /
          p.accuracyHistory.length
        : null
    )
    .filter((x: number | null) => x !== null) as number[];
  const overallAvgAccuracy =
    profileAvgAccuracies.length > 0
      ? Math.round(
          profileAvgAccuracies.reduce((a, b) => a + b, 0) /
            profileAvgAccuracies.length
        )
      : null;

  const isLoading =
    clerkUser === undefined ||
    (clerkUser !== null && profiles === undefined);
  const hasNoProfiles = !isLoading && (profiles?.length ?? 0) === 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-5xl"
        >
          🎓
        </motion.div>
        <p style={{ color: "var(--color-text-muted)" }}>
          Loading teacher dashboard...
        </p>
      </div>
    );
  }

  if (hasNoProfiles) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-6">
        <div className="text-5xl">🎓</div>
        <p
          className="font-semibold"
          style={{ color: "var(--color-text-muted)" }}
        >
          No reader profiles found.
        </p>
        <a
          href="/settings"
          className="px-6 py-3 rounded-2xl font-bold text-white"
          style={{ background: "var(--color-brand)" }}
        >
          Create a Profile in Settings
        </a>
      </div>
    );
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          nav, button, a[href="/settings"] { display: none !important; }
          body { background: white !important; color: black !important; }
          * { color: black !important; background: white !important; border-color: #ccc !important; }
          [id^="profile-detail-"] { display: block !important; height: auto !important; opacity: 1 !important; overflow: visible !important; }
          .overflow-x-auto { overflow: visible !important; }
        }
      `}</style>

      <div className="flex flex-col flex-1 p-4 max-w-6xl mx-auto w-full gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1
              className="text-3xl font-extrabold text-balance"
              style={{ color: "var(--color-text-primary)" }}
            >
              🎓 Teacher Dashboard
            </h1>
            <p
              className="text-pretty"
              style={{ color: "var(--color-text-muted)" }}
            >
              Progress overview for all readers
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-white/10"
            style={{
              border: "1px solid rgba(255,255,255,0.15)",
              color: "var(--color-text-muted)",
            }}
          >
            📄 Print Report
          </button>
        </div>

        {/* Overview strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Total Profiles",
              value: profiles?.length ?? 0,
              icon: "👥",
            },
            {
              label: "Total Boards Cleared",
              value: totalBoards,
              icon: "🎲",
            },
            {
              label: "Avg Accuracy",
              value:
                overallAvgAccuracy !== null
                  ? `${overallAvgAccuracy}%`
                  : "—",
              icon: "🎯",
            },
          ].map(({ label, value, icon }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-4 text-center"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="text-3xl mb-1">{icon}</div>
              <div
                className="text-2xl font-extrabold tabular-nums"
                style={{ color: "var(--color-text-primary)" }}
              >
                {value}
              </div>
              <div
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Profile cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profiles?.map((profile: any, i: number) => (
            <motion.div
              key={profile._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <ProfileCard profile={profile} />
            </motion.div>
          ))}
        </div>
      </div>
    </>
  );
}
