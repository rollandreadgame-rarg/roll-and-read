// Word audio served from /public/audio/words/{word}.mp3 (Jessica via ElevenLabs).
// Falls back to Web Speech API if a file is missing.

let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speakWord(word: string, rate: number = 1.0): void {
  if (typeof window === "undefined") return;

  cancelSpeech();

  const src = `/audio/words/${encodeURIComponent(word)}.mp3`;
  const audio = new Audio(src);
  currentAudio = audio;

  audio.playbackRate = rate < 0.85 ? 0.75 : 1.0; // slow mode for re-speaks
  audio.volume = 1.0;

  audio.play().catch(() => {
    // File missing — fall back to browser TTS
    _speakFallback(word, rate);
  });
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

function _speakFallback(word: string, rate: number): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
  currentUtterance = new SpeechSynthesisUtterance(word);
  currentUtterance.rate = rate;
  currentUtterance.pitch = 1.0;
  currentUtterance.volume = 1.0;

  const voice = _findPreferredVoice();
  if (voice) {
    currentUtterance.voice = voice;
    window.speechSynthesis.speak(currentUtterance);
  } else {
    // Voices not loaded yet — wait for them
    window.speechSynthesis.onvoiceschanged = () => {
      const v = _findPreferredVoice();
      if (v && currentUtterance) currentUtterance.voice = v;
      window.speechSynthesis.speak(currentUtterance!);
      window.speechSynthesis.onvoiceschanged = null;
    };
    // Speak immediately anyway (will use default voice)
    window.speechSynthesis.speak(currentUtterance);
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
