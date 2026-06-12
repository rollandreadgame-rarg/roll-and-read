"use client";

import { useParentGate } from "@/providers/ParentGateProvider";
import ParentPinPrompt from "./ParentPinPrompt";

export default function RequireParentPin({ children }: { children: React.ReactNode }) {
  const { hasPin, unlocked, loaded } = useParentGate();
  if (!loaded) return null; // brief: waiting on the user record
  if (hasPin && !unlocked) return <ParentPinPrompt />;
  return <>{children}</>;
}
