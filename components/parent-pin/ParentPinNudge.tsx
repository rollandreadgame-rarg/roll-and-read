// components/parent-pin/ParentPinNudge.tsx
"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useParentGate } from "@/providers/ParentGateProvider";

const KEY = "rar_pin_nudge_dismissed";

export default function ParentPinNudge({ onSetUp }: { onSetUp: () => void }) {
  const { hasPin, loaded } = useParentGate();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  if (!loaded || hasPin || dismissed) return null;
  return (
    <div className="panel flex flex-wrap items-center gap-3 p-4"
      style={{ borderColor: "var(--color-brand)" }}>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--color-surface-2)", color: "var(--color-text-secondary)" }}
        aria-hidden="true"
      >
        <Lock size={18} />
      </span>
      <p className="min-w-0 flex-1 basis-48 text-sm" style={{ color: "var(--color-text-primary)" }}>
        Add a grown-up PIN to keep students out of settings &amp; billing.
      </p>
      <div className="flex items-center gap-1">
        <button onClick={onSetUp} className="btn-primary px-4 py-2 text-sm">Set up</button>
        <button aria-label="Dismiss" onClick={() => { try { localStorage.setItem(KEY, "1"); } catch {} setDismissed(true); }}
          className="rounded-xl hover:bg-[var(--color-hover)]"
          style={{ color: "var(--color-text-secondary)" }}><span aria-hidden="true">✕</span></button>
      </div>
    </div>
  );
}
