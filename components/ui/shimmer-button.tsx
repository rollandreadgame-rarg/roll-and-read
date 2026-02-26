"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";

interface ShimmerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  background?: string;
  className?: string;
  children: React.ReactNode;
}

export default function ShimmerButton({
  shimmerColor = "rgba(255,255,255,0.25)",
  background = "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-secondary) 100%)",
  className,
  children,
  ...props
}: ShimmerButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "relative overflow-hidden rounded-2xl px-6 py-3 font-extrabold text-white",
        "transition-shadow duration-300",
        "shadow-lg hover:shadow-xl",
        className
      )}
      style={{ background }}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {/* Shimmer sweep */}
      <span
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(105deg, transparent 40%, ${shimmerColor} 50%, transparent 60%)`,
          backgroundSize: "200% 100%",
          animation: "shimmer-sweep 2.2s linear infinite",
        }}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
}
