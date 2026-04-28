import { auth } from "@clerk/nextjs/server";

const E2E_CLERK_ID = "e2e_test_user";

// Returns the effective Clerk userId for the current request.
// In E2E mode (NEXT_PUBLIC_E2E_MODE=true) it returns the test user id even
// without a real Clerk session, so Playwright can drive protected APIs.
// Production safety: NEXT_PUBLIC_E2E_MODE is never set in Vercel env.
export async function getEffectiveUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    if (userId) return userId;
  } catch {
    // auth() throws if middleware didn't run for this route — fall through to E2E check.
  }
  if (process.env.NEXT_PUBLIC_E2E_MODE === "true") return E2E_CLERK_ID;
  return null;
}

export async function getEffectiveEmail(): Promise<string | null> {
  if (process.env.NEXT_PUBLIC_E2E_MODE === "true") return "e2e@rollnread.test";
  try {
    const { currentUser } = await import("@clerk/nextjs/server");
    const u = await currentUser();
    return u?.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}
