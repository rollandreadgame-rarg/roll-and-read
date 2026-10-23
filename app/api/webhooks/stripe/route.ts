import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { stripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/email/send";
import { paymentFailedEmail } from "@/lib/email/templates";

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
      // Post-"basil" (2025+) API moved the subscription id off the top-level
      // Invoice field. Resolve it from the new locations, keeping the legacy
      // top-level read as a last-resort fallback for old-version endpoints.
      const inv = invoice as unknown as {
        subscription?: string;
        parent?: { subscription_details?: { subscription?: string } };
        lines?: {
          data?: {
            parent?: {
              subscription_item_details?: { subscription?: string };
            };
          }[];
        };
      };
      const subId =
        inv.parent?.subscription_details?.subscription ??
        inv.lines?.data?.[0]?.parent?.subscription_item_details?.subscription ??
        (typeof inv.subscription === "string" ? inv.subscription : null);
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
      syncSecret: process.env.CONVEX_SYNC_SECRET,
    });

    // Email only on the first failed attempt: Stripe retries the card over
    // several days and each retry fires this event again.
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.attempt_count === 1 && invoice.customer_email) {
        await sendEmail({
          to: invoice.customer_email,
          ...paymentFailedEmail({
            planName: planName(price?.lookup_key),
            amount: formatAmount(invoice.amount_due, invoice.currency),
            payUrl: invoice.hosted_invoice_url,
          }),
          idempotencyKey: `payment-failed/${invoice.id}`,
        });
      }
    }

    return NextResponse.json({ received: true, type: event.type });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown handler error";
    console.error(`[stripe-webhook] ${event.type} failed:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// "family_monthly" -> "Family"
function planName(lookupKey: string | null | undefined): string | undefined {
  const word = lookupKey?.split("_")[0];
  return word ? word[0].toUpperCase() + word.slice(1) : undefined;
}

function formatAmount(cents: number | null | undefined, currency: string | null | undefined) {
  if (cents == null || !currency) return undefined;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
