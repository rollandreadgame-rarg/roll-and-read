"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

// Framer Motion animations follow the device's "reduce motion" setting
// (CSS animations already do, via the media query in globals.css).
export default function MotionPreferences({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
