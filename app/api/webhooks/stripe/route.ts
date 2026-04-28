import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { stripe } from "@/lib/stripe";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const runtime = "nodejs";

// Subscription events we care about. Anything else is acknowledged + ignored.
const RELEVANT_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown verification error";
    return NextResponse.json({ error: `Invalid signature: ${msg}` }, { status: 400 });
  }

  if (!RELEVANT_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    let subscription: Stripe.Subscription | null = null;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) {
        return NextResponse.json({ received: true, skipped: "non-subscription checkout" });
      }
      subscription = await stripe.subscriptions.retrieve(session.subscription as string, {
        expand: ["items.data.price"],
      });
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subId =
        typeof (invoice as unknown as { subscription?: string }).subscription === "string"
          ? ((invoice as unknown as { subscription?: string }).subscription as string)
          : null;
      if (!subId) {
        return NextResponse.json({ received: true, skipped: "invoice has no subscription" });
      }
      subscription = await stripe.subscriptions.retrieve(subId, {
        expand: ["items.data.price"],
      });
    } else {
      // customer.subscription.{created,updated,deleted}
      subscription = event.data.object as Stripe.Subscription;
      // The webhook payload may not include expanded price.lookup_key — re-fetch to be safe.
      subscription = await stripe.subscriptions.retrieve(subscription.id, {
        expand: ["items.data.price"],
      });
    }

    if (!subscription) {
      return NextResponse.json({ received: true, skipped: "no subscription resolved" });
    }

    const item = subscription.items.data[0];
    const price = item?.price;
    const periodEndSec =
      (item as unknown as { current_period_end?: number })?.current_period_end ??
      (subscription as unknown as { current_period_end?: number }).current_period_end ??
      undefined;

    await convex.mutation(api.subscriptions.syncFromStripe, {
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: price?.id,
      priceLookupKey: price?.lookup_key ?? undefined,
      subscriptionStatus:
        event.type === "customer.subscription.deleted" ? "canceled" : subscription.status,
      currentPeriodEnd: periodEndSec,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    });

    return NextResponse.json({ received: true, type: event.type });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown handler error";
    console.error(`[stripe-webhook] ${event.type} failed:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
