import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { revealStyle } from "@/lib/stickers/revealConfig";

const h = vi.hoisted(() => ({
  howls: [] as { opts: { src: string[] }; play: ReturnType<typeof vi.fn>; volume: ReturnType<typeof vi.fn> }[],
  Howler: { volume: vi.fn(), mute: vi.fn(), stop: vi.fn() },
}));

vi.mock("howler", () => ({
  Howl: class {
    opts: { src: string[] };
    play = vi.fn();
    volume = vi.fn();
    constructor(opts: { src: string[] }) {
      this.opts = opts;
      h.howls.push(this);
    }
  },
  Howler: h.Howler,
}));

const publicDir = fileURLToPath(new URL("../../public", import.meta.url));
let sm: typeof import("./soundManager");

beforeEach(async () => {
  vi.resetModules();
  h.howls.length = 0;
  vi.stubGlobal("window", {});
  sm = await import("./soundManager");
});
afterEach(() => vi.unstubAllGlobals());

describe("soundManager", () => {
  test("initAudio registers every SFX once, and every file exists in public/", () => {
    sm.initAudio();
    sm.initAudio();
    expect(h.howls.length).toBe(16);
    for (const howl of h.howls) {
      const src = howl.opts.src[0];
      expect(existsSync(`${publicDir}${src}`), `${src} missing from public/`).toBe(true);
    }
  });

  test("sticker reveal sounds are registered names", () => {
    sm.initAudio();
    for (const r of ["common", "uncommon", "rare", "legendary"]) {
      const before = h.howls.map((x) => x.play.mock.calls.length).reduce((a, b) => a + b, 0);
      sm.playSound(revealStyle(r).sound);
      const after = h.howls.map((x) => x.play.mock.calls.length).reduce((a, b) => a + b, 0);
      expect(after, `${revealStyle(r).sound} is not a registered sound`).toBe(before + 1);
    }
  });

  test("unknown sound names and calls before init are silent no-ops", () => {
    expect(() => sm.playSound("correct")).not.toThrow();
    sm.initAudio();
    expect(() => sm.playSound("doesNotExist")).not.toThrow();
  });

  test("per-call volume is applied before playing", () => {
    sm.initAudio();
    sm.playSound("correct", 0.3);
    const correct = h.howls.find((x) => x.opts.src[0] === "/audio/correct.mp3")!;
    expect(correct.volume).toHaveBeenCalledWith(0.3);
    expect(correct.play).toHaveBeenCalledTimes(1);
  });

  test("word audio follows master volume and mute", () => {
    expect(sm.getEffectiveVolume()).toBe(1);
    sm.setMasterVolume(0.5);
    expect(sm.getEffectiveVolume()).toBe(0.5);
    expect(h.Howler.volume).toHaveBeenCalledWith(0.5);
    sm.setMuted(true);
    expect(sm.getEffectiveVolume()).toBe(0);
    expect(h.Howler.mute).toHaveBeenCalledWith(true);
    sm.setMuted(false);
    expect(sm.getEffectiveVolume()).toBe(0.5);
  });

  test("server-side: initAudio and playSound do nothing", async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    h.howls.length = 0;
    const mod = await import("./soundManager");
    mod.initAudio();
    mod.playSound("correct");
    expect(h.howls).toHaveLength(0);
  });
});
