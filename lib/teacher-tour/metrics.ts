// Single source of truth for the grown-up explainer copy on /teacher.
// Both the spotlight tour (components/teacher-tour/runTour.ts) and the "?"
// info panels (components/teacher-tour/MetricInfo.tsx) read from here, so the
// two never drift apart.
//
// Copy rules: plain words, sentence case, and never the reader's actual
// numbers. Everything must read correctly on day one with an empty chart.

import { LEVEL_UP_ACCURACY, LEVEL_UP_MIN_BOARDS } from "@/lib/game/boardGenerator";

/** First-try accuracy a reader needs to be "on track" (and to move up). */
export const ON_TRACK_ACCURACY_PCT = Math.round(LEVEL_UP_ACCURACY * 100);
const PCT = `${ON_TRACK_ACCURACY_PCT}%`;

export type MetricId = "accuracy" | "boards" | "level-progress" | "trend" | "practice";

export interface MetricExplainer {
  id: MetricId;
  /** Matches data-tour="<anchorId>" on the teacher page. */
  anchorId: string;
  title: string;
  /** What this metric is. */
  what: string;
  /** What going well looks like. */
  goodSignal: string;
  /** What a dip or slide looks like, and what to do about it. */
  watchSignal: string;
}

export const GOOD_LABEL = "Going well:";
export const WATCH_LABEL = "Worth watching:";

export const TOUR_WELCOME = {
  title: "Welcome to your teacher dashboard",
  bodyWithPin:
    "This page shows how each reader is doing. It is locked with your parent PIN, so only grown-ups can open it. " +
    "To come back, choose Teacher (the graduation cap) at the top of the screen and enter your PIN. " +
    "You can set or change a reader's level in Settings.",
  bodyNoPin:
    "This page shows how each reader is doing. To come back, choose Teacher (the graduation cap) at the top of the screen. " +
    "You can lock grown-up pages with a parent PIN, and set or change a reader's level, in Settings.",
};

export const TOUR_OVERVIEW = {
  anchorId: "overview",
  title: "All readers at a glance",
  body:
    "These totals add up every reader on your account. Open a reader's card below to see their own numbers.",
};

export const TOUR_ADD_READER = {
  anchorId: "add-reader",
  title: "Add your first reader",
  body:
    "Once you add a reader in Settings, their progress shows up here. Come back after they've played a board or two, " +
    "and use the How this works button for a walkthrough of each number.",
};

export const TOUR_CLOSING = {
  anchorId: "tour-replay",
  title: "That's the tour",
  body:
    "You can replay it any time with the How this works button. " +
    "Each number on the page also has a ? button that explains it.",
};

export const METRICS: MetricExplainer[] = [
  {
    id: "accuracy",
    anchorId: "metric-accuracy",
    title: "Average accuracy",
    what: "How often your reader reads a word correctly on the first try, averaged over their recent boards.",
    goodSignal: `${PCT} or higher means they're on track at their current level.`,
    watchSignal:
      `Staying well below ${PCT} for a while means this level is still tricky. That's normal, and more play at the level builds it up.`,
  },
  {
    id: "boards",
    anchorId: "metric-boards",
    title: "Boards cleared",
    what: "How many game boards your reader has finished in total.",
    goodSignal: "A number that keeps going up means they're playing regularly.",
    watchSignal:
      "If it hasn't moved for a while, try short sessions more often. A few minutes a day works well.",
  },
  {
    id: "level-progress",
    anchorId: "metric-level-progress",
    title: "Level progress",
    what:
      "The reading levels from 1A to 5B. The highlighted circle is your reader's current level, and check marks show levels they've finished.",
    goodSignal:
      `Moving along over the weeks. A reader moves up after clearing at least ${LEVEL_UP_MIN_BOARDS} boards at a level, ` +
      `when their last 3 boards average ${PCT} or better first-try accuracy.`,
    watchSignal:
      "Staying on one level for a while is normal. Each board also mixes in review words from earlier levels, so older sounds stay fresh.",
  },
  {
    id: "trend",
    anchorId: "metric-trend",
    title: "Accuracy trend",
    what:
      "Each dot is one game session (one finished board), oldest on the left and newest on the right. The chart appears after the first session.",
    goodSignal: "A line that climbs over time means your reader is improving.",
    watchSignal:
      "A line that slides down over several sessions can mean this level needs more practice. Some ups and downs are normal.",
  },
  {
    id: "practice",
    anchorId: "metric-practice",
    title: "Needs practice",
    what:
      "Words your reader missed or needed help with. Missed words automatically come back in the game on later boards until they're read on the first try. " +
      "You can also practise them on the Practice page.",
    goodSignal: "A list that gets shorter means tricky words are sticking.",
    watchSignal: "A list that keeps growing points to sounds worth reading aloud together.",
  },
];

export const METRIC_BY_ID = Object.fromEntries(
  METRICS.map((m) => [m.id, m])
) as Record<MetricId, MetricExplainer>;
