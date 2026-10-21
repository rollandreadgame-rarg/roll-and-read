// components/parent-pin/ParentPinForgot.tsx
"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isValidPinFormat } from "@/lib/parentPin/parentPinLogic.mjs";
import PinInput from "./PinInput";

type Step = "send" | "code" | "newpin";

const ERROR_TEXT = "var(--color-error-text)";

export default function ParentPinForgot({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { user } = useUser();
  const reset = useMutation(api.parentPin.resetParentPin);
  const email = user?.primaryEmailAddress;
  const masked = maskEmail(email?.emailAddress ?? "");

  const [step, setStep] = useState<Step>("send");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    if (!email) return;
    setBusy(true); setError("");
    try {
      await email.prepareVerification({ strategy: "email_code" });
      setStep("code");
    } catch {
      setError("Couldn't send a code. Try again.");
    } finally { setBusy(false); }
  };

  const verifyCode = async () => {
    if (!email) return;
    setBusy(true); setError("");
    try {
      await email.attemptVerification({ code });
      setStep("newpin");
    } catch {
      setError("That code didn't work.");
    } finally { setBusy(false); }
  };

  const saveNewPin = async (value: string) => {
    if (!isValidPinFormat(value)) return;
    setBusy(true); setError("");
    try {
      const res = await reset({ newPin: value });
      if (res.ok) onDone(); else setError("Couldn't save the new PIN.");
    } finally { setBusy(false); }
  };

  return (
    <div className="w-full text-center">
      {step === "send" && (
        <>
          <h2 className="text-xl font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>Reset your PIN</h2>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
            We&apos;ll email a code to <strong style={{ color: "var(--color-text-primary)" }}>{masked}</strong>.
          </p>
          <button onClick={sendCode} disabled={busy || !email}
            className="btn-primary w-full px-5 py-3">
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </>
      )}
      {step === "code" && (
        <>
          <h2 className="text-xl font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>Enter the code</h2>
          <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>Sent to {masked}.</p>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" aria-label="Email code"
            className="w-44 max-w-full text-center text-xl font-bold tracking-widest tabular-nums rounded-2xl border-2 p-2"
            style={{
              background: "var(--color-surface-2)",
              borderColor: code ? "var(--color-brand)" : "var(--color-line-strong)",
              color: "var(--color-text-primary)",
            }} />
          <div className="mt-4">
            <button onClick={verifyCode} disabled={busy || code.length < 6}
              className="btn-primary w-full px-5 py-3">
              {busy ? "Checking…" : "Verify"}
            </button>
          </div>
        </>
      )}
      {step === "newpin" && (
        <>
          <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--color-text-primary)" }}>Set a new PIN</h2>
          <PinInput value={pin} onChange={setPin} onComplete={saveNewPin} autoFocus disabled={busy} ariaLabel="New PIN" />
        </>
      )}
      <p aria-live="assertive" className="min-h-5 mt-3 text-sm font-semibold" style={{ color: ERROR_TEXT }}>{error}</p>
      <button onClick={onCancel}
        className="mt-1 rounded-xl px-3 text-sm underline underline-offset-4 hover:bg-[var(--color-hover)]"
        style={{ color: "var(--color-text-secondary)" }}>Back</button>
    </div>
  );
}

function maskEmail(e: string) {
  const [name, domain] = e.split("@");
  if (!domain) return e;
  return `${name.slice(0, 1)}•••@${domain}`;
}
