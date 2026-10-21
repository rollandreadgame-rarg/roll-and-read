"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CATEGORIES } from "@/lib/stickers/categories";
import StickerImage from "@/components/stickers/StickerImage";

const CATEGORY_TABS = CATEGORIES.map((c) => ({ label: c.label, icon: c.icon, value: c.key }));

// Rarity colours are used for borders/glows and a small dot only — never as text colour.
const RARITY_STYLES: Record<string, { border: string; shadow: string; label: string }> = {
  common: { border: "#8A94A6", shadow: "none", label: "Common" },
  uncommon: { border: "#3B82F6", shadow: "0 0 12px rgba(59,130,246,0.3)", label: "Uncommon" },
  rare: { border: "#A855F7", shadow: "0 0 16px rgba(168,85,247,0.4)", label: "Rare" },
  legendary: { border: "#F5B83D", shadow: "0 0 20px rgba(245,184,61,0.5)", label: "Legendary" },
};

const chipStyle = (selected: boolean): React.CSSProperties => ({
  background: selected ? "var(--color-brand)" : "var(--color-surface-2)",
  color: selected ? "var(--color-on-brand)" : "var(--color-text-primary)",
  border: `1px solid ${selected ? "var(--color-brand)" : "var(--color-line)"}`,
});

const sentenceCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

export default function StickerBookPage() {
  const { user } = useCurrentUser();
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0].key);
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

  // Group the active category's stickers by subcategory for browsable sections.
  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of categoryStickers) {
      const k = s.subcategory || "Other";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [categoryStickers]);

  const earned = ownedStickerIds.size;
  // Count only the real catalog (image-bearing); legacy emoji rows are retired in a later step.
  const total = (allStickers ?? []).filter((s: any) => s.imageThumbUrl).length || (allStickers?.length ?? 0);

  const profile = profiles?.find((p: any) => p._id === selectedProfile);

  return (
    <div className="flex flex-col flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-balance" style={{ color: "var(--color-text-primary)" }}>
            Sticker book
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>
            Collected{" "}
            <strong className="tabular-nums" style={{ color: "var(--color-text-primary)" }}>{earned}</strong>
            {" "}of {total}
          </p>
        </div>
        <Link href="/shop" className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2">
          <span aria-hidden="true">🛍️</span> Shop
        </Link>
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

      {/* Category tabs: scroll sideways on phones, wrap on wider screens.
          Children never shrink, so labels can't collide. */}
      <div
        role="group"
        aria-label="Sticker categories"
        className="flex flex-nowrap sm:flex-wrap gap-2 mb-6 overflow-x-auto sm:overflow-visible pb-2 sm:pb-0"
      >
        {CATEGORY_TABS.map(({ label, icon, value }) => {
          const selected = activeCategory === value;
          return (
            <button
              key={value}
              onClick={() => setActiveCategory(value)}
              aria-pressed={selected}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-sm font-semibold whitespace-nowrap transition-colors hover:brightness-110"
              style={{
                ...chipStyle(selected),
                boxShadow: selected ? "0 3px 0 color-mix(in srgb, var(--color-brand) 60%, black)" : "none",
                fontWeight: selected ? 700 : 600,
              }}
            >
              <span aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Sticker Grid, grouped by subcategory */}
      <div className="mb-6">
        {grouped.map(([sub, stickers]) => (
          <section key={sub} className="mb-6">
            <h2
              className="text-lg font-bold mb-2"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {sentenceCase(sub)}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {stickers.map((sticker: any, i: number) => {
                const owned = ownedStickerIds.has(sticker._id);
                const style = RARITY_STYLES[sticker.rarity] ?? RARITY_STYLES.common;

                return (
                  <motion.button
                    key={sticker._id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedSticker(selectedSticker === sticker._id ? null : sticker._id)}
                    className="aspect-square rounded-2xl flex items-center justify-center p-2 relative"
                    style={{
                      background: owned ? "var(--color-surface-2)" : "transparent",
                      border: owned ? `2px solid ${style.border}` : "2px dashed var(--color-line-strong)",
                      boxShadow: owned ? style.shadow : "none",
                      cursor: "pointer",
                    }}
                    aria-label={owned ? sticker.name : "Unknown sticker"}
                  >
                    {owned ? (
                      <>
                        <StickerImage src={sticker.imageThumbUrl} emoji={sticker.emoji} alt={sticker.name} />
                        {sticker.rarity === "legendary" && (
                          <span
                            className="absolute top-1 right-1 text-xs"
                            style={{ color: "var(--color-gold-text)" }}
                            aria-hidden="true"
                          >
                            ✦
                          </span>
                        )}
                      </>
                    ) : (
                      <span
                        className="text-3xl font-extrabold leading-none"
                        style={{ color: "var(--color-text-muted)" }}
                        aria-hidden="true"
                      >
                        ?
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Selected sticker info */}
      <AnimatePresence>
        {selectedSticker && (() => {
          const sticker = categoryStickers.find((s: any) => s._id === selectedSticker);
          if (!sticker || !ownedStickerIds.has(sticker._id)) return null;
          const style = RARITY_STYLES[sticker.rarity] ?? RARITY_STYLES.common;
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="panel p-4 flex items-center gap-4 mb-4"
              style={{ borderColor: `${style.border}88` }}
            >
              <div className="w-20 h-20 shrink-0">
                <StickerImage src={sticker.imageFullUrl} emoji={sticker.emoji} alt={sticker.name} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-lg" style={{ color: "var(--color-text-primary)" }}>
                  {sticker.name}
                </div>
                <div
                  className="text-sm font-semibold flex items-center gap-1.5"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: style.border }}
                  />
                  {style.label}
                </div>
                <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  <span aria-hidden="true">💰</span> {sticker.coinCost} coins
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Footer */}
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4 mt-auto">
        <span className="tabular-nums" style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>
          {earned} / {total} collected
        </span>
        <span
          className="tabular-nums px-3 py-1 rounded-full text-sm"
          style={{
            color: "var(--color-text-primary)",
            fontWeight: 700,
            background: "color-mix(in srgb, var(--color-accent-gold) 20%, var(--color-bg-surface))",
            border: "1px solid color-mix(in srgb, var(--color-accent-gold) 55%, transparent)",
          }}
        >
          <span aria-hidden="true">💰</span> {(profile?.coins ?? 0).toLocaleString()} coins
        </span>
        <Link
          href="/shop"
          className="px-4 py-2 rounded-2xl font-bold text-sm inline-flex items-center gap-2 transition-colors hover:bg-[var(--color-hover)]"
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-line)",
            color: "var(--color-text-primary)",
          }}
        >
          <span aria-hidden="true">🛍️</span> Visit shop
        </Link>
      </div>
    </div>
  );
}
