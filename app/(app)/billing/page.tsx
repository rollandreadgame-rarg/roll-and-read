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
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
        Subscription active. Welcome aboard!
      </div>
    );
  }
  if (status === "cancel") {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
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

  const startCheckout = async (lookupKey: string) => {
    setBusyKey(lookupKey);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookupKey }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error ?? "Could not start checkout");
    } finally {
      setBusyKey(null);
    }
  };

  const openPortal = async () => {
    setBusyKey("portal");
    try {
      const res = await fetch("/api/stripe/create-portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error ?? "Could not open billing portal");
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
        <h1 className="text-3xl font-bold tracking-tight text-balance">Billing & Plan</h1>
        <p className="text-pretty text-zinc-600">
          Manage your Roll & Read subscription.
        </p>
      </header>

      <StatusBanner status={status} />

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">Current plan</div>
            <div className="text-xl font-semibold capitalize">{currentPlan}</div>
            <div className="text-sm text-zinc-600">
              {sub
                ? `${sub.profileCount} of ${sub.profileLimit} profile${sub.profileLimit === 1 ? "" : "s"} used`
                : "Loading…"}
            </div>
            {sub?.subscriptionStatus && (
              <div className="text-xs text-zinc-500">
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
              className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition disabled:opacity-50"
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
              className={`flex flex-col rounded-3xl border p-5 shadow-sm transition ${
                isCurrent
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-zinc-200 bg-white"
              }`}
            >
              <div className="mb-3">
                <div className="text-lg font-semibold">{t.name}</div>
                <div className="text-2xl font-bold tabular-nums">{t.price}</div>
                <div className="mt-1 text-sm text-zinc-600">{t.blurb}</div>
              </div>
              <ul className="mb-4 space-y-1 text-sm text-zinc-700">
                {t.perks.map((p) => (
                  <li key={p}>· {p}</li>
                ))}
              </ul>
              <button
                onClick={() => startCheckout(t.lookupKey)}
                disabled={isCurrent || busyKey === t.lookupKey}
                className="mt-auto rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
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

      <p className="text-xs text-zinc-500">
        Payments are processed securely by Stripe. You can cancel anytime from
        the manage-subscription portal.
      </p>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500">Loading…</div>}>
      <BillingPageInner />
    </Suspense>
  );
}
