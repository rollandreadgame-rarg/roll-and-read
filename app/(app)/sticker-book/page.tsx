"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { useQuery } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const CATEGORY_TABS = [
  { label: "Animals 🐾", value: "animals" },
  { label: "Space 🚀", value: "space" },
  { label: "Ocean 🌊", value: "ocean" },
  { label: "Fantasy 🧙", value: "fantasy" },
  { label: "Characters ⭐", value: "characters" },
];

const RARITY_STYLES: Record<string, { border: string; shadow: string; label: string }> = {
  common: { border: "#6B7280", shadow: "none", label: "Common" },
  uncommon: { border: "#3B82F6", shadow: "0 0 12px rgba(59,130,246,0.3)", label: "Uncommon" },
  rare: { border: "#A855F7", shadow: "0 0 16px rgba(168,85,247,0.4)", label: "Rare" },
  legendary: { border: "#F59E0B", shadow: "0 0 24px rgba(245,158,11,0.5)", label: "Legendary" },
};

export default function StickerBookPage() {
  const { user } = useCurrentUser();
  const [activeCategory, setActiveCategory] = useState("animals");
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const clerkUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const profiles = useQuery(
    api.profiles.getByUser,
    clerkUser?._id ? { userId: clerkUser._id } : "skip"
  );
  const selectedProfile = activeProfileId ?? profiles?.[0]?._id;

  const allStickers = useQuery(api.stickersDb.getAll);
  const profileStickers = useQuery(
    api.stickersDb.getForProfile,
    selectedProfile ? { profileId: selectedProfile as Id<"profiles"> } : "skip"
  );

  const ownedStickerIds = new Set((profileStickers ?? []).map((ps: any) => ps.stickerId));

  const categoryStickers = (allStickers ?? []).filter(
    (s: any) => s.category === activeCategory
  );

  const earned = ownedStickerIds.size;
  const total = allStickers?.length ?? 200;

  const profile = profiles?.find((p: any) => p._id === selectedProfile);

  return (
    <div className="flex flex-col flex-1 p-4 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-balance" style={{ color: "var(--color-text-primary)" }}>
            🎴 Sticker Book
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            Collected <strong style={{ color: "var(--color-brand)" }}>{earned}</strong> / {total}
          </p>
        </div>
        <Link
          href="/shop"
          className="px-4 py-2 rounded-xl font-bold text-white text-sm"
          style={{ background: "var(--color-brand)" }}
        >
          🛍️ Shop
        </Link>
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

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {CATEGORY_TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setActiveCategory(value)}
            className="px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors"
            style={{
              background: activeCategory === value ? "var(--color-brand)" : "rgba(255,255,255,0.08)",
              color: activeCategory === value ? "white" : "var(--color-text-muted)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sticker Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mb-6">
        <AnimatePresence mode="popLayout">
          {categoryStickers.map((sticker: any, i: number) => {
            const owned = ownedStickerIds.has(sticker._id);
            const style = RARITY_STYLES[sticker.rarity] ?? RARITY_STYLES.common;

            return (
              <motion.button
                key={sticker._id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedSticker(selectedSticker === sticker._id ? null : sticker._id)}
                className="aspect-square rounded-2xl flex flex-col items-center justify-center p-2 relative"
                style={{
                  background: owned
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.03)",
                  border: `2px solid ${owned ? style.border : "rgba(255,255,255,0.1)"}`,
                  boxShadow: owned ? style.shadow : "none",
                  cursor: "pointer",
                }}
                aria-label={owned ? sticker.name : "Unknown sticker"}
              >
                {owned ? (
                  <>
                    <span
                      className="text-3xl"
                      style={{
                        animation:
                          selectedSticker === sticker._id
                            ? "wiggle 0.4s ease-in-out"
                            : "none",
                      }}
                    >
                      {sticker.emoji}
                    </span>
                    {sticker.rarity === "legendary" && (
                      <span
                        className="absolute top-1 right-1 text-xs"
                        style={{ color: "#F59E0B" }}
                      >
                        ✦
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-3xl opacity-20">❓</span>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Selected sticker info */}
      <AnimatePresence>
        {selectedSticker && (() => {
          const sticker = categoryStickers.find((s: any) => s._id === selectedSticker);
          if (!sticker || !ownedStickerIds.has(sticker._id)) return null;
          const style = RARITY_STYLES[sticker.rarity];
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-2xl p-4 flex items-center gap-4 mb-4"
              style={{ background: "var(--color-bg-surface)", border: `1px solid ${style.border}44` }}
            >
              <span className="text-5xl">{sticker.emoji}</span>
              <div>
                <div className="font-bold text-lg" style={{ color: "var(--color-text-primary)" }}>
                  {sticker.name}
                </div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: style.border }}
                >
                  {style.label}
                </div>
                <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  💰 {sticker.coinCost} coins
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Footer */}
      <div
        className="flex items-center justify-between p-4 rounded-2xl mt-auto"
        style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>
          {earned} / {total} collected
        </span>
        <span className="tabular-nums" style={{ color: "var(--color-accent-gold)", fontWeight: 700 }}>
          💰 {(profile?.coins ?? 0).toLocaleString()} coins
        </span>
        <Link
          href="/shop"
          className="px-4 py-2 rounded-xl text-white font-bold text-sm"
          style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-secondary))" }}
        >
          🛍️ Visit Shop
        </Link>
      </div>

      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-15deg); }
          75% { transform: rotate(15deg); }
        }
      `}</style>
    </div>
  );
}
