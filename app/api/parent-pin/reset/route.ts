import { NextResponse } from "next/server";
import { auth, reverificationError } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { isValidPinFormat } from "@/lib/parentPin/parentPinLogic.mjs";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Forgot-PIN reset. The grown-up must have re-verified with Clerk (password or
// emailed code) in the last 10 minutes; otherwise Clerk's reverification error
// goes back and the browser's useReverification hook asks them to verify, then
// retries. Convex only accepts the reset from here (it needs the sync secret).
export async function POST(req: Request) {
  const { userId, has } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!has({ reverification: "strict" })) {
    return NextResponse.json(reverificationError("strict"), { status: 403 });
  }

  let newPin: unknown;
  try {
    ({ newPin } = await req.json());
  } catch {
    newPin = undefined;
  }
  if (typeof newPin !== "string" || !isValidPinFormat(newPin)) {
    return NextResponse.json({ error: "PIN must be 4 digits" }, { status: 400 });
  }

  try {
    await convex.mutation(api.parentPin.resetParentPin, {
      clerkId: userId,
      newPin,
      syncSecret: process.env.CONVEX_SYNC_SECRET,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[parent-pin/reset] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not reset the PIN" }, { status: 500 });
  }
}
