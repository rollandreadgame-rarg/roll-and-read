"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const PACKS = [
  {
    id: "basic",
    name: "Basic Pack",
    icon: "🎴",
    cost: 50,
    count: 1,
    desc: "1 random sticker",
    odds: "60% Common · 25% Uncommon · 12% Rare · 3% Legendary",
    gradient: "linear-gradient(135deg, #374151, #1F2937)",
    border: "rgba(255,255,255,0.15)",
  },
  {
    id: "themed",
    name: "Themed Pack",
    icon: "🎁",
    cost: 150,
    count: 3,
    desc: "3 stickers from one category",
    odds: "Same odds, guaranteed same category",
    gradient: "linear-gradient(135deg, #1E3A5F, #1E40AF)",
    border: "rgba(59,130,246,0.4)",
  },
  {
    id: "premium",
    name: "Premium Pack",
    icon: "👑",
    cost: 500,
    count: 5,
    desc: "5 stickers with boosted rare odds",
    odds: "40% Common · 35% Uncommon · 20% Rare · 5% Legendary",
    gradient: "linear-gradient(135deg, #78350F, #B45309)",
    border: "rgba(245,158,11,0.5)",
  },
];

const CATEGORIES = ["animals", "space", "ocean", "fantasy", "characters"];

type RevealedSticker = {
  name: string;
  emoji: string;
  rarity: string;
};

const RARITY_COLORS: Record<string, string> = {
  common: "#6B7280",
  uncommon: "#3B82F6",
  rare: "#A855F7",
  legendary: "#F59E0B",
};

function rollRarity(premium?: boolean): "common" | "uncommon" | "rare" | "legendary" {
  const r = Math.random();
  if (premium) {
    if (r < 0.40) return "common";
    if (r < 0.75) return "uncommon";
    if (r < 0.95) return "rare";
    return "legendary";
  }
  if (r < 0.60) return "common";
  if (r < 0.85) return "uncommon";
  if (r < 0.97) return "rare";
  return "legendary";
}

export default function ShopPage() {
  const { user } = useUser();
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("animals");
  const [revealedStickers, setRevealedStickers] = useState<RevealedSticker[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealIndex, setRevealIndex] = useState(-1);
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

  const allStickers = useQuery(api.stickersDb.getAll);
  const profileStickers = useQuery(
    api.stickersDb.getForProfile,
    selectedProfile ? { profileId: selectedProfile as Id<"profiles"> } : "skip"
  );

  const ownedIds = new Set((profileStickers ?? []).map((ps: any) => ps.stickerId));

  const spendCoinsMut = useMutation(api.profiles.spendCoins);
  const grantStickerMut = useMutation(api.stickersDb.grantSticker);

  const handleBuy = async (packId: string, cost: number, count: number) => {
    if (!selectedProfile || !profile || !allStickers) return;
    if (profile.coins < cost) {
      setErrorMsg(`You need ${(cost - profile.coins).toLocaleString()} more coins!`);
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    setIsRevealing(true);
    setRevealedStickers([]);
    setRevealIndex(-1);
    setErrorMsg("");

    try {
      await spendCoinsMut({
        profileId: selectedProfile as Id<"profiles">,
        amount: cost,
      });

      const stickersToReveal: RevealedSticker[] = [];
      for (let i = 0; i < count; i++) {
        const isPremium = packId === "premium";
        const rarity = rollRarity(isPremium);
        const catFilter = packId === "themed" ? selectedCategory : undefined;

        // Find uncollected stickers of this rarity
        let eligible = allStickers.filter(
          (s: any) =>
            s.rarity === rarity &&
            !ownedIds.has(s._id) &&
            (catFilter ? s.category === catFilter : true)
        );

        // Fallback: any sticker of this rarity
        if (eligible.length === 0) {
          eligible = allStickers.filter(
            (s: any) => s.rarity === rarity && (catFilter ? s.category === catFilter : true)
          );
        }

        // Ultimate fallback: any sticker
        if (eligible.length === 0) {
          eligible = allStickers;
        }

        const picked = eligible[Math.floor(Math.random() * eligible.length)];
        stickersToReveal.push({ name: picked.name, emoji: picked.emoji, rarity: picked.rarity });

        // Grant to profile
        if (!ownedIds.has(picked._id)) {
          await grantStickerMut({
            profileId: selectedProfile as Id<"profiles">,
            stickerId: picked._id,
          });
        }
      }

      // Reveal one by one
      for (let i = 0; i < stickersToReveal.length; i++) {
        setRevealIndex(i);
        setRevealedStickers(stickersToReveal.slice(0, i + 1));
        await new Promise((r) => setTimeout(r, 600));
      }
    } catch (err) {
      setErrorMsg("Something went wrong. Please try again.");
    }

    setIsRevealing(false);
  };

  return (
    <div className="flex flex-col flex-1 p-4 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>
          🛍️ Sticker Shop
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold" style={{ color: "var(--color-accent-gold)" }}>
            💰 {(profile?.coins ?? 0).toLocaleString()}
          </span>
          <span style={{ color: "var(--color-text-muted)" }}>coins</span>
        </div>
      </div>

      {/* Profile tabs */}
      {(profiles?.length ?? 0) > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {profiles?.map((p: any) => (
            <button
              key={p._id}
              onClick={() => setActiveProfileId(p._id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap"
              style={{
                background: selectedProfile === p._id ? "var(--color-brand)" : "rgba(255,255,255,0.08)",
                color: selectedProfile === p._id ? "white" : "var(--color-text-muted)",
              }}
            >
              {p.avatarEmoji} {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Category selector for Themed Pack */}
      <div className="mb-4">
        <p className="text-sm font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>
          Category for Themed Pack:
        </p>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="px-3 py-1.5 rounded-xl text-sm font-semibold capitalize transition-colors"
              style={{
                background: selectedCategory === cat ? "var(--color-brand)" : "rgba(255,255,255,0.08)",
                color: selectedCategory === cat ? "white" : "var(--color-text-muted)",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-3 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}
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
              className="rounded-2xl p-5"
              style={{ background: pack.gradient, border: `1px solid ${pack.border}` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{pack.icon}</span>
                  <div>
                    <div className="font-extrabold text-xl text-white">{pack.name}</div>
                    <div className="text-sm text-white/70">{pack.desc}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold" style={{ color: "#F59E0B" }}>
                    💰 {pack.cost}
                  </div>
                  <div className="text-xs text-white/60">{pack.count} sticker{pack.count > 1 ? "s" : ""}</div>
                </div>
              </div>
              <div className="text-xs text-white/60 mb-3">{pack.odds}</div>
              <motion.button
                onClick={() => handleBuy(pack.id, pack.cost, pack.count)}
                disabled={!canAfford || isRevealing}
                whileTap={canAfford && !isRevealing ? { scale: 0.97 } : {}}
                className="w-full py-3 rounded-xl font-extrabold text-base transition-opacity disabled:opacity-50"
                style={{
                  background: canAfford
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(255,255,255,0.2)",
                  color: canAfford ? "#1E293B" : "rgba(255,255,255,0.5)",
                  cursor: canAfford && !isRevealing ? "pointer" : "not-allowed",
                }}
              >
                {!canAfford
                  ? `Need ${(pack.cost - (profile?.coins ?? 0)).toLocaleString()} more coins`
                  : isRevealing
                  ? "Opening..."
                  : `Open ${pack.name}`}
              </motion.button>
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
            className="rounded-2xl p-6 text-center"
            style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--color-text-primary)" }}>
              🎉 You Got!
            </h2>
            <div className="flex justify-center gap-4 flex-wrap">
              {revealedStickers.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12, delay: i * 0.1 }}
                  className="flex flex-col items-center gap-2"
                >
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                    style={{
                      border: `2px solid ${RARITY_COLORS[s.rarity] ?? "#6B7280"}`,
                      boxShadow: `0 0 16px ${RARITY_COLORS[s.rarity] ?? "#6B7280"}44`,
                      background: "rgba(255,255,255,0.05)",
                    }}
                  >
                    {s.emoji}
                  </div>
                  <div className="text-xs font-bold" style={{ color: "var(--color-text-primary)" }}>
                    {s.name}
                  </div>
                  <div
                    className="text-xs font-semibold capitalize"
                    style={{ color: RARITY_COLORS[s.rarity] ?? "#6B7280" }}
                  >
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
