import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { stripe } from "@/lib/stripe";
import { getEffectiveUserId } from "@/lib/auth-helpers";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST() {
  try {
    const userId = await getEffectiveUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sub = await convex.query(api.subscriptions.getByClerkId, {
      clerkId: userId,
      syncSecret: process.env.CONVEX_SYNC_SECRET,
    });
    if (!sub?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer for this user" },
        { status: 400 }
      );
    }

    // Strip a trailing slash so "https://x.com/" never yields "https://x.com//billing".
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${baseUrl}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Portal failed";
    console.error("[create-portal] failed:", msg);
    return NextResponse.json({ error: "Could not open billing portal" }, { status: 500 });
  }
}
