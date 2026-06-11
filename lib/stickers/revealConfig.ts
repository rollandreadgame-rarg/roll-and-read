// lib/stickers/revealConfig.ts
export { revealStyle } from "./revealConfig.logic.mjs";
export interface RevealStyle {
  sound: string;
  confetti: number;
  colors: string[];
  glow: string;
  rays: boolean;
  buildMs: number;
}
