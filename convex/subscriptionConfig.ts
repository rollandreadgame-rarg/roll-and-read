// @ts-nocheck
// Subscription tier rules. Imported by profiles, subscriptions, and gating logic.

export const PLANS = ["free", "individual", "family", "classroom"] as const;
export type Plan = typeof PLANS[number];

export const PROFILE_LIMITS: Record<Plan, number> = {
  free: 1,
  individual: 1,
  family: 5,
  classroom: 30,
};

// Free tier is locked to Level 1 sublevels (1A-1H). All other tiers unlock everything.
export function isLevelAllowed(plan: Plan, level: string): boolean {
  if (plan === "free") return level.startsWith("1");
  return true;
}

// Stripe price lookup keys → plan tier. Source of truth for webhook → DB sync.
// Lookup keys are stable across test/live; the actual price IDs differ per environment.
export const PRICE_LOOKUP_TO_PLAN: Record<string, Plan> = {
  individual_monthly: "individual",
  family_monthly: "family",
  classroom_monthly: "classroom",
};

export function planFromLookupKey(lookupKey: string | null | undefined): Plan {
  if (!lookupKey) return "free";
  return PRICE_LOOKUP_TO_PLAN[lookupKey] ?? "free";
}

// Stripe subscription statuses that grant paid access. anything else → treat as free.
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function isPaidStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return ACTIVE_STATUSES.has(status);
}
