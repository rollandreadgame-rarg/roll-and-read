"use client";

/**
 * Drop-in replacement for Clerk's useUser().
 * In E2E mode (NEXT_PUBLIC_E2E_MODE=true), returns a mock user
 * so automated browsers can access protected pages without Clerk auth.
 */

import { useUser } from "@clerk/nextjs";

const E2E_CLERK_ID = "e2e_test_user";
// Never in production, same rule as middleware.ts and lib/auth-helpers.ts.
const IS_E2E =
  process.env.NEXT_PUBLIC_E2E_MODE === "true" && process.env.NODE_ENV !== "production";

const mockUser = {
  user: {
    id: E2E_CLERK_ID,
    primaryEmailAddress: { emailAddress: "e2e@rollnread.test" },
    fullName: "E2E Test User",
  },
};

export function useCurrentUser() {
  // Call the hook unconditionally (rules-of-hooks); its result is ignored in E2E.
  const clerkUser = useUser();
  if (IS_E2E) {
    return mockUser;
  }
  return clerkUser;
}
