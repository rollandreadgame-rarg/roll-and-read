// Word audio player. Runs in node with hand-rolled browser stubs (window,
// Audio, speechSynthesis, fetch); module state is reset per test.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({ volume: 1 }));
vi.mock("@/lib/audio/soundManager", () => ({ getEffectiveVolume: () => h.volume }));

type Deferred = { resolve: () => void; reject: (e: unknown) => void };

class FakeAudio {
  static instances: FakeAudio[] = [];
  src = "";
  paused = true;
  preload = "";
  volume = 1;
  playbackRate = 1;
  defaultPlaybackRate = 1;
  plays: (Deferred & { src: string })[] = [];
  constructor() {
    FakeAudio.instances.push(this);
  }
  play = vi.fn(() => {
    return new Promise<void>((resolve, reject) => {
      this.plays.push({
        src: this.src,
        resolve: () => {
          this.paused = false;
          resolve();
        },
        reject,
      });
    });
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
}

class FakeUtterance {
  text: string;
  volume = 1;
  rate = 1;
  pitch = 1;
  voice: unknown = null;
  constructor(text: string) {
    this.text = text;
  }
}

type Listener = (...args: unknown[]) => void;
let listeners: Map<string, Set<Listener>>;
let synth: {
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  getVoices: ReturnType<typeof vi.fn>;
  onvoiceschanged: null | (() => void);
};
let voices: { name: string }[];
let fetchMock: ReturnType<typeof vi.fn>;
let tts: typeof import("./webSpeechTTS");

function installWindow(opts: { speechSynthesis?: boolean } = {}) {
  listeners = new Map();
  voices = [{ name: "Samantha" }];
  synth = {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: vi.fn(() => voices),
    onvoiceschanged: null,
  };
  const win: Record<string, unknown> = {
    addEventListener: vi.fn((type: string, fn: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: Listener) => {
      listeners.get(type)?.delete(fn);
    }),
  };
  if (opts.speechSynthesis !== false) win.speechSynthesis = synth;
  vi.stubGlobal("window", win);
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  fetchMock = vi.fn(() => Promise.resolve(new Response("")));
  vi.stubGlobal("fetch", fetchMock);
}

function gesture(type = "pointerdown") {
  for (const fn of [...(listeners.get(type) ?? [])]) fn(new Event(type));
}

const listenerCount = () => [...listeners.values()].reduce((n, s) => n + s.size, 0);
const player = () => FakeAudio.instances[FakeAudio.instances.length - 1];
const flush = () => new Promise((r) => setTimeout(r, 0));
const spokenTexts = () => synth.speak.mock.calls.map(([u]) => (u as FakeUtterance).text);

async function load(opts?: { speechSynthesis?: boolean }) {
  vi.resetModules();
  FakeAudio.instances = [];
  installWindow(opts);
  tts = await import("./webSpeechTTS");
}

beforeEach(async () => {
  h.volume = 1;
  await load();
});
afterEach(() => vi.unstubAllGlobals());

describe("iOS unlock", () => {
  test("listens for the first tap/click/key in the capture phase", () => {
    const win = window as unknown as { addEventListener: ReturnType<typeof vi.fn> };
    const types = win.addEventListener.mock.calls.map(([t, , capture]) => [t, capture]);
    expect(types).toEqual([
      ["pointerdown", true],
      ["touchend", true],
      ["keydown", true],
    ]);
  });

  test("first gesture plays silence on the shared player; listeners removed only after play succeeds", async () => {
    gesture("pointerdown");
    const p = player();
    expect(p.src).toMatch(/^data:audio\/wav;base64,/);
    expect(p.play).toHaveBeenCalledTimes(1);
    expect(listenerCount()).toBe(3); // still listening until play resolves
    // Also primes speech synthesis with a silent utterance.
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).volume).toBe(0);

    p.plays[0].resolve();
    await flush();
    expect(listenerCount()).toBe(0);
  });

  test("a failed unlock keeps listening and retries on the next gesture", async () => {
    gesture("touchend");
    const p = player();
    p.plays[0].reject(new DOMException("blocked", "NotAllowedError"));
    await flush();
    expect(listenerCount()).toBe(3);

    gesture("keydown");
    expect(p.play).toHaveBeenCalledTimes(2);
    p.plays[1].resolve();
    await flush();
    expect(listenerCount()).toBe(0);
  });

  test("repeated gestures while an unlock is pending don't stack extra plays", () => {
    gesture("pointerdown");
    gesture("touchend");
    gesture("pointerdown");
    expect(player().play).toHaveBeenCalledTimes(1);
  });

  test("a gesture while a word is already playing never cuts the word off", async () => {
    tts.speakWord("cat");
    const p = player();
    p.plays[0].resolve();
    await flush();
    expect(p.paused).toBe(false);

    gesture("pointerdown");
    expect(p.src).toBe("/audio/words/cat.mp3");
    expect(p.play).toHaveBeenCalledTimes(1);
    expect(listenerCount()).toBe(0);
  });

  test("unlock still works in a browser without speechSynthesis", async () => {
    await load({ speechSynthesis: false });
    expect(() => gesture("pointerdown")).not.toThrow();
    player().plays[0].resolve();
    await flush();
    expect(listenerCount()).toBe(0);
  });
});

describe("speakWord", () => {
  test("plays /audio/words/<word>.mp3 on ONE shared player at the effective volume", () => {
    h.volume = 0.4;
    tts.speakWord("cat");
    tts.speakWord("dog");
    expect(FakeAudio.instances).toHaveLength(1);
    const p = player();
    expect(p.src).toBe("/audio/words/dog.mp3");
    expect(p.volume).toBe(0.4);
    expect(p.play).toHaveBeenCalledTimes(2);
  });

  test("normal rate plays at 1x; a slow re-speak (rate < 0.85) plays at 0.75x", () => {
    tts.speakWord("cat", 1);
    expect(player().playbackRate).toBe(1);
    tts.speakWord("cat", 0.7);
    expect(player().playbackRate).toBe(0.75);
    expect(player().defaultPlaybackRate).toBe(0.75);
    tts.speakWord("cat", 0.85);
    expect(player().playbackRate).toBe(1);
  });

  test.each([
    ["ice cream", "/audio/words/ice%20cream.mp3"],
    ["don't", "/audio/words/don't.mp3"],
    ["a/b", "/audio/words/a%2Fb.mp3"],
    ["what?", "/audio/words/what%3F.mp3"],
    ["#1", "/audio/words/%231.mp3"],
    ["café", "/audio/words/caf%C3%A9.mp3"],
    ["..", "/audio/words/...mp3"],
  ])("encodes %j safely as %s", (word, src) => {
    tts.speakWord(word);
    expect(player().src).toBe(src);
  });

  test("muted (volume 0): nothing plays, nothing is spoken, and the current word stops", async () => {
    tts.speakWord("cat");
    const p = player();
    p.plays[0].resolve();
    await flush();
    h.volume = 0;
    tts.speakWord("dog");
    expect(p.pause).toHaveBeenCalled();
    expect(p.play).toHaveBeenCalledTimes(1);
    expect(p.src).toBe("/audio/words/cat.mp3");
    expect(synth.speak).not.toHaveBeenCalled();
  });

  test("a missing MP3 (current clip fails) falls back to the browser voice once", async () => {
    h.volume = 0.6;
    tts.speakWord("zib", 0.7);
    player().plays[0].reject(new DOMException("404", "NotSupportedError"));
    await flush();
    expect(spokenTexts()).toEqual(["zib"]);
    const u = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(u.rate).toBe(0.7);
    expect(u.volume).toBe(0.6);
    expect(u.voice).toEqual({ name: "Samantha" });
  });

  test("a plain Error rejection also falls back", async () => {
    tts.speakWord("zib");
    player().plays[0].reject(new Error("decode failed"));
    await flush();
    expect(spokenTexts()).toEqual(["zib"]);
  });

  test("AbortError never falls back", async () => {
    tts.speakWord("cat");
    player().plays[0].reject(new DOMException("aborted", "AbortError"));
    await flush();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  test("a stale clip's failure (replaced by a newer word) never speaks the old word", async () => {
    tts.speakWord("cat");
    tts.speakWord("dog");
    const p = player();
    p.plays[0].reject(new DOMException("blocked", "NotAllowedError"));
    await flush();
    expect(synth.speak).not.toHaveBeenCalled();
    p.plays[1].resolve();
    await flush();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  test("cancelSpeech makes the in-flight clip stale too", async () => {
    tts.speakWord("cat");
    tts.cancelSpeech();
    player().plays[0].reject(new Error("failed"));
    await flush();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  test("fallback with voices loaded but none preferred speaks with the default voice", async () => {
    voices = [{ name: "Some Other Voice" }];
    tts.speakWord("zib");
    player().plays[0].reject(new Error("404"));
    await flush();
    expect(spokenTexts()).toEqual(["zib"]);
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).voice).toBeNull();
  });

  test("fallback before voices load speaks exactly once when they arrive", async () => {
    voices = [];
    tts.speakWord("zib");
    player().plays[0].reject(new Error("404"));
    await flush();
    expect(synth.speak).not.toHaveBeenCalled();
    voices = [{ name: "Karen" }];
    synth.onvoiceschanged!();
    expect(spokenTexts()).toEqual(["zib"]);
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).voice).toEqual({ name: "Karen" });
    expect(synth.onvoiceschanged).toBeNull();
  });

  test("speakWord still plays the MP3 in a browser without speechSynthesis", async () => {
    await load({ speechSynthesis: false });
    expect(() => tts.speakWord("cat")).not.toThrow();
    expect(player().src).toBe("/audio/words/cat.mp3");
    expect(player().play).toHaveBeenCalledTimes(1);
  });

  test("a failed MP3 without speechSynthesis fails quietly (no unhandled rejection)", async () => {
    await load({ speechSynthesis: false });
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      tts.speakWord("zib");
      player().plays[0].reject(new Error("404"));
      await flush();
      await flush();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});

describe("playClip / cancelSpeech / preloadWords / loadVoices", () => {
  test("playClip plays through the same player at 1x and never falls back to speech", async () => {
    tts.speakWord("cat", 0.7);
    tts.playClip("/audio/tutorial/step-1.mp3");
    const p = player();
    expect(FakeAudio.instances).toHaveLength(1);
    expect(p.src).toBe("/audio/tutorial/step-1.mp3");
    expect(p.playbackRate).toBe(1);
    p.plays[1].reject(new DOMException("blocked", "NotAllowedError"));
    p.plays[0].reject(new Error("stale"));
    await flush();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  test("playClip is silent when muted", () => {
    h.volume = 0;
    tts.playClip("/audio/tutorial/step-1.mp3");
    expect(FakeAudio.instances.length === 0 || player().play.mock.calls.length === 0).toBe(true);
  });

  test("cancelSpeech pauses a playing word and cancels the browser voice", async () => {
    tts.speakWord("cat");
    player().plays[0].resolve();
    await flush();
    tts.cancelSpeech();
    expect(player().pause).toHaveBeenCalled();
    expect(synth.cancel).toHaveBeenCalled();
  });

  test("cancelSpeech before anything was played is safe", () => {
    expect(() => tts.cancelSpeech()).not.toThrow();
  });

  test("preloadWords fetches each word once at low priority, encoded, and swallows errors", async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    tts.preloadWords(["cat", "ice cream", "cat"]);
    tts.preloadWords(["cat", "dog"]);
    await flush();
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([
      "/audio/words/cat.mp3",
      "/audio/words/ice%20cream.mp3",
      "/audio/words/dog.mp3",
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ priority: "low" });
  });

  test("loadVoices resolves immediately when voices exist, otherwise on voiceschanged", async () => {
    await expect(tts.loadVoices()).resolves.toEqual([{ name: "Samantha" }]);
    voices = [];
    const p = tts.loadVoices();
    voices = [{ name: "Google US English" }];
    synth.onvoiceschanged!();
    await expect(p).resolves.toEqual([{ name: "Google US English" }]);
  });

  test("loadVoices resolves [] in a browser without speechSynthesis", async () => {
    await load({ speechSynthesis: false });
    await expect(tts.loadVoices()).resolves.toEqual([]);
  });
});

describe("server-side (no window)", () => {
  test("every export is a safe no-op", async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    const mod = await import("./webSpeechTTS");
    expect(() => mod.speakWord("cat")).not.toThrow();
    expect(() => mod.playClip("/x.mp3")).not.toThrow();
    expect(() => mod.preloadWords(["cat"])).not.toThrow();
    expect(() => mod.cancelSpeech()).not.toThrow();
    await expect(mod.loadVoices()).resolves.toEqual([]);
  });
});
