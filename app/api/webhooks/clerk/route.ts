import { Webhook } from "svix";
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = wh.verify(payload, headers) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created") {
    const data = event.data as {
      id: string;
      email_addresses: { id: string; email_address: string }[];
      primary_email_address_id?: string | null;
    };
    const primary =
      data.email_addresses?.find(
        (e) => e.id === data.primary_email_address_id
      ) ?? data.email_addresses?.[0];
    await convex.mutation(api.users.createUser, {
      clerkId: data.id,
      email: primary?.email_address ?? "",
      syncSecret: process.env.CONVEX_SYNC_SECRET,
    });
    if (primary?.email_address) {
      await sendEmail({
        to: primary.email_address,
        ...welcomeEmail(),
        idempotencyKey: `welcome/${data.id}`,
      });
    }
  }

  if (event.type === "user.updated") {
    const data = event.data as {
      id: string;
      email_addresses?: { id: string; email_address: string }[];
      primary_email_address_id?: string | null;
    };
    // Sync email only — NEVER the plan. Stripe is the source of truth for
    // billing; writing plan here downgraded paying customers to "free"
    // whenever they edited their Clerk profile.
    const primary =
      data.email_addresses?.find(
        (e) => e.id === data.primary_email_address_id
      ) ?? data.email_addresses?.[0];
    if (primary?.email_address) {
      await convex.mutation(api.users.updateEmailFromClerk, {
        clerkId: data.id,
        email: primary.email_address,
        syncSecret: process.env.CONVEX_SYNC_SECRET,
      });
    }
  }

  return NextResponse.json({ success: true });
}
