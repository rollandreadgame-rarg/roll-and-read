// lib/stickers/revealConfig.logic.mjs
// Rarity-tiered reveal payoff: sound key, confetti amount/colors, glow, rays,
// and the anticipation-build duration. Keeps the visual/audio escalation in one
// place so the component stays declarative. (.mjs so node --test can import it.)
const STYLES = {
  common: {
    sound: "revealCommon",
    confetti: 0,
    colors: ["#9CA3AF", "#D1D5DB", "#FFFFFF"],
    glow: "rgba(148,163,184,0.5)",
    rays: false,
    buildMs: 350,
  },
  uncommon: {
    sound: "revealCommon",
    confetti: 24,
    colors: ["#3B82F6", "#93C5FD", "#FFFFFF"],
    glow: "rgba(59,130,246,0.6)",
    rays: false,
    buildMs: 350,
  },
  rare: {
    sound: "revealRare",
    confetti: 90,
    colors: ["#A855F7", "#D8B4FE", "#FFFFFF"],
    glow: "rgba(168,85,247,0.7)",
    rays: false,
    buildMs: 600,
  },
  legendary: {
    sound: "revealLegendary",
    confetti: 180,
    colors: ["#F59E0B", "#FCD34D", "#FDE68A", "#FFFFFF"],
    glow: "rgba(245,158,11,0.85)",
    rays: true,
    buildMs: 850,
  },
};

export function revealStyle(rarity) {
  return STYLES[rarity] || STYLES.common;
}
