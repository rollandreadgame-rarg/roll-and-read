// Word audio served from /public/audio/words/{word}.mp3 (Jessica via ElevenLabs).
// Falls back to Web Speech API if a file is missing.

import { getEffectiveVolume } from "@/lib/audio/soundManager";

let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

function wordSrc(word: string): string {
  return `/audio/words/${encodeURIComponent(word)}.mp3`;
}

export function speakWord(word: string, rate: number = 1.0): void {
  if (typeof window === "undefined") return;

  cancelSpeech();

  const volume = getEffectiveVolume();
  if (volume === 0) return;

  const audio = new Audio(wordSrc(word));
  currentAudio = audio;

  audio.playbackRate = rate < 0.85 ? 0.75 : 1.0; // slow mode for re-speaks
  audio.volume = volume;

  audio.play().catch((err: unknown) => {
    // Only fall back to browser TTS if THIS clip is still the current one and
    // it genuinely failed to load. A newer speakWord() pausing it rejects with
    // AbortError — falling back then would speak the old word over the new one.
    const aborted = err instanceof DOMException && err.name === "AbortError";
    if (currentAudio === audio && !aborted) {
      _speakFallback(word, rate, volume);
    }
  });
}

// Warm the browser cache for a board's words so the first play is instant.
const preloaded = new Set<string>();
export function preloadWords(words: string[]): void {
  if (typeof window === "undefined") return;
  for (const w of words) {
    if (preloaded.has(w)) continue;
    preloaded.add(w);
    const a = new Audio();
    a.preload = "auto";
    a.src = wordSrc(w);
  }
}

export function cancelSpeech(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (typeof window !== "undefined") {
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
  if (typeof window === "undefined") return;
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
    if (typeof window === "undefined") { resolve([]); return; }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { resolve(voices); return; }
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
  });
}
