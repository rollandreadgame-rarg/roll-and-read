// components/parent-pin/ParentPinForgot.tsx
"use client";

import { useState } from "react";
import { useReverification } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { isValidPinFormat } from "@/lib/parentPin/parentPinLogic.mjs";
import PinInput from "./PinInput";

const ERROR_TEXT = "var(--color-error-text)";

// Forgot PIN: choose a new one, then Clerk asks the grown-up to confirm it's
// them (password or emailed code) before the server accepts it. The check
// happens on the server (app/api/parent-pin/reset), not just in this browser.
export default function ParentPinForgot({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const resetPin = useReverification(async (newPin: string) => {
    const res = await fetch("/api/parent-pin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPin }),
    });
    return res.json();
  });

  const saveNewPin = async (value: string) => {
    if (!isValidPinFormat(value) || busy) return;
    setBusy(true); setError("");
    try {
      const res = await resetPin(value);
      if (res?.ok) onDone();
      else setError("Couldn't save the new PIN. Try again.");
    } catch (err) {
      setError(
        isReverificationCancelledError(err)
          ? "PIN not changed. Confirm it's you to set a new one."
          : "Couldn't save the new PIN. Try again."
      );
      setPin("");
    } finally { setBusy(false); }
  };

  return (
    <div className="w-full text-center">
      <h2 className="text-xl font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>Reset your PIN</h2>
      <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
        Choose a new 4-digit PIN. Then confirm it&apos;s you with your password or a code we email you.
      </p>
      <PinInput value={pin} onChange={setPin} onComplete={saveNewPin} autoFocus disabled={busy} ariaLabel="New PIN" />
      <p aria-live="assertive" className="min-h-5 mt-3 text-sm font-semibold" style={{ color: ERROR_TEXT }}>{error}</p>
      <button onClick={onCancel}
        className="mt-1 rounded-xl px-3 text-sm underline underline-offset-4 hover:bg-[var(--color-hover)]"
        style={{ color: "var(--color-text-secondary)" }}>Back</button>
    </div>
  );
}
