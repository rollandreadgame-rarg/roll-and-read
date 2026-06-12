// components/parent-pin/PinInput.tsx
"use client";

import { useRef, useEffect } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
};

const LEN = 4;

export default function PinInput({
  value, onChange, onComplete, disabled, autoFocus, ariaLabel = "PIN",
}: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setDigit = (i: number, d: string) => {
    const digits = value.padEnd(LEN, " ").split("");
    digits[i] = d;
    const next = digits.join("").replace(/ /g, "").slice(0, LEN);
    onChange(next);
    if (d && i < LEN - 1) refs.current[i + 1]?.focus();
    if (next.length === LEN && onComplete) onComplete(next);
  };

  return (
    <div className="flex justify-center gap-3" role="group" aria-label={ariaLabel}>
      {Array.from({ length: LEN }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-label={`${ariaLabel} digit ${i + 1}`}
          value={value[i] ?? ""}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            if (d) setDigit(i, d);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) {
              refs.current[i - 1]?.focus();
              setDigit(i - 1, "");
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LEN);
            if (pasted) {
              onChange(pasted);
              if (pasted.length === LEN && onComplete) onComplete(pasted);
              refs.current[Math.min(pasted.length, LEN - 1)]?.focus();
            }
          }}
          className="w-14 h-16 text-center text-2xl font-bold rounded-2xl border-2 outline-none transition-transform focus:scale-105"
          style={{
            background: "var(--color-bg-surface)",
            borderColor: value[i] ? "var(--color-brand)" : "rgba(255,255,255,0.15)",
            color: "var(--color-text-primary)",
          }}
        />
      ))}
    </div>
  );
}
