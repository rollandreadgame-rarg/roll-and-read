// Word audio served from /public/audio/words/{word}.mp3 (Jessica via ElevenLabs).
// Falls back to Web Speech API if a file is missing.
//
// iPhone/iPad Safari only lets a page play audio that a tap started. A word is
// spoken ~2s after the Roll tap (after the dice animation), so a fresh
// `new Audio()` there is blocked. Instead one shared <audio> element is
// "unlocked" by playing silence inside the first tap/keypress; after that
// Safari lets that same element play any word later.

import { getEffectiveVolume } from "@/lib/audio/soundManager";

// 20 ms of real silence (16-bit mono 8 kHz). An empty WAV fails to decode in
// Safari, which then never counts the element as unlocked.
const SILENCE =
  "data:audio/wav;base64,UklGRmQBAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

let player: HTMLAudioElement | null = null;
let unlocked = false;
let currentUtterance: SpeechSynthesisUtterance | null = null;
// Bumped per speakWord so a stale clip's failure never triggers a fallback.
let playId = 0;

function getPlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio();
    player.preload = "auto";
  }
  return player;
}

function stopListening(): void {
  for (const evt of UNLOCK_EVENTS) window.removeEventListener(evt, unlock, true);
}

function unlock(): void {
  if (unlocked) return;
  unlocked = true;
  // Prime speech synthesis too (the fallback voice has the same rule).
  try {
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    // No speech synthesis in this browser.
  }
  const p = getPlayer();
  // Already playing a word means it's already allowed; never cut it off.
  if (!p.paused) {
    stopListening();
    return;
  }
  p.src = SILENCE;
  p.play().then(stopListening, () => {
    unlocked = false; // try again on the next gesture
  });
}

const UNLOCK_EVENTS = ["pointerdown", "touchend", "keydown"] as const;
if (typeof window !== "undefined") {
  for (const evt of UNLOCK_EVENTS) window.addEventListener(evt, unlock, true);
}

function wordSrc(word: string): string {
  return `/audio/words/${encodeURIComponent(word)}.mp3`;
}

export function speakWord(word: string, rate: number = 1.0): void {
  if (typeof window === "undefined") return;

  cancelSpeech();

  const volume = getEffectiveVolume();
  if (volume === 0) return;

  const id = ++playId;
  const audio = getPlayer();
  audio.src = wordSrc(word);
  // Set after src: changing the source resets playbackRate in some browsers.
  audio.defaultPlaybackRate = rate < 0.85 ? 0.75 : 1.0; // slow mode for re-speaks
  audio.playbackRate = audio.defaultPlaybackRate;
  audio.volume = volume;

  audio.play().catch((err: unknown) => {
    // Only fall back to browser TTS if THIS clip is still the current one and
    // it genuinely failed. A newer speakWord() replacing it rejects with
    // AbortError — falling back then would speak the old word over the new one.
    const aborted = err instanceof DOMException && err.name === "AbortError";
    if (id === playId && !aborted) {
      _speakFallback(word, rate, volume);
    }
  });
}

/** Play a narration clip (e.g. the tutorial) through the same unlocked player. */
export function playClip(src: string): void {
  if (typeof window === "undefined") return;
  cancelSpeech();
  const volume = getEffectiveVolume();
  if (volume === 0) return;
  const audio = getPlayer();
  audio.src = src;
  audio.defaultPlaybackRate = 1;
  audio.playbackRate = 1;
  audio.volume = volume;
  audio.play().catch(() => {
    // Autoplay blocked before the first tap: the replay button still works.
  });
}

// Warm the browser cache for a board's words so the first play is instant.
const preloaded = new Set<string>();
export function preloadWords(words: string[]): void {
  if (typeof window === "undefined") return;
  for (const w of words) {
    if (preloaded.has(w)) continue;
    preloaded.add(w);
    // A plain low-priority fetch warms the HTTP cache on every browser
    // (iOS ignores <audio preload>), without creating 30 media elements.
    fetch(wordSrc(w), { priority: "low" } as RequestInit).catch(() => {});
  }
}

export function cancelSpeech(): void {
  playId++;
  if (player && !player.paused) player.pause();
  // Some browsers (e.g. Android in-app WebViews) have no speechSynthesis; the
  // MP3 must still play there, so never assume it exists.
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

let cachedVoice: SpeechSynthesisVoice | null = null;

function _findPreferredVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) =>
      v.name.includes("Samantha") ||
      v.name.includes("Karen") ||
      v.name.includes("Google US English")
  );
  if (preferred) cachedVoice = preferred;
  return preferred ?? null;
}

function _speakFallback(word: string, rate: number, volume: number): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (typeof SpeechSynthesisUtterance === "undefined") return;
  window.speechSynthesis.cancel();
  currentUtterance = new SpeechSynthesisUtterance(word);
  currentUtterance.rate = rate;
  currentUtterance.pitch = 1.0;
  currentUtterance.volume = volume;

  const voice = _findPreferredVoice();
  if (voice) {
    currentUtterance.voice = voice;
    window.speechSynthesis.speak(currentUtterance);
  } else if (window.speechSynthesis.getVoices().length > 0) {
    // Voices are loaded but none preferred — speak now with the default voice.
    window.speechSynthesis.speak(currentUtterance);
  } else {
    // Voices not loaded yet — speak exactly once when they arrive. (Speaking
    // immediately here too would pronounce the word twice.)
    window.speechSynthesis.onvoiceschanged = () => {
      const v = _findPreferredVoice();
      if (v && currentUtterance) currentUtterance.voice = v;
      if (currentUtterance) window.speechSynthesis.speak(currentUtterance);
      window.speechSynthesis.onvoiceschanged = null;
    };
  }
}

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) { resolve([]); return; }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
  });
}
