"use client";

import { motion } from "framer-motion";

const STARS = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x: `${Math.random() * 90 + 5}%`,
  delay: Math.random() * 1.5,
  size: Math.random() * 4 + 3,
  color: ["#FFD700", "#FFA500", "#FFFFFF", "#A78BFA", "#34D399"][Math.floor(Math.random() * 5)],
}));

export default function ShootingStars() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {STARS.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full"
          style={{
            left: star.x,
            top: "-10px",
            width: star.size,
            height: star.size,
            background: star.color,
            boxShadow: `0 0 ${star.size * 2}px ${star.color}`,
          }}
          initial={{ y: -20, opacity: 0 }}
          animate={{
            y: "110vh",
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 1.2,
            delay: star.delay,
            ease: "easeIn",
          }}
        />
      ))}
    </div>
  );
}
