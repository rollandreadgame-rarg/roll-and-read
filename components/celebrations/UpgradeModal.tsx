"use client";

import { useEffect, useId, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface UpgradeModalProps {
  show: boolean;
  reason: string;
  onClose: () => void;
}

export default function UpgradeModal({ show, reason, onClose }: UpgradeModalProps) {
  const titleId = useId();
  const primaryRef = useRef<HTMLAnchorElement>(null);

  // Dialog keyboard support: focus the main action on open, Escape closes.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!show) return;
    const raf = requestAnimationFrame(() => primaryRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.repeat) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: "spring", damping: 20 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full max-w-sm rounded-[28px] p-7 sm:p-8 text-center"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-line)",
                boxShadow: "0 24px 64px -16px rgba(0, 0, 0, 0.45)",
              }}
            >
              <div className="text-6xl mb-4" aria-hidden="true">🚀</div>
              <h2
                id={titleId}
                className="text-2xl font-extrabold mb-2 text-balance"
                style={{ color: "var(--color-text-primary)" }}
              >
                Ready for the full adventure?
              </h2>
              <p className="mb-2 text-pretty" style={{ color: "var(--color-text-secondary)" }}>
                {reason}
              </p>
              <p className="mb-6 text-sm text-pretty" style={{ color: "var(--color-text-muted)" }}>
                Upgrade to unlock all 5 levels, all themes, and the full sticker collection!
              </p>
              <div className="flex flex-col gap-3">
                <a
                  ref={primaryRef}
                  href="/billing"
                  className="btn-primary w-full py-3 text-center flex items-center justify-center"
                >
                  Upgrade to keep reading
                </a>
                <button
                  onClick={onClose}
                  className="py-3 rounded-2xl font-semibold transition-colors hover:bg-[var(--color-hover)]"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Maybe later
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
