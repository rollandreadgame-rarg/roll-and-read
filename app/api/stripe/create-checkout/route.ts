import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { stripe } from "@/lib/stripe";
import { getEffectiveUserId, getEffectiveEmail } from "@/lib/auth-helpers";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const ALLOWED_LOOKUP_KEYS = new Set([
  "individual_monthly",
  "family_monthly",
  "classroom_monthly",
]);

export async function POST(req: NextRequest) {
  const userId = await getEffectiveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { lookupKey } = (await req.json()) as { lookupKey?: string };
  if (!lookupKey || !ALLOWED_LOOKUP_KEYS.has(lookupKey)) {
    return NextResponse.json({ error: "Invalid lookupKey" }, { status: 400 });
  }

  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    expand: ["data.product"],
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    return NextResponse.json({ error: "Price not found" }, { status: 404 });
  }

  const sub = await convex.query(api.subscriptions.getByClerkId, {
    clerkId: userId,
  });

  let customerId = sub?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const email = (await getEffectiveEmail()) ?? undefined;
    const customer = await stripe.customers.create({
      email,
      metadata: { clerkId: userId },
    });
    customerId = customer.id;
    await convex.mutation(api.subscriptions.setStripeCustomerId, {
      clerkId: userId,
      stripeCustomerId: customerId,
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: price.id, quantity: 1 }],
    success_url: `${baseUrl}/billing?status=success`,
    cancel_url: `${baseUrl}/billing?status=cancel`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
