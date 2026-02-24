"use client";

import { useEffect, useCallback, useRef } from "react";
import { initAudio, playSound, setMasterVolume } from "@/lib/audio/soundManager";

export function useAudio() {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initAudio();
    }
  }, []);

  const play = useCallback((sound: string, volume?: number) => {
    playSound(sound, volume);
  }, []);

  return { play, setVolume: setMasterVolume };
}
