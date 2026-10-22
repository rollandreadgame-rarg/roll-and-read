"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { TourVariant } from "./runTour";

type TourInstance = { destroy: () => void; isActive: () => boolean };

/**
 * Owns the /teacher spotlight tour. `start()` lazy-loads driver.js (and its
 * CSS) the first time it's called. `announcement` feeds an aria-live region
 * the page renders, so each step is announced to screen readers.
 */
export function useTeacherTour({ variant, hasPin }: { variant: TourVariant; hasPin: boolean }) {
  const reducedMotion = usePrefersReducedMotion();
  const [announcement, setAnnouncement] = useState("");
  const tourRef = useRef<TourInstance | null>(null);
  const startingRef = useRef(false);

  const start = useCallback(async () => {
    if (startingRef.current || tourRef.current?.isActive()) return;
    startingRef.current = true;
    const active = document.activeElement;
    const returnFocusTo =
      active instanceof HTMLElement && active !== document.body
        ? active
        : document.querySelector<HTMLElement>('[data-tour="tour-replay"]');
    try {
      const { runTeacherTour } = await import("./runTour");
      tourRef.current = await runTeacherTour({
        variant,
        hasPin,
        reducedMotion,
        announce: setAnnouncement,
        returnFocusTo,
      });
    } catch (err) {
      console.error("Teacher tour failed to start", err);
      setAnnouncement("Sorry, the walkthrough couldn't open. Please try again.");
    } finally {
      startingRef.current = false;
    }
  }, [variant, hasPin, reducedMotion]);

  // Never leave the overlay behind if the grown-up navigates away mid-tour.
  useEffect(() => {
    return () => {
      if (tourRef.current?.isActive()) tourRef.current.destroy();
    };
  }, []);

  return { start, announcement };
}
