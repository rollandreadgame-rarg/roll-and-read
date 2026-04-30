// Pure helpers that decide which milestones a board completion triggered.
// Called from useGameState after the completedBoard mutation returns.

export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export interface MilestoneTrigger {
  type:
    | "first-board"
    | "boards-multiple"
    | "perfect-accuracy"
    | "streak-3"
    | "streak-7"
    | "streak-30"
    | "level-up";
  rarity: Rarity;
  label: string;
}

interface Args {
  totalBoardsCleared: number;        // count after this board
  accuracy: number;                   // 0..1, this board only
  previousStreakDays: number;
  newStreakDays: number;
  isLevelUp: boolean;
}

const PERFECT_ACCURACY_THRESHOLD = 0.99; // tolerate floating point edges

export function getMilestonesForBoard(args: Args): MilestoneTrigger[] {
  const out: MilestoneTrigger[] = [];

  if (args.totalBoardsCleared === 1) {
    out.push({ type: "first-board", rarity: "common", label: "First board cleared!" });
  } else if (args.totalBoardsCleared % 5 === 0) {
    // Every 5 boards cleared. Bump rarity at 25/50/100.
    let rarity: Rarity = "uncommon";
    if (args.totalBoardsCleared >= 100) rarity = "legendary";
    else if (args.totalBoardsCleared >= 50) rarity = "rare";
    else if (args.totalBoardsCleared >= 25) rarity = "rare";
    out.push({
      type: "boards-multiple",
      rarity,
      label: `${args.totalBoardsCleared} boards cleared!`,
    });
  }

  if (args.accuracy >= PERFECT_ACCURACY_THRESHOLD) {
    out.push({ type: "perfect-accuracy", rarity: "rare", label: "Perfect board — 100% accuracy!" });
  }

  // Streak milestones fire only when crossing the threshold today.
  const crossed = (n: number) =>
    args.previousStreakDays < n && args.newStreakDays >= n;

  if (crossed(30)) {
    out.push({ type: "streak-30", rarity: "legendary", label: "30-day streak!" });
  } else if (crossed(7)) {
    out.push({ type: "streak-7", rarity: "rare", label: "7-day streak!" });
  } else if (crossed(3)) {
    out.push({ type: "streak-3", rarity: "uncommon", label: "3-day streak!" });
  }

  if (args.isLevelUp) {
    out.push({ type: "level-up", rarity: "rare", label: "Level up!" });
  }

  return out;
}
