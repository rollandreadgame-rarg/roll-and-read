import { auth } from "@clerk/nextjs/server";

const E2E_CLERK_ID = "e2e_test_user";

// E2E bypass is only ever honored outside production, so an accidental
// NEXT_PUBLIC_E2E_MODE=true in a Vercel prod env can never disable auth.
const E2E_ENABLED =
  process.env.NEXT_PUBLIC_E2E_MODE === "true" &&
  process.env.NODE_ENV !== "production";

// Returns the effective Clerk userId for the current request.
// In E2E mode it returns the test user id even without a real Clerk session,
// so Playwright can drive protected APIs. Never active in production builds.
export async function getEffectiveUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    if (userId) return userId;
  } catch {
    // auth() throws if middleware didn't run for this route — fall through to E2E check.
  }
  if (E2E_ENABLED) return E2E_CLERK_ID;
  return null;
}

export async function getEffectiveEmail(): Promise<string | null> {
  if (E2E_ENABLED) return "e2e@rollnread.test";
  try {
    const { currentUser } = await import("@clerk/nextjs/server");
    const u = await currentUser();
    // Primary first: emailAddresses[0] is not necessarily the primary address.
    return u?.primaryEmailAddress?.emailAddress ?? u?.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}
