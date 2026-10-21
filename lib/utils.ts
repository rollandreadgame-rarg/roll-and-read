import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatCoins(amount: number): string {
  return amount.toLocaleString();
}

export { LEVEL_SEQUENCE, getNextLevel, isValidLevel, normalizeLevel, type Level } from "./levels";

export function getLevelNumber(level: string): number {
  return parseInt(level.charAt(0));
}

export function getLevelColor(level: string): string {
  const num = getLevelNumber(level);
  const colors: Record<number, string> = {
    1: "bg-emerald-500",
    2: "bg-blue-500",
    3: "bg-purple-500",
    4: "bg-orange-500",
    5: "bg-rose-500",
  };
  return colors[num] ?? "bg-gray-500";
}

export function isPaidLevel(level: string): boolean {
  return getLevelNumber(level) >= 2;
}
