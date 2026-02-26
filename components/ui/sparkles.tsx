"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface Sparkle {
  id: number;
  x: string;
  y: string;
  size: number;
  delay: number;
  color: string;
}

const COLORS = ["#FFD700", "#FFA500", "#FF6B9D", "#A78BFA", "#34D399", "#60A5FA"];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function generateSparkles(count: number): Sparkle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: `${randomBetween(5, 95)}%`,
    y: `${randomBetween(5, 95)}%`,
    size: randomBetween(6, 14),
    delay: randomBetween(0, 1.5),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
}

interface SparklesProps {
  count?: number;
  className?: string;
}

export default function Sparkles({ count = 12, className }: SparklesProps) {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    setSparkles(generateSparkles(count));
  }, [count]);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className ?? ""}`}>
      {sparkles.map((s) => (
        <motion.div
          key={s.id}
          className="absolute"
          style={{ left: s.x, top: s.y }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 1.6,
            delay: s.delay,
            repeat: Infinity,
            repeatDelay: randomBetween(1, 3),
            ease: "easeInOut",
          }}
        >
          <svg width={s.size} height={s.size} viewBox="0 0 16 16" fill={s.color}>
            <path d="M8 0 L9.5 6.5 L16 8 L9.5 9.5 L8 16 L6.5 9.5 L0 8 L6.5 6.5 Z" />
          </svg>
        </motion.div>
      ))}
    </div>
  );
}
