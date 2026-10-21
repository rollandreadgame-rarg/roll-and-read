"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CATEGORIES as CATALOG_CATEGORIES } from "@/lib/stickers/categories";
import StickerImage from "@/components/stickers/StickerImage";

// Three tiers, told apart by icon, accent edge and a tinted surface — all built
// from theme tokens so they read in light and dark themes.
const PACKS = [
  {
    id: "basic",
    name: "Basic Pack",
    icon: "🎴",
    cost: 50,
    count: 1,
    desc: "1 random sticker",
    odds: "60% Common · 25% Uncommon · 12% Rare · 3% Legendary",
    background: "var(--color-bg-surface)",
    border: "var(--color-line-strong)",
  },
  {
    id: "themed",
    name: "Themed Pack",
    icon: "🎁",
    cost: 150,
    count: 3,
    desc: "3 stickers from one category",
    odds: "Same odds, guaranteed same category",
    background: "color-mix(in srgb, var(--color-brand-secondary) 10%, var(--color-bg-surface))",
    border: "color-mix(in srgb, var(--color-brand-secondary) 55%, transparent)",
  },
  {
    id: "premium",
    name: "Premium Pack",
    icon: "👑",
    cost: 500,
    count: 5,
    desc: "5 stickers with boosted rare odds",
    odds: "40% Common · 35% Uncommon · 20% Rare · 5% Legendary",
    background: "color-mix(in srgb, var(--color-accent-gold) 16%, var(--color-bg-surface))",
    border: "color-mix(in srgb, var(--color-accent-gold) 75%, transparent)",
  },
];

const CATEGORIES = CATALOG_CATEGORIES.map((c) => c.key);
const CATEGORY_META = Object.fromEntries(CATALOG_CATEGORIES.map((c) => [c.key, c]));

type RevealedSticker = {
  name: string;
  emoji?: string;
  imageFullUrl?: string;
  rarity: string;
};

// Used for borders/glows and a dot only — never as text colour.
const RARITY_COLORS: Record<string, string> = {
  common: "#8A94A6",
  uncommon: "#3B82F6",
  rare: "#A855F7",
  legendary: "#F5B83D",
};

const chipStyle = (selected: boolean): React.CSSProperties => ({
  background: selected ? "var(--color-brand)" : "var(--color-surface-2)",
  color: selected ? "var(--color-on-brand)" : "var(--color-text-primary)",
  border: `1px solid ${selected ? "var(--color-brand)" : "var(--color-line)"}`,
});

const coinPillStyle: React.CSSProperties = {
  color: "var(--color-text-primary)",
  background: "color-mix(in srgb, var(--color-accent-gold) 20%, var(--color-bg-surface))",
  border: "1px solid color-mix(in srgb, var(--color-accent-gold) 60%, transparent)",
};

export default function ShopPage() {
  const { user } = useCurrentUser();
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATALOG_CATEGORIES[0].key);
  const [revealedStickers, setRevealedStickers] = useState<RevealedSticker[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const clerkUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const profiles = useQuery(
    api.profiles.getByUser,
    clerkUser?._id ? { userId: clerkUser._id } : "skip"
  );
  const selectedProfile = activeProfileId ?? profiles?.[0]?._id;
  const profile = profiles?.find((p: any) => p._id === selectedProfile);

  const openPackMut = useMutation(api.shop.openPack);

  const handleBuy = async (packId: string, cost: number) => {
    if (!selectedProfile || !profile) return;
    if (profile.coins < cost) {
      setErrorMsg(`You need ${(cost - profile.coins).toLocaleString()} more coins!`);
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    setIsRevealing(true);
    setRevealedStickers([]);
    setErrorMsg("");

    try {
      // Server spends coins + grants stickers atomically and returns the result.
      const result = (await openPackMut({
        profileId: selectedProfile as Id<"profiles">,
        packId: packId as "basic" | "themed" | "premium",
        category: packId === "themed" ? selectedCategory : undefined,
      })) as { revealed: RevealedSticker[] };

      // Reveal one by one
      for (let i = 0; i < result.revealed.length; i++) {
        setRevealedStickers(result.revealed.slice(0, i + 1));
        await new Promise((r) => setTimeout(r, 600));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setErrorMsg(
        msg.includes("INSUFFICIENT_COINS")
          ? "You don't have enough coins for that pack."
          : "Something went wrong. Please try again."
      );
    }

    setIsRevealing(false);
  };

  return (
    <div className="flex flex-col flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-balance" style={{ color: "var(--color-text-primary)" }}>
          Sticker shop
        </h1>
        <div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full"
          style={coinPillStyle}
        >
          <span className="text-xl font-extrabold tabular-nums">
            <span aria-hidden="true">💰</span> {(profile?.coins ?? 0).toLocaleString()}
          </span>
          <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>coins</span>
        </div>
      </div>

      {/* Profile tabs */}
      {(profiles?.length ?? 0) > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {profiles?.map((p: any) => (
            <button
              key={p._id}
              onClick={() => setActiveProfileId(p._id)}
              aria-pressed={selectedProfile === p._id}
              className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-colors"
              style={chipStyle(selectedProfile === p._id)}
            >
              <span aria-hidden="true">{p.avatarEmoji}</span> {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Category selector for Themed Pack */}
      <div className="mb-4">
        <p id="themed-category-label" className="text-sm font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
          Category for the themed pack
        </p>
        <div className="flex gap-2 flex-wrap" role="group" aria-labelledby="themed-category-label">
          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={selectedCategory === cat}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-colors"
                style={chipStyle(selectedCategory === cat)}
              >
                {meta?.icon && <span aria-hidden="true">{meta.icon}</span>}
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-3 rounded-2xl text-sm font-semibold"
            style={{
              background: "color-mix(in srgb, var(--color-error) 14%, var(--color-bg-surface))",
              color: "var(--color-text-primary)",
              border: "1px solid color-mix(in srgb, var(--color-error) 60%, transparent)",
            }}
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pack cards */}
      <div className="grid gap-4 mb-6">
        {PACKS.map((pack) => {
          const canAfford = (profile?.coins ?? 0) >= pack.cost;
          return (
            <motion.div
              key={pack.id}
              whileHover={{ scale: 1.01 }}
              className="p-5"
              style={{
                background: pack.background,
                border: `2px solid ${pack.border}`,
                borderRadius: "var(--radius-panel)",
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-4xl shrink-0" aria-hidden="true">{pack.icon}</span>
                  <div className="min-w-0">
                    <h2 className="font-extrabold text-xl" style={{ color: "var(--color-text-primary)" }}>
                      {pack.name}
                    </h2>
                    <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{pack.desc}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-lg font-extrabold tabular-nums"
                    style={coinPillStyle}
                  >
                    <span aria-hidden="true">💰</span> {pack.cost}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                    {pack.count} sticker{pack.count > 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              <div className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>{pack.odds}</div>
              <button
                onClick={() => handleBuy(pack.id, pack.cost)}
                disabled={!canAfford || isRevealing}
                className="btn-primary w-full py-3 text-base font-extrabold"
              >
                {!canAfford
                  ? `Need ${(pack.cost - (profile?.coins ?? 0)).toLocaleString()} more coins`
                  : isRevealing
                  ? "Opening..."
                  : `Open ${pack.name}`}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Reveal area */}
      <AnimatePresence>
        {revealedStickers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel p-6 text-center"
          >
            <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--color-text-primary)" }}>
              {revealedStickers.length === 1 ? "Your new sticker" : "Your new stickers"}
            </h2>
            <div className="flex justify-center gap-4 flex-wrap">
              {revealedStickers.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12, delay: i * 0.1 }}
                  className="flex flex-col items-center gap-2 w-24"
                >
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center p-1"
                    style={{
                      border: `2px solid ${RARITY_COLORS[s.rarity] ?? RARITY_COLORS.common}`,
                      boxShadow: `0 0 16px ${RARITY_COLORS[s.rarity] ?? RARITY_COLORS.common}44`,
                      background: "var(--color-surface-2)",
                    }}
                  >
                    <StickerImage src={s.imageFullUrl} emoji={s.emoji} alt={s.name} />
                  </div>
                  <div className="text-xs font-bold" style={{ color: "var(--color-text-primary)" }}>
                    {s.name}
                  </div>
                  <div
                    className="text-xs font-semibold capitalize flex items-center gap-1"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: RARITY_COLORS[s.rarity] ?? RARITY_COLORS.common }}
                    />
                    {s.rarity}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
