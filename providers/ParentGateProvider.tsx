// providers/ParentGateProvider.tsx
"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";

const IS_E2E = process.env.NEXT_PUBLIC_E2E_MODE === "true";
const UNLOCK_KEY = "rar_parent_unlocked_at";
const IDLE_MS = 3 * 60 * 1000; // 3 minutes

type Ctx = {
  hasPin: boolean;
  unlocked: boolean;
  markUnlocked: () => void;
  lock: () => void;
  loaded: boolean;
};

const ParentGateContext = createContext<Ctx | null>(null);

export function useParentGate() {
  const ctx = useContext(ParentGateContext);
  if (!ctx) throw new Error("useParentGate must be used within ParentGateProvider");
  return ctx;
}

export function ParentGateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const clerkId = user?.id;
  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip"
  );
  const loaded = IS_E2E || convexUser !== undefined;
  const hasPin = Boolean(convexUser?.hasParentPin) && !IS_E2E;

  const [unlocked, setUnlocked] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    setUnlocked(false);
    try { sessionStorage.removeItem(UNLOCK_KEY); } catch {}
  }, []);

  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(lock, IDLE_MS);
  }, [lock]);

  const markUnlocked = useCallback(() => {
    setUnlocked(true);
    try { sessionStorage.setItem(UNLOCK_KEY, String(Date.now())); } catch {}
    armIdle();
  }, [armIdle]);

  // Restore unlock from sessionStorage on mount (respecting idle window).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(UNLOCK_KEY);
      if (raw && Date.now() - Number(raw) < IDLE_MS) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only restore of persisted unlock on mount (sessionStorage is unavailable during SSR)
        setUnlocked(true);
        armIdle();
      } else if (raw) {
        sessionStorage.removeItem(UNLOCK_KEY);
      }
    } catch {}
  }, [armIdle]);

  // Reset idle timer on activity while unlocked; sync lock across tabs.
  useEffect(() => {
    if (!unlocked) return;
    const onActivity = () => {
      try { sessionStorage.setItem(UNLOCK_KEY, String(Date.now())); } catch {}
      armIdle();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === UNLOCK_KEY && e.newValue === null) setUnlocked(false);
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    window.addEventListener("storage", onStorage);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      window.removeEventListener("storage", onStorage);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [unlocked, armIdle]);

  return (
    <ParentGateContext.Provider value={{ hasPin, unlocked, markUnlocked, lock, loaded }}>
      {children}
    </ParentGateContext.Provider>
  );
}
