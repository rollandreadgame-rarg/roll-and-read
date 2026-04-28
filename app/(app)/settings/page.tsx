"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { UserButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTheme } from "@/providers/ThemeProvider";

const THEMES = [
  { id: "ocean", label: "Ocean Adventure", emoji: "🌊", free: true, desc: "Cool underwater wonder" },
  { id: "space", label: "Space Explorer", emoji: "🚀", free: false, desc: "Dreamy starfield adventure" },
  { id: "forest", label: "Enchanted Forest", emoji: "🌲", free: false, desc: "Magical firefly forest" },
  { id: "candy", label: "Candy Land", emoji: "🍭", free: false, desc: "Sweet & bright (light mode)" },
  { id: "classic", label: "Classic Classroom", emoji: "📚", free: true, desc: "Clean, focused, traditional" },
];

const AVATARS = ["🦊", "🐻", "🐼", "🦁", "🐯", "🦄", "🐙", "🦋", "🐬", "🦕", "🐲", "⭐", "🌈", "🚀", "🎨", "🎵", "🌺", "🍀", "❄️", "🔥"];

type WordModeType = "real" | "nonsense" | "mixed";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { theme, setTheme, fontSize, setFontSize, fontFamily, setFontFamily } = useTheme();
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("🦊");
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const clerkUser = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const profiles = useQuery(
    api.profiles.getByUser,
    clerkUser?._id ? { userId: clerkUser._id } : "skip"
  );
  const subscription = useQuery(
    api.subscriptions.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );

  const selectedProfileId = activeProfileId ?? profiles?.[0]?._id;
  const profile = profiles?.find((p: any) => p._id === selectedProfileId);
  const isPaid = clerkUser?.plan !== "free";
  const profilesLoading = clerkUser === undefined || (clerkUser !== null && profiles === undefined);
  const profileCount = profiles?.length ?? 0;
  const profileLimit = subscription?.profileLimit ?? 1;
  const atProfileCap = profileCount >= profileLimit;

  const createProfile = useMutation(api.profiles.create);
  const updateProfile = useMutation(api.profiles.update);
  const removeProfile = useMutation(api.profiles.remove);

  const handleCreateProfile = async () => {
    if (!newName.trim() || !clerkUser) return;
    await createProfile({
      userId: clerkUser._id,
      name: newName.trim(),
      avatarEmoji: newAvatar,
    });
    setIsCreating(false);
    setNewName("");
    setNewAvatar("🦊");
  };

  const handleUpdateWordMode = async (mode: WordModeType) => {
    if (!selectedProfileId) return;
    await updateProfile({
      profileId: selectedProfileId as Id<"profiles">,
      wordMode: mode,
    });
  };

  const handleUpdateTheme = async (themeId: string) => {
    if (!isPaid && !["ocean", "classic"].includes(themeId)) {
      setShowUpgradeModal(true);
      return;
    }
    setTheme(themeId as Parameters<typeof setTheme>[0]);
    if (!selectedProfileId) return;
    await updateProfile({
      profileId: selectedProfileId as Id<"profiles">,
      selectedTheme: themeId,
    });
  };

  const handleDeleteProfile = async (profileId: string) => {
    await removeProfile({ profileId: profileId as Id<"profiles"> });
    setDeleteConfirm(null);
    if (activeProfileId === profileId) setActiveProfileId(null);
  };

  return (
    <div className="flex flex-col flex-1 p-4 max-w-2xl mx-auto w-full gap-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-balance" style={{ color: "var(--color-text-primary)" }}>
          ⚙️ Settings
        </h1>
        <motion.button
          onClick={() => router.back()}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors hover:bg-white/10"
          style={{ color: "var(--color-text-muted)", border: "1px solid rgba(255,255,255,0.12)" }}
          aria-label="Close settings"
        >
          ✕
        </motion.button>
      </div>

      {/* Profile Management */}
      <section
        className="rounded-2xl p-5"
        style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
          👤 Reader Profiles
        </h2>

        <div className="flex flex-col gap-3 mb-4">
          {profilesLoading && (
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading profiles...</p>
          )}
          {(profiles ?? []).map((p: any) => (
            <div
              key={p._id}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="text-3xl">{p.avatarEmoji}</span>
              <div className="flex-1">
                {editingProfileId === p._id ? (
                  <div className="flex gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updateProfile({ profileId: p._id as Id<"profiles">, name: editName.trim() });
                          setEditingProfileId(null);
                        }
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold"
                      style={{ background: "rgba(255,255,255,0.1)", color: "var(--color-text-primary)", border: "1px solid rgba(255,255,255,0.15)" }}
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        updateProfile({ profileId: p._id as Id<"profiles">, name: editName.trim() });
                        setEditingProfileId(null);
                      }}
                      className="px-3 py-1 rounded-lg text-sm font-bold text-white"
                      style={{ background: "var(--color-success)" }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="font-bold" style={{ color: "var(--color-text-primary)" }}>{p.name}</div>
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Level {p.currentLevel} • 💰 {p.coins.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditingProfileId(p._id); setEditName(p.name); }}
                  aria-label={`Edit ${p.name}`}
                  className="p-2 rounded-lg text-xs hover:bg-white/10 transition-colors"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <span aria-hidden="true">✏️</span>
                </button>
                <button
                  onClick={() => setDeleteConfirm(p._id)}
                  aria-label={`Delete ${p.name}`}
                  className="p-2 rounded-lg text-xs hover:bg-red-500/20 transition-colors"
                  style={{ color: "var(--color-error)" }}
                >
                  <span aria-hidden="true">🗑️</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Delete confirm */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3 rounded-xl mb-3"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              <p className="text-sm font-semibold mb-2" style={{ color: "#EF4444" }}>
                Delete this profile? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.08)", color: "var(--color-text-muted)" }}>
                  Cancel
                </button>
                <button onClick={() => handleDeleteProfile(deleteConfirm)} className="px-3 py-1.5 rounded-lg text-sm font-bold text-white" style={{ background: "#EF4444" }}>
                  Delete
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create new */}
        {!isCreating ? (
          atProfileCap ? (
            <a
              href="/billing"
              className="w-full block py-2.5 rounded-xl font-semibold text-center text-white"
              style={{
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                boxShadow: "0 4px 16px rgba(245,158,11,0.3)",
              }}
            >
              ✨ Upgrade to add more readers ({profileCount}/{profileLimit} used)
            </a>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full py-2.5 rounded-xl font-semibold transition-colors hover:bg-white/10"
              style={{ border: "2px dashed rgba(255,255,255,0.15)", color: "var(--color-text-muted)" }}
            >
              + Add Reader ({profileCount}/{profileLimit})
            </button>
          )
        ) : (
          <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {AVATARS.map((e) => (
                <button
                  key={e}
                  onClick={() => setNewAvatar(e)}
                  className="text-xl p-1 rounded-lg transition-all"
                  style={{ background: newAvatar === e ? "var(--color-brand)" : "rgba(255,255,255,0.05)" }}
                >
                  {e}
                </button>
              ))}
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Reader's name"
              onKeyDown={(e) => e.key === "Enter" && handleCreateProfile()}
              className="w-full px-3 py-2 rounded-xl mb-3 text-sm"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-text-primary)" }}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setIsCreating(false)} className="flex-1 py-2 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "var(--color-text-muted)" }}>Cancel</button>
              <button onClick={handleCreateProfile} disabled={!newName.trim()} className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: "var(--color-brand)" }}>Create</button>
            </div>
          </div>
        )}
      </section>

      {/* Word Mode */}
      {profile && (
        <section
          className="rounded-2xl p-5"
          style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <h2 className="text-lg font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>
            📝 Word Mode
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
            For {profile.avatarEmoji} {profile.name}
          </p>
          <div className="flex flex-col gap-2">
            {([
              { value: "real", label: "Real Words", desc: "Practice words you'll see in books" },
              { value: "nonsense", label: "Nonsense Words ✦", desc: "Test your pure decoding skills" },
              { value: "mixed", label: "Mixed (Recommended)", desc: "Best of both worlds" },
            ] as { value: WordModeType; label: string; desc: string }[]).map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => handleUpdateWordMode(value)}
                className="flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
                style={{
                  background: profile.wordMode === value ? "color-mix(in srgb, var(--color-brand) 15%, transparent)" : "rgba(255,255,255,0.04)",
                  border: profile.wordMode === value ? "1px solid var(--color-brand)" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: profile.wordMode === value ? "var(--color-brand)" : "rgba(255,255,255,0.3)" }}
                >
                  {profile.wordMode === value && (
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--color-brand)" }} />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{label}</div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Theme Selector */}
      <section
        className="rounded-2xl p-5"
        style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
          🎨 Theme
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => handleUpdateTheme(t.id)}
              className="flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:brightness-110"
              style={{
                border: theme === t.id ? "2px solid var(--color-brand)" : "1px solid rgba(255,255,255,0.08)",
                background: theme === t.id ? "color-mix(in srgb, var(--color-brand) 10%, transparent)" : "rgba(255,255,255,0.04)",
                position: "relative",
              }}
            >
              <span className="text-3xl">{t.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>{t.label}</div>
                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{t.desc}</div>
              </div>
              {!t.free && !isPaid && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "#F59E0B22", color: "#F59E0B" }}>
                  PRO
                </span>
              )}
              {theme === t.id && (
                <span className="text-xs font-bold" style={{ color: "var(--color-brand)" }}>✓</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Font & Accessibility */}
      <section
        className="rounded-2xl p-5"
        style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
          ♿ Accessibility
        </h2>

        {/* Font */}
        <div className="mb-4">
          <label className="text-sm font-semibold mb-2 block" style={{ color: "var(--color-text-muted)" }}>Font</label>
          <div className="flex gap-2">
            {(["nunito", "opendyslexic"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFontFamily(f)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{
                  background: fontFamily === f ? "var(--color-brand)" : "rgba(255,255,255,0.08)",
                  color: fontFamily === f ? "white" : "var(--color-text-muted)",
                }}
              >
                {f === "nunito" ? "Nunito" : "OpenDyslexic"}
              </button>
            ))}
          </div>
        </div>

        {/* Font size */}
        <div>
          <label htmlFor="font-size-range" className="text-sm font-semibold mb-2 block" style={{ color: "var(--color-text-muted)" }}>
            Word Size: {fontSize}px
          </label>
          <input
            id="font-size-range"
            type="range"
            min={20}
            max={32}
            step={2}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--color-brand)" }}
          />
          <div className="flex justify-between text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            <span>Small (20px)</span>
            <span>Large (32px)</span>
          </div>
          <div
            className="mt-3 p-3 rounded-xl text-center font-bold"
            style={{ fontSize: `${fontSize}px`, background: "rgba(255,255,255,0.05)", color: "var(--color-text-primary)" }}
          >
            cat · ship · bright
          </div>
        </div>
      </section>

      {/* Subscription */}
      <section
        className="rounded-2xl p-5"
        style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
          💳 Subscription
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
          Current plan: <strong style={{ color: "var(--color-text-primary)" }}>{clerkUser?.plan ?? "Free"}</strong>
        </p>
        {!isPaid ? (
          <a
            href="/billing"
            className="block w-full py-3 rounded-xl text-center font-bold text-white"
            style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
          >
            ✨ Upgrade — From $7.99/mo
          </a>
        ) : (
          <a
            href="/billing"
            className="block w-full py-3 rounded-xl text-center font-semibold transition-colors hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.15)", color: "var(--color-text-primary)" }}
          >
            Manage Subscription
          </a>
        )}
      </section>

      {/* Account */}
      <section
        className="rounded-2xl p-5"
        style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: "var(--color-text-primary)" }}>
          🔐 Account
        </h2>
        <div className="flex items-center gap-3 mb-4">
          {process.env.NEXT_PUBLIC_E2E_MODE !== "true" && <UserButton />}
          <div>
            <div className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>
              {user?.fullName ?? user?.primaryEmailAddress?.emailAddress}
            </div>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {user?.primaryEmailAddress?.emailAddress}
            </div>
          </div>
        </div>
      </section>

      {/* Upgrade modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70"
              onClick={() => setShowUpgradeModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl"
                style={{ background: "var(--color-bg-surface)" }}
              >
                <div className="text-5xl mb-4">🚀</div>
                <h2 className="text-2xl font-extrabold mb-2" style={{ color: "var(--color-text-primary)" }}>
                  Unlock All Themes!
                </h2>
                <p className="mb-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Upgrade to Individual to access Space, Forest, and Candy Land themes plus all 5 levels.
                </p>
                <div className="flex flex-col gap-3">
                  <a
                    href="/billing"
                    onClick={() => setShowUpgradeModal(false)}
                    className="w-full py-3 rounded-2xl font-extrabold text-white text-center"
                    style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
                  >
                    ✨ Upgrade Now
                  </a>
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="py-3 rounded-2xl font-semibold"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
