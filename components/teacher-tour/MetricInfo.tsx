"use client";

// "?" explainers for the /teacher metrics.
//
// Built as a disclosure (WAI-ARIA pattern), not a floating popover: the "?"
// is a real <button> with aria-expanded/aria-controls, and the explanation
// opens in the page flow right below the metric. That keeps it readable at
// 390px, un-clipped by the reader card's overflow, in reading order for
// screen readers, and printable. Escape closes it and returns focus to the "?".
//
// Copy comes from lib/teacher-tour/metrics.ts (shared with the tour).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GOOD_LABEL,
  METRIC_BY_ID,
  WATCH_LABEL,
  type MetricId,
} from "@/lib/teacher-tour/metrics";

export interface MetricInfoState {
  openId: MetricId | null;
  toggle: (id: MetricId) => void;
  registerButton: (id: MetricId) => (el: HTMLButtonElement | null) => void;
  panelId: (id: MetricId) => string;
}

/** One open explainer at a time per scope (e.g. per reader card). */
export function useMetricInfo(scope: string): MetricInfoState {
  const [openId, setOpenId] = useState<MetricId | null>(null);
  const buttons = useRef<Partial<Record<MetricId, HTMLButtonElement | null>>>({});

  const panelId = useCallback((id: MetricId) => `${scope}-${id}-info`, [scope]);

  const toggle = useCallback((id: MetricId) => {
    setOpenId((cur) => (cur === id ? null : id));
  }, []);

  const registerButton = useCallback(
    (id: MetricId) => (el: HTMLButtonElement | null) => {
      buttons.current[id] = el;
    },
    []
  );

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // While the spotlight tour is open, Escape belongs to the tour.
      if (document.body.classList.contains("driver-active")) return;
      const btn = buttons.current[openId];
      const panel = document.getElementById(panelId(openId));
      const active = document.activeElement;
      const focusIsOurs =
        active === btn ||
        active === document.body ||
        (active instanceof Node && Boolean(panel?.contains(active)));
      if (!focusIsOurs) return;
      e.preventDefault();
      setOpenId(null);
      btn?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId, panelId]);

  return { openId, toggle, registerButton, panelId };
}

export function MetricInfoButton({
  metricId,
  info,
}: {
  metricId: MetricId;
  info: MetricInfoState;
}) {
  const m = METRIC_BY_ID[metricId];
  const open = info.openId === metricId;
  return (
    // 44px hit area (global touch-target rule) around a small visible circle;
    // negative margins keep it from stretching the label row.
    <button
      ref={info.registerButton(metricId)}
      type="button"
      aria-expanded={open}
      aria-controls={info.panelId(metricId)}
      aria-label={`What does ${m.title.toLowerCase()} mean?`}
      onClick={(e) => {
        e.stopPropagation();
        info.toggle(metricId);
      }}
      className="-my-3 -mx-2 inline-flex shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-hover)] print:hidden"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
        style={
          open
            ? { background: "var(--color-brand)", color: "var(--color-on-brand)" }
            : {
                background: "var(--color-bg-surface)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-line-strong)",
              }
        }
      >
        ?
      </span>
    </button>
  );
}

export function MetricInfoPanel({
  metricId,
  info,
  className = "",
}: {
  metricId: MetricId;
  info: MetricInfoState;
  className?: string;
}) {
  const m = METRIC_BY_ID[metricId];
  const open = info.openId === metricId;
  return (
    <div
      id={info.panelId(metricId)}
      hidden={!open}
      className={`rounded-xl p-3 text-left text-sm leading-relaxed print:hidden ${className}`}
      style={{
        fontFamily: "var(--font-ui)",
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-line-strong)",
        color: "var(--color-text-secondary)",
      }}
    >
      <p className="font-bold" style={{ color: "var(--color-text-primary)" }}>
        {m.title}
      </p>
      <p className="mt-1">{m.what}</p>
      <p className="mt-2">
        <span className="font-semibold" style={{ color: "var(--color-success-text)" }}>
          {GOOD_LABEL}
        </span>{" "}
        {m.goodSignal}
      </p>
      <p className="mt-1">
        <span className="font-semibold" style={{ color: "var(--color-warning-text)" }}>
          {WATCH_LABEL}
        </span>{" "}
        {m.watchSignal}
      </p>
    </div>
  );
}
