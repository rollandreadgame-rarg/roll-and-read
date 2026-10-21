import { cn } from "@/lib/utils";

// Pip centres on a 0–24 grid
const PIPS: Record<number, [number, number][]> = {
  1: [[12, 12]],
  2: [[7, 7], [17, 17]],
  3: [[6.5, 6.5], [12, 12], [17.5, 17.5]],
  4: [[7, 7], [17, 7], [7, 17], [17, 17]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7, 6], [17, 6], [7, 12], [17, 12], [7, 18], [17, 18]],
};

interface MiniDieProps {
  face: number;
  /** "lit" = ivory die, "dim" = flat outline (cleared / waiting) */
  tone?: "lit" | "dim";
  className?: string;
}

/** A small die face, so young players can match rows to the roll by pips. */
export default function MiniDie({ face, tone = "lit", className }: MiniDieProps) {
  const lit = tone === "lit";
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect
        x="1"
        y="1"
        width="22"
        height="22"
        rx="6"
        fill={lit ? "#FBF6EA" : "transparent"}
        stroke={lit ? "rgba(23,32,46,0.18)" : "currentColor"}
        strokeWidth={lit ? 1 : 1.5}
      />
      {(PIPS[face] ?? PIPS[1]).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={2.1} fill={lit ? "#17202E" : "currentColor"} />
      ))}
    </svg>
  );
}
