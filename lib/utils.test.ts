import { describe, expect, test, vi } from "vitest";
import { cn, formatCoins, getLevelColor, getLevelNumber, isPaidLevel, shuffle, sleep } from "./utils";
import * as levels from "./levels";
import * as utils from "./utils";
import { SUPPORT_EMAIL } from "./contact";

describe("shuffle", () => {
  test("returns a new array with the same items and leaves the input alone", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const copy = [...input];
    const out = shuffle(input);
    expect(out).not.toBe(input);
    expect(input).toEqual(copy);
    expect([...out].sort((a, b) => a - b)).toEqual(copy);
  });

  test("handles empty and single-item arrays", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(["x"])).toEqual(["x"]);
  });

  test("Fisher–Yates with Math.random=0 rotates deterministically (every index reachable)", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    expect(shuffle([1, 2, 3, 4])).toEqual([2, 3, 4, 1]);
    spy.mockReturnValue(0.999999);
    expect(shuffle([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
    spy.mockRestore();
  });

  test("is roughly uniform: each item lands first about 1/n of the time", () => {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 8000; i++) counts[shuffle([0, 1, 2, 3])[0]]++;
    for (const c of counts) expect(c).toBeGreaterThan(1600);
  });
});

describe("misc helpers", () => {
  test("cn merges classes and lets later Tailwind classes win", () => {
    expect(cn("p-2", false && "hidden", "p-4", undefined, "text-sm")).toBe("p-4 text-sm");
  });

  test("sleep resolves after the given time", async () => {
    vi.useFakeTimers();
    let done = false;
    const p = sleep(500).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
    vi.useRealTimers();
  });

  test("formatCoins groups thousands", () => {
    expect(formatCoins(0)).toBe("0");
    expect(formatCoins(2500)).toMatch(/^2.500$/);
  });

  test("level number and colour", () => {
    expect(getLevelNumber("3B")).toBe(3);
    expect(getLevelColor("1A")).toBe("bg-emerald-500");
    expect(getLevelColor("5B")).toBe("bg-rose-500");
    expect(getLevelColor("")).toBe("bg-gray-500");
    expect(getLevelColor("9Z")).toBe("bg-gray-500");
  });

  test("isPaidLevel matches the free-plan rule (level 1 free, 2+ paid)", () => {
    for (const lvl of levels.LEVEL_SEQUENCE) expect(isPaidLevel(lvl)).toBe(!lvl.startsWith("1"));
    expect(isPaidLevel("")).toBe(false);
  });

  test("re-exports the single level source of truth", () => {
    expect(utils.LEVEL_SEQUENCE).toBe(levels.LEVEL_SEQUENCE);
    expect(utils.getNextLevel).toBe(levels.getNextLevel);
    expect(utils.normalizeLevel).toBe(levels.normalizeLevel);
  });

  test("support email is a plain address on the app domain", () => {
    expect(SUPPORT_EMAIL).toMatch(/^[a-z]+@rollandreadgame\.com$/);
  });
});
