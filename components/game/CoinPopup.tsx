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
      className="fixed z-50 pointer-events-none font-extrabold text-sm tabular-nums"
      style={{
        left: x,
        top: y,
        color: "var(--color-accent-gold)",
        textShadow: "0 1px 4px rgba(0,0,0,0.5)",
      }}
    >
      +{amount} 💰
    </motion.div>
  );
}
