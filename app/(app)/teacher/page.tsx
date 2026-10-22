"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { sessionAccuracy } from "@/lib/game/accuracy";
import { LEVEL_SEQUENCE } from "@/lib/utils";
import { LEVEL_SKILLS, type Level } from "@/lib/levels";
import RequireParentPin from "@/components/parent-pin/RequireParentPin";
import MiniDie from "@/components/game/MiniDie";
import { useParentGate } from "@/providers/ParentGateProvider";
import {
  MetricInfoButton,
  MetricInfoPanel,
  useMetricInfo,
} from "@/components/teacher-tour/MetricInfo";
import { useTeacherTour } from "@/components/teacher-tour/useTeacherTour";
import { ON_TRACK_ACCURACY_PCT, type MetricId } from "@/lib/teacher-tour/metrics";
import { Printer, ChevronDown, CircleHelp } from "lucide-react";

// Status tokens mixed toward the theme text colour so numbers stay readable
// (AA) on both the dark and the light themes.
const SUCCESS_TEXT = "var(--color-success-text)";
const WARN_TEXT = "var(--color-warning-text)";
const GOLD_TEXT = "var(--color-gold-text)";

// ─── ProfileCard ─────────────────────────────────────────────────────────────
// Separate component so each card calls its own useQuery hooks (Rules of Hooks)

// `tourAnchors`: only the first card carries the data-tour hooks the
// onboarding tour spotlights, so the tour always lands on one reader.
function ProfileCard({ profile, tourAnchors = false }: { profile: any; tourAnchors?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const info = useMetricInfo(`reader-${profile._id}`);
  const tour = (anchorId: string) => (tourAnchors ? anchorId : undefined);

  const sessions = useQuery(api.gameSessions.getForProfile, {
    profileId: profile._id as Id<"profiles">,
    limit: 8,
  });

  const wordBank = useQuery(api.wordBank.getForProfile, {
    profileId: profile._id as Id<"profiles">,
  });

  const wordsLearned = (wordBank ?? []).filter((w: any) => w.timesCorrect > 0).length;
  const practiceWords = (wordBank ?? []).filter((w: any) => w.needsPractice);

  // accuracyHistory stores fractions (0–1); display as a percentage.
  const accuracyHistory = profile.accuracyHistory ?? [];
  const avgAccuracy =
    accuracyHistory.length > 0
      ? Math.round(
          (accuracyHistory.reduce(
            (a: number, b: number) => a + b,
            0
          ) /
            accuracyHistory.length) *
            100
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
        sessionAccuracy(s) * 100
      ),
    }));

  const levelSkill = LEVEL_SKILLS[profile.currentLevel as Level];

  return (
    <motion.div layout className="panel overflow-hidden teacher-card">
      {/* ── Card Summary (always visible) ── */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full text-left p-5 transition-colors hover:bg-[var(--color-hover)]"
        aria-expanded={isExpanded}
        aria-controls={`profile-detail-${profile._id}`}
        data-tour={tour("reader-card-toggle")}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl" aria-hidden="true">{profile.avatarEmoji}</span>
          <div className="flex-1 min-w-0">
            <div
              className="font-extrabold text-lg truncate"
              style={{ color: "var(--color-text-primary)" }}
            >
              {profile.name}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background: "var(--color-brand)", color: "var(--color-on-brand)" }}
              >
                Level {profile.currentLevel}
              </span>
              {levelSkill && (
                <span className="text-xs truncate" style={{ color: "var(--color-text-secondary)" }}>
                  {levelSkill}
                </span>
              )}
            </div>
          </div>
          <ChevronDown
            size={20}
            aria-hidden="true"
            className="shrink-0 transition-transform duration-200 print:hidden"
            style={{
              color: "var(--color-text-muted)",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </div>

        {/* Quick stats grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            { label: "Boards", value: profile.totalBoardsCleared },
            {
              label: "Avg accuracy",
              value: avgAccuracy !== null ? `${avgAccuracy}%` : "—",
              color:
                avgAccuracy !== null
                  ? avgAccuracy >= ON_TRACK_ACCURACY_PCT
                    ? SUCCESS_TEXT
                    : WARN_TEXT
                  : "var(--color-text-muted)",
            },
            { label: "Words learned", value: wordsLearned },
            {
              label: "To practice",
              value: practiceWords.length,
              color: practiceWords.length > 0 ? WARN_TEXT : "var(--color-text-primary)",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl p-2.5 text-center"
              style={{ background: "var(--color-surface-2)" }}
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
              className="px-5 pb-5 flex flex-col gap-6"
              style={{ borderTop: "1px solid var(--color-line)" }}
            >
              {/* 4 stat tiles (+ their "?" explainers, which open below the grid) */}
              <div className="flex flex-col gap-2 pt-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { label: "Current level", value: profile.currentLevel },
                    {
                      label: "Boards cleared",
                      value: profile.totalBoardsCleared,
                      metricId: "boards",
                    },
                    {
                      label: "Avg accuracy",
                      value: avgAccuracy !== null ? `${avgAccuracy}%` : "—",
                      metricId: "accuracy",
                    },
                    { label: "Words learned", value: wordsLearned },
                  ] as { label: string; value: string | number; metricId?: MetricId }[]
                ).map(({ label, value, metricId }) => (
                  <div
                    key={label}
                    className="rounded-xl p-3 text-center"
                    style={{ background: "var(--color-surface-2)" }}
                    data-tour={metricId ? tour(`metric-${metricId}`) : undefined}
                  >
                    <div
                      className="font-extrabold text-lg tabular-nums"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {value}
                    </div>
                    <div
                      className="text-xs flex items-center justify-center gap-1"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {label}
                      {metricId && <MetricInfoButton metricId={metricId} info={info} />}
                    </div>
                  </div>
                ))}
              </div>
              <MetricInfoPanel metricId="boards" info={info} />
              <MetricInfoPanel metricId="accuracy" info={info} />
              </div>

              {/* Level progress */}
              <div data-tour={tour("metric-level-progress")}>
                <div className="flex items-center gap-1 mb-2">
                  <h3
                    className="text-sm font-bold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Level progress
                  </h3>
                  <MetricInfoButton metricId="level-progress" info={info} />
                </div>
                <MetricInfoPanel metricId="level-progress" info={info} className="mb-2" />
                <div className="flex flex-nowrap gap-1.5 overflow-x-auto p-1 pb-2">
                  {LEVEL_SEQUENCE.map((level, i) => {
                    const isCompleted = i < levelIdx;
                    const isCurrent = i === levelIdx;
                    return (
                      <div
                        key={level}
                        title={LEVEL_SKILLS[level]}
                        className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: isCompleted
                            ? "color-mix(in srgb, var(--color-success) 20%, var(--color-bg-surface))"
                            : isCurrent
                            ? "var(--color-brand)"
                            : "var(--color-surface-2)",
                          color: isCompleted
                            ? SUCCESS_TEXT
                            : isCurrent
                            ? "var(--color-on-brand)"
                            : "var(--color-text-muted)",
                          boxShadow: isCurrent
                            ? "0 0 0 2px var(--color-bg-surface), 0 0 0 4px var(--color-highlight)"
                            : "none",
                        }}
                      >
                        <span aria-hidden="true">{isCompleted ? "✓" : level}</span>
                        <span className="sr-only">
                          {level}
                          {isCompleted ? " done" : isCurrent ? " current" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Accuracy trend chart */}
              {accuracyData.length > 0 && (
                <div data-tour={tour("metric-trend")}>
                  <div className="flex items-center gap-1 mb-3">
                    <h3
                      className="text-sm font-bold"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      Accuracy trend (last {accuracyData.length} sessions)
                    </h3>
                    <MetricInfoButton metricId="trend" info={info} />
                  </div>
                  <MetricInfoPanel metricId="trend" info={info} className="mb-3" />
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={accuracyData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-line)"
                      />
                      <XAxis
                        dataKey="session"
                        stroke="var(--color-line-strong)"
                        tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke="var(--color-line-strong)"
                        tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                        unit="%"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-bg-surface)",
                          border: "1px solid var(--color-line-strong)",
                          borderRadius: "12px",
                          color: "var(--color-text-primary)",
                        }}
                        labelStyle={{ color: "var(--color-text-secondary)" }}
                        itemStyle={{ color: "var(--color-text-primary)" }}
                        formatter={(v: number | undefined) => [
                          `${v ?? 0}%`,
                          "Accuracy",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="accuracy"
                        stroke="var(--color-brand-secondary)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-brand-secondary)", r: 3 }}
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
                  Loading sessions…
                </p>
              ) : sessions.length === 0 ? (
                <div
                  className="flex flex-col items-center gap-2 py-6 text-center"
                  style={{ color: "var(--color-text-muted)" }}
                  data-tour={tour("metric-trend")}
                >
                  <MiniDie face={1} tone="dim" className="w-8 h-8" />
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
                    className="text-sm font-bold mb-2"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Recent sessions
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
                            style={{ borderColor: "var(--color-line)" }}
                          >
                            <td
                              className="py-2 pr-3 whitespace-nowrap"
                              style={{ color: "var(--color-text-secondary)" }}
                            >
                              {new Date(s.completedAt).toLocaleDateString()}
                            </td>
                            <td className="py-2 pr-3">
                              <span
                                className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                                style={{ background: "var(--color-brand)", color: "var(--color-on-brand)" }}
                              >
                                {s.level}
                              </span>
                            </td>
                            <td
                              className="text-right py-2 pr-3 tabular-nums"
                              style={{ color: "var(--color-text-primary)" }}
                            >
                              {s.wordsCorrect}
                            </td>
                            <td
                              className="text-right py-2 pr-3 tabular-nums font-semibold"
                              style={{ color: SUCCESS_TEXT }}
                            >
                              {Math.round(
                                sessionAccuracy(s) *
                                  100
                              )}
                              %
                            </td>
                            <td
                              className="text-right py-2 tabular-nums font-semibold"
                              style={{ color: GOLD_TEXT }}
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

              {/* Needs practice words (shown empty too, so the explainer and
                  the tour step are always reachable once the word bank loads) */}
              {wordBank !== undefined && (
                <div
                  className="rounded-2xl p-4"
                  data-tour={tour("metric-practice")}
                  style={
                    practiceWords.length > 0
                      ? {
                          background: "color-mix(in srgb, var(--color-warning) 10%, var(--color-bg-surface))",
                          border: "1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)",
                        }
                      : {
                          background: "var(--color-surface-2)",
                          border: "1px solid var(--color-line)",
                        }
                  }
                >
                  <div className="flex items-center gap-1 mb-3">
                    <h3
                      className="text-sm font-bold"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {practiceWords.length > 0
                        ? `Needs practice (${practiceWords.length} ${practiceWords.length === 1 ? "word" : "words"})`
                        : "Needs practice"}
                    </h3>
                    <MetricInfoButton metricId="practice" info={info} />
                  </div>
                  <MetricInfoPanel metricId="practice" info={info} className="mb-3" />
                  {practiceWords.length === 0 && (
                    <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                      Nothing to practise right now.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {practiceWords.map((w: any) => (
                      <span
                        key={w._id}
                        className="px-2.5 py-1 rounded-lg text-sm font-bold"
                        style={{
                          fontFamily: "var(--font-word)",
                          background: "var(--card-paper)",
                          color: "var(--card-ink)",
                          border: "1px solid var(--card-edge)",
                        }}
                      >
                        {w.word}
                        {w.isNonsense && (
                          <sup className="text-xs ml-0.5" role="img" aria-label="silly word">👽</sup>
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
    .map((p: any) => {
      const hist = p.accuracyHistory ?? [];
      return hist.length > 0
        ? hist.reduce((a: number, b: number) => a + b, 0) / hist.length
        : null;
    })
    .filter((x: number | null) => x !== null) as number[];
  const overallAvgAccuracy =
    profileAvgAccuracies.length > 0
      ? Math.round(
          (profileAvgAccuracies.reduce((a, b) => a + b, 0) /
            profileAvgAccuracies.length) *
            100
        )
      : null;

  const isLoading =
    clerkUser === undefined ||
    (clerkUser !== null && profiles === undefined);
  const hasNoProfiles = !isLoading && (profiles?.length ?? 0) === 0;

  // ── Onboarding tour ──
  const gate = useParentGate();
  const { start: startTour, announcement } = useTeacherTour({
    variant: hasNoProfiles ? "empty" : "full",
    hasPin: gate.hasPin,
  });
  const markTourSeen = useMutation(api.users.markTeacherTourSeen);
  const autoStartedRef = useRef(false);
  // Auto-launch once, on the first visit that has a reader to explain and
  // the dashboard actually on screen (PIN unlocked). With zero readers we
  // don't auto-launch or set the flag, so the full tour still plays the
  // first time a reader exists; "How this works" runs the short version.
  const canAutoStart =
    !isLoading &&
    !hasNoProfiles &&
    Boolean(clerkUser) &&
    clerkUser?.hasSeenTeacherTour !== true &&
    gate.loaded &&
    (!gate.hasPin || gate.unlocked);

  useEffect(() => {
    if (!canAutoStart || autoStartedRef.current) return;
    // Let the dashboard paint (and the cards animate in) first.
    const t = setTimeout(() => {
      autoStartedRef.current = true;
      void startTour();
      markTourSeen({}).catch((err) => console.error("markTeacherTourSeen failed", err));
    }, 700);
    return () => clearTimeout(t);
  }, [canAutoStart, startTour, markTourSeen]);

  const tourLiveRegion = (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </p>
  );

  const howThisWorksButton = (
    <button
      type="button"
      data-tour="tour-replay"
      onClick={() => void startTour()}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-colors hover:bg-[var(--color-hover)]"
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-line)",
        color: "var(--color-text-primary)",
      }}
    >
      <CircleHelp size={16} aria-hidden="true" />
      How this works
    </button>
  );

  if (isLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center flex-1 gap-3 p-6"
        style={{ color: "var(--color-text-muted)" }}
      >
        <MiniDie face={5} className="w-10 h-10" />
        <p role="status">Loading teacher dashboard…</p>
      </div>
    );
  }

  if (hasNoProfiles) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-6 text-center">
        <MiniDie face={1} className="w-10 h-10" />
        <p
          className="font-semibold"
          style={{ color: "var(--color-text-secondary)" }}
        >
          No reader profiles found.
        </p>
        <a
          href="/settings"
          data-tour="add-reader"
          className="btn-primary inline-flex items-center justify-center px-6 py-3"
        >
          Create a profile in Settings
        </a>
        {howThisWorksButton}
        {tourLiveRegion}
      </div>
    );
  }

  return (
    <RequireParentPin>
    <>
      {/* Print styles: the summary toggle (aria-expanded) stays visible so the
          report shows every reader; only controls are hidden. */}
      <style>{`
        @media print {
          nav, button:not([aria-expanded]), a[href="/settings"] { display: none !important; }
          body { background: white !important; color: black !important; }
          * { color: black !important; background: white !important; border-color: #ccc !important; box-shadow: none !important; }
          [id^="profile-detail-"] { display: block !important; height: auto !important; opacity: 1 !important; overflow: visible !important; }
          .overflow-x-auto { overflow: visible !important; }
          .teacher-card { break-inside: avoid; }
        }
      `}</style>

      <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 gap-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <h1
              className="text-2xl sm:text-3xl font-extrabold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Teacher dashboard
            </h1>
            <p
              className="mt-1 text-pretty"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Progress overview for all readers
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          {howThisWorksButton}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-colors hover:bg-[var(--color-hover)]"
            style={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-line)",
              color: "var(--color-text-primary)",
            }}
          >
            <Printer size={16} aria-hidden="true" />
            Print report
          </button>
          </div>
        </div>

        {/* Overview strip */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3" data-tour="overview">
          {[
            {
              label: "Profiles",
              value: profiles?.length ?? 0,
            },
            {
              label: "Boards cleared",
              value: totalBoards,
            },
            {
              label: "Avg accuracy",
              value:
                overallAvgAccuracy !== null
                  ? `${overallAvgAccuracy}%`
                  : "—",
            },
          ].map(({ label, value }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="panel px-2 py-4 sm:p-5 text-center"
            >
              <div
                className="text-2xl sm:text-3xl font-extrabold tabular-nums"
                style={{ color: "var(--color-text-primary)" }}
              >
                {value}
              </div>
              <div
                className="mt-0.5 text-xs sm:text-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                {label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Profile cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {profiles?.map((profile: any, i: number) => (
            <motion.div
              key={profile._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <ProfileCard profile={profile} tourAnchors={i === 0} />
            </motion.div>
          ))}
        </div>
      </div>
      {tourLiveRegion}
    </>
    </RequireParentPin>
  );
}
