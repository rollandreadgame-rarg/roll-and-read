"use client";

import { useState, Suspense } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/convex/_generated/api";
import RequireParentPin from "@/components/parent-pin/RequireParentPin";

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

// Tinted notice boxes built from the shared status tokens, so they read on
// both the dark and the light themes.
function noticeStyle(token: string): React.CSSProperties {
  return {
    background: `color-mix(in srgb, ${token} 14%, var(--color-bg-surface))`,
    border: `1px solid color-mix(in srgb, ${token} 45%, transparent)`,
    color: "var(--color-text-primary)",
  };
}

const SUCCESS_TEXT = "var(--color-success-text)";

function StatusBanner({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === "success") {
    return (
      <div className="rounded-2xl px-4 py-3" style={noticeStyle("var(--color-success)")}>
        Subscription active. Welcome aboard!
      </div>
    );
  }
  if (status === "cancel") {
    return (
      <div className="rounded-2xl px-4 py-3" style={noticeStyle("var(--color-warning)")}>
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
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-2xl sm:text-3xl font-extrabold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Billing and plan
        </h1>
        <p className="text-pretty" style={{ color: "var(--color-text-secondary)" }}>
          Manage your Roll &amp; Read subscription.
        </p>
      </header>

      <StatusBanner status={status} />

      {errorMsg && (
        <div
          role="alert"
          className="rounded-2xl px-4 py-3 text-sm"
          style={noticeStyle("var(--color-error)")}
        >
          {errorMsg}
        </div>
      )}

      <section className="panel p-5 sm:p-6" aria-labelledby="current-plan-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="current-plan-heading"
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-muted)" }}
            >
              Current plan
            </h2>
            <div
              className="text-2xl font-extrabold capitalize"
              style={{ color: "var(--color-text-primary)" }}
            >
              {currentPlan}
            </div>
            <div className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
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
              className="rounded-2xl px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-hover)] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: "var(--color-surface-2)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-line)",
              }}
            >
              {busyKey === "portal" ? "Opening…" : "Manage subscription"}
            </button>
          )}
        </div>
      </section>

      <section aria-label="Plans" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TIERS.map((t) => {
          const isCurrent = currentPlan === t.plan;
          return (
            <article
              key={t.plan}
              className="panel flex flex-col p-5 sm:p-6"
              style={
                isCurrent
                  ? {
                      background: "color-mix(in srgb, var(--color-brand) 10%, var(--color-bg-surface))",
                      borderColor: "var(--color-brand-secondary)",
                      boxShadow: "inset 0 0 0 1px var(--color-brand-secondary)",
                    }
                  : undefined
              }
            >
              <div className="mb-4">
                <div className="flex items-center justify-between gap-2">
                  <h2
                    className="text-lg font-bold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {t.name}
                  </h2>
                  {isCurrent && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{
                        background: "var(--color-surface-2)",
                        color: "var(--color-brand-secondary)",
                      }}
                    >
                      Your plan
                    </span>
                  )}
                </div>
                <div
                  className="mt-1 text-3xl font-extrabold tabular-nums"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {t.price}
                </div>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {t.blurb}
                </p>
              </div>
              <ul className="mb-6 flex flex-col gap-2 text-sm">
                {t.perks.map((p) => (
                  <li key={p} className="flex gap-2" style={{ color: "var(--color-text-primary)" }}>
                    <span aria-hidden="true" className="font-bold" style={{ color: SUCCESS_TEXT }}>✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startCheckout(t.lookupKey)}
                disabled={isCurrent || busyKey === t.lookupKey}
                className="btn-primary mt-auto px-4 py-3 text-sm"
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
    <RequireParentPin>
      <Suspense fallback={<div className="p-8" style={{ color: "var(--color-text-muted)" }}>Loading…</div>}>
        <BillingPageInner />
      </Suspense>
    </RequireParentPin>
  );
}
