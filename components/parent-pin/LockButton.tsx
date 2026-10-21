"use client";

import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { useParentGate } from "@/providers/ParentGateProvider";

const GATED = ["/settings", "/billing", "/teacher"];

export default function LockButton() {
  const pathname = usePathname();
  const { hasPin, unlocked, lock } = useParentGate();
  const onGated = GATED.some((p) => pathname.startsWith(p));
  if (!hasPin || !unlocked || !onGated) return null;
  return (
    <button onClick={lock} aria-label="Lock grown-up areas"
      className="flex items-center justify-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold hover:bg-[var(--color-hover)]"
      style={{ color: "var(--color-text-secondary)" }}>
      <Lock size={16} aria-hidden="true" /> <span className="hidden sm:inline">Lock</span>
    </button>
  );
}
