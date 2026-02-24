"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfileSelector } from "@/hooks/useProfile";
import { Id } from "@/convex/_generated/dataModel";

const AVATARS = ["🦊", "🐻", "🐼", "🦁", "🐯", "🦄", "🐙", "🦋", "🐬", "🦕", "🐲", "⭐", "🌈", "🚀", "🎨", "🎵", "🌺", "🍀", "❄️", "🔥"];

interface ProfileSelectorProps {
  onSelect: (profileId: string) => void;
}

export default function ProfileSelector({ onSelect }: ProfileSelectorProps) {
  const { profiles, clerkUser, createProfile, isLoading } = useProfileSelector();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("🦊");

  const handleCreate = async () => {
    if (!newName.trim() || !clerkUser) return;
    const id = await createProfile({
      userId: clerkUser._id as Id<"users">,
      name: newName.trim(),
      avatarEmoji: newAvatar,
    });
    onSelect(id as string);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-4xl"
        >
          🎲
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: "var(--color-bg-primary)" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎲</div>
          <h1 className="text-3xl font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>
            Who's Reading?
          </h1>
          <p style={{ color: "var(--color-text-muted)" }}>Select a reader to continue</p>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          {profiles.map((p: any) => (
            <motion.button
              key={p._id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(p._id)}
              className="flex items-center gap-4 p-4 rounded-2xl text-left transition-colors hover:brightness-110"
              style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="text-4xl w-12 h-12 flex items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.08)" }}>
                {p.avatarEmoji}
              </div>
              <div>
                <div className="font-bold text-lg" style={{ color: "var(--color-text-primary)" }}>{p.name}</div>
                <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Level {p.currentLevel} • 💰 {p.coins.toLocaleString()}
                </div>
              </div>
              <div className="ml-auto" style={{ color: "var(--color-text-muted)" }}>→</div>
            </motion.button>
          ))}
        </div>

        {!isCreating ? (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsCreating(true)}
            className="w-full py-3 rounded-2xl font-bold transition-colors hover:bg-white/10"
            style={{ border: "2px dashed rgba(255,255,255,0.2)", color: "var(--color-text-muted)" }}
          >
            + Add New Reader
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4"
            style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <h3 className="font-bold mb-3" style={{ color: "var(--color-text-primary)" }}>New Reader</h3>

            <div className="flex flex-wrap gap-2 mb-3">
              {AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setNewAvatar(emoji)}
                  className="text-2xl p-1.5 rounded-lg transition-all"
                  style={{
                    background: newAvatar === emoji ? "var(--color-brand)" : "rgba(255,255,255,0.05)",
                    transform: newAvatar === emoji ? "scale(1.2)" : "scale(1)",
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Reader's name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="w-full px-4 py-3 rounded-xl mb-3 text-base font-semibold"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "var(--color-text-primary)",
              }}
              autoFocus
              maxLength={20}
            />

            <div className="flex gap-2">
              <button
                onClick={() => setIsCreating(false)}
                className="flex-1 py-2.5 rounded-xl font-semibold"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--color-text-muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="flex-1 py-2.5 rounded-xl font-bold text-white disabled:opacity-50"
                style={{ background: "var(--color-brand)" }}
              >
                Start Reading!
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
