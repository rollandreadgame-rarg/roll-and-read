// lib/stickers/packConfig.ts
// App-facing re-export of the pure pack-config logic (kept in .mjs so it can be
// unit-tested with node --test, which cannot import .ts).
export { CATEGORY_LEAN, pickRewardTrio } from "./packConfig.logic.mjs";
export type Lean = "boy" | "girl" | "neutral";
