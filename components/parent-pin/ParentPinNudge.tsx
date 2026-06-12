// components/parent-pin/ParentPinNudge.tsx
"use client";

import { useState } from "react";
import { useParentGate } from "@/providers/ParentGateProvider";

const KEY = "rar_pin_nudge_dismissed";

export default function ParentPinNudge({ onSetUp }: { onSetUp: () => void }) {
  const { hasPin, loaded } = useParentGate();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  if (!loaded || hasPin || dismissed) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl p-3 mb-4"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-brand)" }}>
      <span className="text-xl">🔒</span>
      <p className="flex-1 text-sm" style={{ color: "var(--color-text-primary)" }}>
        Add a grown-up PIN to keep students out of settings &amp; billing.
      </p>
      <button onClick={onSetUp} className="px-3 py-1.5 rounded-lg text-sm font-bold"
        style={{ background: "var(--color-brand)", color: "white" }}>Set up</button>
      <button aria-label="Dismiss" onClick={() => { try { localStorage.setItem(KEY, "1"); } catch {} setDismissed(true); }}
        style={{ color: "var(--color-text-secondary)" }}>✕</button>
    </div>
  );
}
