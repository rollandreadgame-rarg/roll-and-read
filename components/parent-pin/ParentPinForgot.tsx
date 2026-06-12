// components/parent-pin/ParentPinForgot.tsx
"use client";

// Full email-code reset flow is implemented in a later task.
export default function ParentPinForgot({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  return (
    <div className="text-center">
      <p style={{ color: "var(--color-text-primary)" }}>Loading reset…</p>
      <button onClick={onCancel} className="mt-3 underline text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Back
      </button>
    </div>
  );
}
