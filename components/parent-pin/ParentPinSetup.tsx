// components/parent-pin/ParentPinSetup.tsx
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import PinInput from "./PinInput";

export default function ParentPinSetup({ onDone }: { onDone?: () => void }) {
  const setPin = useMutation(api.parentPin.setParentPin);
  const [first, setFirst] = useState("");
  const [confirm, setConfirm] = useState("");
  const [stage, setStage] = useState<"enter" | "confirm">("enter");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onFirst = (v: string) => { setFirst(v); setError(""); setStage("confirm"); };
  const onConfirm = async (v: string) => {
    if (v !== first) { setError("PINs don't match — try again."); setConfirm(""); setFirst(""); setStage("enter"); return; }
    const res = await setPin({ pin: v });
    if (res.ok) { setDone(true); onDone?.(); }
  };

  if (done) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-2">✅</div>
        <p className="font-bold" style={{ color: "var(--color-text-primary)" }}>PIN set!</p>
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Change or remove it anytime in Settings.</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="text-3xl mb-1">🎲🔒</div>
      <h3 className="font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>
        {stage === "enter" ? "Create a grown-up PIN" : "Confirm your PIN"}
      </h3>
      <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
        Parents &amp; teachers: keep students out of settings &amp; billing.
      </p>
      {stage === "enter"
        ? <PinInput value={first} onChange={setFirst} onComplete={onFirst} autoFocus ariaLabel="New PIN" />
        : <PinInput value={confirm} onChange={setConfirm} onComplete={onConfirm} autoFocus ariaLabel="Confirm PIN" />}
      <p aria-live="assertive" className="h-5 mt-3 text-sm" style={{ color: "#f87171" }}>{error}</p>
    </div>
  );
}
