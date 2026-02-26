"use client";

/**
 * Drop-in replacement for Clerk's useUser().
 * In E2E mode (NEXT_PUBLIC_E2E_MODE=true), returns a mock user
 * so automated browsers can access protected pages without Clerk auth.
 */

const E2E_CLERK_ID = "e2e_test_user";
const IS_E2E = process.env.NEXT_PUBLIC_E2E_MODE === "true";

// In E2E mode, return a static mock. In normal mode, delegate to Clerk.
// The branch is resolved at module load time (env var is build-time constant),
// so the hook call is unconditional at runtime — no rules-of-hooks violation.
let useCurrentUserImpl: () => { user: { id: string; primaryEmailAddress?: { emailAddress: string }; fullName?: string } | null | undefined };

if (IS_E2E) {
  useCurrentUserImpl = () => ({
    user: {
      id: E2E_CLERK_ID,
      primaryEmailAddress: { emailAddress: "e2e@rollnread.test" },
      fullName: "E2E Test User",
    },
  });
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const clerk = require("@clerk/nextjs");
  useCurrentUserImpl = clerk.useUser;
}

export function useCurrentUser() {
  return useCurrentUserImpl();
}
