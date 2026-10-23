"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProfileSelector } from "@/hooks/useProfile";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Id } from "@/convex/_generated/dataModel";
import MiniDie from "@/components/game/MiniDie";
import LevelSelect from "@/components/LevelSelect";
import type { Plan } from "@/convex/subscriptionConfig";

const AVATARS: [string, string][] = [
  ["🦊", "fox"], ["🐻", "bear"], ["🐼", "panda"], ["🦁", "lion"], ["🐯", "tiger"],
  ["🦄", "unicorn"], ["🐙", "octopus"], ["🦋", "butterfly"], ["🐬", "dolphin"], ["🦕", "dinosaur"],
  ["🐲", "dragon"], ["⭐", "star"], ["🌈", "rainbow"], ["🚀", "rocket"], ["🎨", "paint palette"],
  ["🎵", "music note"], ["🌺", "flower"], ["🍀", "clover"], ["❄️", "snowflake"], ["🔥", "fire"],
];

interface ProfileSelectorProps {
  onSelect: (profileId: string) => void;
}

export default function ProfileSelector({ onSelect }: ProfileSelectorProps) {
  const { profiles, clerkUser, createProfile, isLoading } = useProfileSelector();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("🦊");
  const [newLevel, setNewLevel] = useState("1A");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useCurrentUser();
  const sub = useQuery(api.subscriptions.getByClerkId, user?.id ? { clerkId: user.id } : "skip");
  const atLimit = !!sub && profiles.length >= sub.profileLimit;
  const plan = (sub?.plan ?? "free") as Plan;

  const handleCreate = async () => {
    if (!newName.trim() || !clerkUser || saving) return;
    setSaving(true);
    setError(null);
    try {
      const id = await createProfile({
        userId: clerkUser._id as Id<"users">,
        name: newName.trim(),
        avatarEmoji: newAvatar,
        startingLevel: newLevel,
      });
      onSelect(id as string);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("PROFILE_LIMIT_REACHED")
          ? "Your plan is full. Upgrade to add more readers."
          : msg.includes("LEVEL_LOCKED")
            ? "That level needs a paid plan. Pick a Level 1 sublevel or upgrade."
            : "Couldn't add the reader. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh" role="status" aria-label="Loading readers">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <MiniDie face={5} className="w-12 h-12" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 sm:p-6" style={{ background: "var(--color-bg-primary)" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        <div className="text-center mb-8">
          <MiniDie face={5} className="w-14 h-14 mx-auto mb-4" />
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>
            Who&apos;s reading?
          </h1>
          <p style={{ color: "var(--color-text-secondary)" }}>Tap your picture to start</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {profiles.map((p: any) => (
            <motion.button
              key={p._id}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(p._id)}
              className="flex flex-col items-center gap-2 px-3 pt-5 pb-4 rounded-[22px] text-center transition-colors hover:border-[var(--color-brand-secondary)] min-w-0"
              style={{
                background: "var(--color-bg-surface)",
                border: "2px solid var(--color-line)",
                boxShadow: "0 4px 0 var(--color-line-strong)",
              }}
            >
              <div
                className="w-24 h-24 flex items-center justify-center rounded-full"
                style={{ background: "var(--color-surface-2)", fontSize: 64, lineHeight: 1 }}
                aria-hidden="true"
              >
                {p.avatarEmoji}
              </div>
              <div className="font-extrabold text-lg leading-tight w-full truncate" style={{ color: "var(--color-text-primary)" }}>
                {p.name}
              </div>
              <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Level {p.currentLevel} <span aria-hidden="true">• 💰</span><span className="sr-only">,</span> {p.coins.toLocaleString()}<span className="sr-only"> coins</span>
              </div>
            </motion.button>
          ))}
        </div>

        {atLimit && !isCreating ? (
          <Link
            href="/billing"
            className="flex items-center justify-center w-full py-3 px-4 rounded-2xl font-bold text-center transition-colors hover:bg-[var(--color-hover)]"
            style={{ border: "2px dashed var(--color-line-strong)", color: "var(--color-text-secondary)" }}
          >
            <span aria-hidden="true">✨&nbsp;</span>Upgrade to add more readers ({profiles.length}/{sub?.profileLimit})
          </Link>
        ) : !isCreating ? (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsCreating(true)}
            className="w-full py-3 rounded-2xl font-bold transition-colors hover:bg-[var(--color-hover)]"
            style={{ border: "2px dashed var(--color-line-strong)", color: "var(--color-text-secondary)" }}
          >
            + Add new reader
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel p-5"
          >
            <h2 className="text-lg font-bold mb-3" style={{ color: "var(--color-text-primary)" }}>New reader</h2>

            <div className="flex flex-wrap gap-2 mb-4">
              {AVATARS.map(([emoji, name]) => (
                <button
                  key={emoji}
                  onClick={() => setNewAvatar(emoji)}
                  aria-label={name}
                  aria-pressed={newAvatar === emoji}
                  className="text-3xl w-12 h-12 flex items-center justify-center rounded-xl transition-all"
                  style={{
                    background:
                      newAvatar === emoji
                        ? "color-mix(in srgb, var(--color-brand) 28%, var(--color-surface-2))"
                        : "var(--color-surface-2)",
                    border: `2px solid ${newAvatar === emoji ? "var(--color-highlight)" : "transparent"}`,
                    transform: newAvatar === emoji ? "scale(1.1)" : "scale(1)",
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Reader's name"
              aria-label="Reader's name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="w-full px-4 py-3 rounded-xl mb-3 text-base font-semibold"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-line-strong)",
                color: "var(--color-text-primary)",
              }}
              autoFocus
              maxLength={20}
            />

            <label
              htmlFor="first-reader-level"
              className="block text-sm font-semibold mb-2"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Starting level (for grown-ups)
            </label>
            <LevelSelect
              id="first-reader-level"
              value={newLevel}
              onChange={setNewLevel}
              plan={plan}
              describedBy="first-reader-level-help"
            />
            <p id="first-reader-level-help" className="text-xs mt-2 mb-4" style={{ color: "var(--color-text-muted)" }}>
              Not sure? Start at 1A. You can change it any time in Settings.
            </p>

            {error && (
              <p
                role="alert"
                className="text-sm mb-3 font-semibold"
                style={{ color: "var(--color-error-text)" }}
              >
                {error}{" "}
                {error.includes("Upgrade") && (
                  <Link href="/billing" className="underline font-semibold">See plans</Link>
                )}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setIsCreating(false)}
                className="flex-1 py-3 rounded-2xl font-semibold transition-colors hover:border-[var(--color-line-strong)]"
                style={{
                  background: "var(--color-surface-2)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-line)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || saving}
                className="btn-primary flex-1 py-3"
              >
                Start reading!
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
