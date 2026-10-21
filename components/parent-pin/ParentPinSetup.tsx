// components/parent-pin/ParentPinSetup.tsx
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { CircleCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useParentGate } from "@/providers/ParentGateProvider";
import PinInput from "./PinInput";

// Tokens mixed toward the theme's text colour so the message reads at AA on
// both the dark and the light themes.
const ERROR_TEXT = "var(--color-error-text)";
const SUCCESS_TEXT = "var(--color-success-text)";

export default function ParentPinSetup({ onDone }: { onDone?: () => void }) {
  const setPin = useMutation(api.parentPin.setParentPin);
  const { markUnlocked } = useParentGate();
  const [first, setFirst] = useState("");
  const [confirm, setConfirm] = useState("");
  const [stage, setStage] = useState<"enter" | "confirm">("enter");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onFirst = (v: string) => { setFirst(v); setError(""); setStage("confirm"); };
  const onConfirm = async (v: string) => {
    if (v !== first) { setError("PINs don't match — try again."); setConfirm(""); setFirst(""); setStage("enter"); return; }
    const res = await setPin({ pin: v });
    // Stay unlocked right after creating the PIN so the user isn't immediately challenged.
    if (res.ok) { markUnlocked(); setDone(true); onDone?.(); }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-1 py-2 text-center">
        <CircleCheck size={36} aria-hidden="true" style={{ color: SUCCESS_TEXT }} />
        <p className="mt-1 font-bold" style={{ color: "var(--color-text-primary)" }}>PIN set!</p>
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Change or remove it anytime in Settings.</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h3 className="font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>
        {stage === "enter" ? "Create a grown-up PIN" : "Confirm your PIN"}
      </h3>
      <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
        {stage === "enter"
          ? <>Parents &amp; teachers: keep students out of settings &amp; billing.</>
          : <>Type the same 4 digits again.</>}
      </p>
      {stage === "enter"
        ? <PinInput value={first} onChange={setFirst} onComplete={onFirst} autoFocus ariaLabel="New PIN" />
        : <PinInput value={confirm} onChange={setConfirm} onComplete={onConfirm} autoFocus ariaLabel="Confirm PIN" />}
      <p aria-live="assertive" className="min-h-5 mt-3 text-sm" style={{ color: ERROR_TEXT }}>{error}</p>
    </div>
  );
}
