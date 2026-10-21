"use client";

import { motion } from "framer-motion";

interface CoinPopupProps {
  amount: number;
  x: number;
  y: number;
  id: string;
}

export default function CoinPopup({ amount, x, y, id }: CoinPopupProps) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -60, scale: 0.5 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      aria-hidden="true"
      className="fixed z-50 pointer-events-none font-extrabold text-sm tabular-nums whitespace-nowrap px-2 py-0.5 rounded-full"
      style={{
        left: x,
        top: y,
        // Gold coin chip with dark ink: legible on light and dark themes alike.
        background: "var(--color-accent-gold)",
        color: "var(--card-ink)",
        boxShadow: "0 2px 0 color-mix(in srgb, var(--color-accent-gold) 60%, black), 0 4px 10px -4px rgba(0,0,0,0.4)",
      }}
    >
      +{amount} 💰
    </motion.div>
  );
}
