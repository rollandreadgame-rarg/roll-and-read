// Phase 2: Replace with pre-generated audio files produced by Kokoro TTS or Piper TTS
// for consistent, high-quality playback.
// File naming convention: /public/audio/words/{word}.mp3
// e.g., /public/audio/words/cat.mp3, /public/audio/words/blif.mp3

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speakWord(word: string, rate: number = 0.85): void {
  if (typeof window === "undefined") return;

  window.speechSynthesis.cancel();
  currentUtterance = new SpeechSynthesisUtterance(word);
  currentUtterance.rate = rate;
  currentUtterance.pitch = 1.0;
  currentUtterance.volume = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) =>
      v.name.includes("Samantha") ||
      v.name.includes("Karen") ||
      v.name.includes("Daniel") ||
      v.name.includes("Google US English")
  );
  if (preferred) currentUtterance.voice = preferred;

  window.speechSynthesis.speak(currentUtterance);
}

export function cancelSpeech(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
}

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve([]);
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };
  });
}
