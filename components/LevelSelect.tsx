"use client";

import { LEVEL_SEQUENCE, LEVEL_SKILLS } from "@/lib/levels";
import { isLevelAllowed, type Plan } from "@/convex/subscriptionConfig";

const GROUPS = [1, 2, 3, 4, 5];

interface LevelSelectProps {
  id: string;
  value: string;
  onChange: (level: string) => void;
  plan: Plan;
  describedBy?: string;
  className?: string;
}

/** Native select of the 25 sublevels, grouped by level, plan-locked ones disabled. */
export default function LevelSelect({ id, value, onChange, plan, describedBy, className }: LevelSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-describedby={describedBy}
      className={`w-full min-h-11 px-3 py-2.5 rounded-xl text-sm font-semibold ${className ?? ""}`}
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-line-strong)",
        color: "var(--color-text-primary)",
      }}
    >
      {GROUPS.map((g) => (
        <optgroup key={g} label={`Level ${g}`}>
          {LEVEL_SEQUENCE.filter((l) => l.startsWith(String(g))).map((l) => {
            const allowed = isLevelAllowed(plan, l);
            return (
              <option key={l} value={l} disabled={!allowed}>
                {l}: {LEVEL_SKILLS[l]}
                {allowed ? "" : " (paid plans)"}
              </option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
}
