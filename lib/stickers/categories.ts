// lib/stickers/categories.ts
// The 10 real catalog categories (must match convex/stickerData/stickers.json).
export const CATEGORIES = [
  { key: "Animals", label: "Animals", icon: "🐾" },
  { key: "Toys & Fun", label: "Toys & Fun", icon: "🧸" },
  { key: "Nature", label: "Nature", icon: "🌳" },
  { key: "Food", label: "Food", icon: "🍕" },
  { key: "Fantasy & Magic", label: "Fantasy & Magic", icon: "🐉" },
  { key: "Adventure and Travel", label: "Adventure", icon: "🗺️" },
  { key: "Sports & Games", label: "Sports & Games", icon: "⚽" },
  { key: "Princess & Royalty", label: "Princess & Royalty", icon: "👑" },
  { key: "Vehicles", label: "Vehicles", icon: "🚗" },
  { key: "Holiday & Celebration", label: "Holiday", icon: "🎉" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
export const categoryMeta = (key: string) =>
  CATEGORIES.find((c) => c.key === key) ?? { key, label: key, icon: "✨" };
