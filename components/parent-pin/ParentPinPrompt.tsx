// components/parent-pin/ParentPinPrompt.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { Lock } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useParentGate } from "@/providers/ParentGateProvider";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import PinInput from "./PinInput";
import ParentPinForgot from "./ParentPinForgot";

const ERROR_TEXT = "var(--color-error-text)";
const LINK_CLASS =
  "rounded-xl px-3 underline underline-offset-4 hover:bg-[var(--color-hover)]";

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
        className="w-full text-center"
        style={reduced ? {} : (shake ? { animation: "rar-shake 0.4s" } : {})}
        onKeyDown={(e) => { if (e.key === "Escape") router.push("/play"); }}
      >
        <span
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "var(--color-surface-2)", color: "var(--color-text-secondary)" }}
          aria-hidden="true"
        >
          <Lock size={26} />
        </span>
        <h1 className="text-2xl font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>
          Grown-ups only
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
          Enter your PIN to open this area.
        </p>
        <PinInput value={pin} onChange={setPin} onComplete={submit} autoFocus disabled={locked} ariaLabel="Unlock PIN" />
        <p aria-live="assertive" className="min-h-5 mt-3 text-sm font-semibold" style={{ color: ERROR_TEXT }}>{error}</p>
        <div className="flex items-center justify-between gap-2 mt-3 text-sm">
          <button onClick={() => setForgot(true)} className={LINK_CLASS} style={{ color: "var(--color-text-secondary)" }}>
            Forgot PIN?
          </button>
          <button onClick={() => router.push("/play")} className={LINK_CLASS} style={{ color: "var(--color-text-secondary)" }}>
            Cancel
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-8 sm:p-6" style={{ background: "var(--color-bg-primary)" }}>
      <div className="panel w-full max-w-sm p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
