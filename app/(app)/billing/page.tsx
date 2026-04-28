"use client";

import { useState, Suspense } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/convex/_generated/api";

type Plan = "free" | "individual" | "family" | "classroom";

const TIERS: {
  plan: Exclude<Plan, "free">;
  lookupKey: string;
  name: string;
  price: string;
  blurb: string;
  perks: string[];
}[] = [
  {
    plan: "individual",
    lookupKey: "individual_monthly",
    name: "Individual",
    price: "$7.99/mo",
    blurb: "For one child.",
    perks: ["1 child profile", "All 25 sublevels (1A–5B)", "Full word library", "All themes"],
  },
  {
    plan: "family",
    lookupKey: "family_monthly",
    name: "Family",
    price: "$14.99/mo",
    blurb: "For siblings or co-learners.",
    perks: ["Up to 5 child profiles", "All 25 sublevels", "Full word library", "All themes"],
  },
  {
    plan: "classroom",
    lookupKey: "classroom_monthly",
    name: "Classroom",
    price: "$49/mo",
    blurb: "For teachers and tutors.",
    perks: [
      "Up to 30 student profiles",
      "All 25 sublevels",
      "Teacher dashboard with progress reports",
      "All themes",
    ],
  },
];

function StatusBanner({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === "success") {
    return (
      <div
        className="rounded-2xl px-4 py-3"
        style={{
          background: "color-mix(in srgb, var(--color-success) 18%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-success) 60%, transparent)",
          color: "var(--color-text-primary)",
        }}
      >
        Subscription active. Welcome aboard!
      </div>
    );
  }
  if (status === "cancel") {
    return (
      <div
        className="rounded-2xl px-4 py-3"
        style={{
          background: "rgba(245,158,11,0.15)",
          border: "1px solid rgba(245,158,11,0.5)",
          color: "var(--color-text-primary)",
        }}
      >
        Checkout cancelled. No charge was made.
      </div>
    );
  }
  return null;
}

function BillingPageInner() {
  const search = useSearchParams();
  const status = search.get("status");
  const { user } = useCurrentUser();
  const sub = useQuery(
    api.subscriptions.getByClerkId,
    user?.id ? { clerkId: user.id } : "skip"
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startCheckout = async (lookupKey: string) => {
    setBusyKey(lookupKey);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookupKey }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setErrorMsg(data.error ?? "Could not start checkout");
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setBusyKey(null);
    }
  };

  const openPortal = async () => {
    setBusyKey("portal");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/stripe/create-portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setErrorMsg(data.error ?? "Could not open billing portal");
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setBusyKey(null);
    }
  };

  const currentPlan: Plan = sub?.plan ?? "free";
  const periodEnd = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd * 1000).toLocaleDateString()
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1
          className="text-3xl font-extrabold tracking-tight text-balance"
          style={{ color: "var(--color-text-primary)" }}
        >
          💳 Billing & Plan
        </h1>
        <p className="text-pretty" style={{ color: "var(--color-text-muted)" }}>
          Manage your Roll &amp; Read subscription.
        </p>
      </header>

      <StatusBanner status={status} />

      {errorMsg && (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.5)",
            color: "var(--color-text-primary)",
          }}
        >
          {errorMsg}
        </div>
      )}

      <section
        className="rounded-3xl p-5"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div
              className="text-xs uppercase tracking-wide"
              style={{ color: "var(--color-text-muted)" }}
            >
              Current plan
            </div>
            <div
              className="text-xl font-bold capitalize"
              style={{ color: "var(--color-text-primary)" }}
            >
              {currentPlan}
            </div>
            <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {sub
                ? `${sub.profileCount} of ${sub.profileLimit} profile${sub.profileLimit === 1 ? "" : "s"} used`
                : "Loading…"}
            </div>
            {sub?.subscriptionStatus && (
              <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                Status: {sub.subscriptionStatus}
                {periodEnd ? ` · renews ${periodEnd}` : ""}
                {sub.cancelAtPeriodEnd ? " · cancels at period end" : ""}
              </div>
            )}
          </div>
          {currentPlan !== "free" && (
            <button
              onClick={openPortal}
              disabled={busyKey === "portal"}
              className="rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
              style={{
                background: "var(--color-brand)",
                color: "white",
              }}
            >
              {busyKey === "portal" ? "Opening…" : "Manage subscription"}
            </button>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TIERS.map((t) => {
          const isCurrent = currentPlan === t.plan;
          return (
            <article
              key={t.plan}
              className="flex flex-col rounded-3xl p-5 transition"
              style={{
                background: isCurrent
                  ? "color-mix(in srgb, var(--color-brand) 15%, var(--color-bg-surface))"
                  : "var(--color-bg-surface)",
                border: isCurrent
                  ? "2px solid var(--color-brand)"
                  : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="mb-3">
                <div
                  className="text-lg font-bold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {t.name}
                </div>
                <div
                  className="text-2xl font-extrabold tabular-nums"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {t.price}
                </div>
                <div
                  className="mt-1 text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {t.blurb}
                </div>
              </div>
              <ul className="mb-4 space-y-1 text-sm">
                {t.perks.map((p) => (
                  <li key={p} style={{ color: "var(--color-text-primary)" }}>
                    · {p}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startCheckout(t.lookupKey)}
                disabled={isCurrent || busyKey === t.lookupKey}
                className="mt-auto rounded-2xl px-4 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: isCurrent
                    ? "rgba(255,255,255,0.12)"
                    : "linear-gradient(135deg, var(--color-brand), color-mix(in srgb, var(--color-brand) 70%, black))",
                }}
              >
                {isCurrent
                  ? "Current plan"
                  : busyKey === t.lookupKey
                  ? "Redirecting…"
                  : `Choose ${t.name}`}
              </button>
            </article>
          );
        })}
      </section>

      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        Payments are processed securely by Stripe. You can cancel anytime from
        the manage-subscription portal.
      </p>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-8" style={{ color: "var(--color-text-muted)" }}>Loading…</div>}>
      <BillingPageInner />
    </Suspense>
  );
}
