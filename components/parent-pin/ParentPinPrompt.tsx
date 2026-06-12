// components/parent-pin/ParentPinPrompt.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParentGate } from "@/providers/ParentGateProvider";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import PinInput from "./PinInput";
import ParentPinForgot from "./ParentPinForgot";

export default function ParentPinPrompt() {
  const router = useRouter();
  const { markUnlocked } = useParentGate();
  const verify = useMutation(api.parentPin.verifyParentPin);
  const reduced = usePrefersReducedMotion();

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [locked, setLocked] = useState(false);
  const [forgot, setForgot] = useState(false);

  const submit = async (value: string) => {
    if (locked) return;
    const res = await verify({ pin: value });
    if (res.ok) { markUnlocked(); return; }
    setPin("");
    setError(res.lockedUntil ? "Too many tries — wait a minute." : "Incorrect PIN.");
    if (res.lockedUntil) {
      setLocked(true);
      const ms = res.lockedUntil - Date.now();
      setTimeout(() => setLocked(false), ms > 0 ? ms : 0);
    }
    if (!reduced) { setShake(true); setTimeout(() => setShake(false), 400); }
  };

  if (forgot) {
    return (
      <Shell>
        <ParentPinForgot onDone={() => markUnlocked()} onCancel={() => setForgot(false)} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Grown-ups only"
        className="w-full max-w-sm text-center"
        style={reduced ? {} : (shake ? { animation: "rar-shake 0.4s" } : {})}
      >
        <div className="text-4xl mb-2">🔒</div>
        <h1 className="text-xl font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>
          Grown-ups only
        </h1>
        <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
          Enter your PIN to open this area.
        </p>
        <PinInput value={pin} onChange={setPin} onComplete={submit} autoFocus disabled={locked} ariaLabel="Unlock PIN" />
        <p aria-live="assertive" className="h-5 mt-3 text-sm" style={{ color: "#f87171" }}>{error}</p>
        <div className="flex items-center justify-between mt-2 text-sm">
          <button onClick={() => setForgot(true)} className="underline" style={{ color: "var(--color-text-secondary)" }}>
            Forgot PIN?
          </button>
          <button onClick={() => router.push("/play")} className="underline" style={{ color: "var(--color-text-secondary)" }}>
            Cancel
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6" style={{ background: "var(--color-bg-primary)" }}>
      {children}
    </div>
  );
}
