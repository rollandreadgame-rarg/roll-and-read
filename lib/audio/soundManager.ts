"use client";

import { Howl, Howler } from "howler";

let initialized = false;
const sfx: Record<string, Howl> = {};

// Create silent placeholder audio data URL (1 second of silence)
// This allows the game to function even without actual audio files
const SILENCE_DATA_URL = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export function initAudio(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const audioFiles: Record<string, string> = {
    diceRoll: "/audio/dice-roll.mp3",
    diceLand: "/audio/dice-land.mp3",
    correct: "/audio/correct.mp3",
    wrong: "/audio/wrong.mp3",
    rowComplete: "/audio/row-complete.mp3",
    boardComplete: "/audio/board-complete.mp3",
    levelUp: "/audio/level-up.mp3",
    coin: "/audio/coin.mp3",
    stickerReveal: "/audio/sticker-reveal.mp3",
    wordFly: "/audio/word-fly.mp3",
  };

  for (const [key, src] of Object.entries(audioFiles)) {
    sfx[key] = new Howl({
      src: [src, SILENCE_DATA_URL],
      preload: true,
      volume: 0.7,
      onloaderror: () => {
        // Silently fail — game works without audio
      },
    });
  }
}

export function playSound(
  name: keyof typeof sfx | string,
  volume?: number
): void {
  if (typeof window === "undefined") return;
  const sound = sfx[name];
  if (!sound) return;
  if (volume !== undefined) sound.volume(volume);
  sound.play();
}

export function setMasterVolume(volume: number): void {
  Howler.volume(volume);
}

export function stopAll(): void {
  Howler.stop();
}
