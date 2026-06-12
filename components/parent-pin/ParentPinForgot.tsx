// components/parent-pin/ParentPinForgot.tsx
"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isValidPinFormat } from "@/lib/parentPin/parentPinLogic.mjs";
import PinInput from "./PinInput";

type Step = "send" | "code" | "newpin";

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
    <div className="w-full max-w-sm text-center">
      {step === "send" && (
        <>
          <h2 className="text-lg font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>Reset your PIN</h2>
          <p className="text-sm mb-5" style={{ color: "var(--color-text-secondary)" }}>
            We&apos;ll email a code to <strong>{masked}</strong>.
          </p>
          <button onClick={sendCode} disabled={busy || !email}
            className="px-5 py-3 rounded-xl font-bold disabled:opacity-50"
            style={{ background: "var(--color-brand)", color: "white" }}>
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </>
      )}
      {step === "code" && (
        <>
          <h2 className="text-lg font-extrabold mb-1" style={{ color: "var(--color-text-primary)" }}>Enter the code</h2>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>Sent to {masked}.</p>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" aria-label="Email code"
            className="w-40 text-center text-xl font-bold rounded-xl border-2 p-2 outline-none"
            style={{ background: "var(--color-bg-surface)", borderColor: "var(--color-brand)", color: "var(--color-text-primary)" }} />
          <div className="mt-3">
            <button onClick={verifyCode} disabled={busy || code.length < 6}
              className="px-5 py-3 rounded-xl font-bold disabled:opacity-50"
              style={{ background: "var(--color-brand)", color: "white" }}>
              {busy ? "Checking…" : "Verify"}
            </button>
          </div>
        </>
      )}
      {step === "newpin" && (
        <>
          <h2 className="text-lg font-extrabold mb-3" style={{ color: "var(--color-text-primary)" }}>Set a new PIN</h2>
          <PinInput value={pin} onChange={setPin} onComplete={saveNewPin} autoFocus disabled={busy} ariaLabel="New PIN" />
        </>
      )}
      <p aria-live="assertive" className="h-5 mt-3 text-sm" style={{ color: "#f87171" }}>{error}</p>
      <button onClick={onCancel} className="mt-2 underline text-sm" style={{ color: "var(--color-text-secondary)" }}>Back</button>
    </div>
  );
}

function maskEmail(e: string) {
  const [name, domain] = e.split("@");
  if (!domain) return e;
  return `${name.slice(0, 1)}•••@${domain}`;
}
