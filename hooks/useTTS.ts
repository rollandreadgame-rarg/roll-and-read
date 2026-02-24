"use client";

import { useCallback, useEffect } from "react";
import { speakWord, cancelSpeech, loadVoices } from "@/lib/tts/webSpeechTTS";

export function useTTS() {
  useEffect(() => {
    // Preload voices
    if (typeof window !== "undefined") {
      loadVoices();
    }
  }, []);

  const speak = useCallback((word: string, rate?: number) => {
    speakWord(word, rate);
  }, []);

  const cancel = useCallback(() => {
    cancelSpeech();
  }, []);

  return { speak, cancel };
}
