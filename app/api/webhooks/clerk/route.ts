import { Webhook } from "svix";
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

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
      email_addresses: { email_address: string }[];
    };
    await convex.mutation(api.users.createUser, {
      clerkId: data.id,
      email: data.email_addresses[0]?.email_address ?? "",
      plan: "free",
    });
  }

  if (event.type === "user.updated") {
    const data = event.data as {
      id: string;
      public_metadata?: { plan?: string };
    };
    const plan = (data.public_metadata?.plan ?? "free") as
      | "free"
      | "individual"
      | "family"
      | "classroom";

    await convex.mutation(api.users.updatePlan, {
      clerkId: data.id,
      plan,
    });
  }

  return NextResponse.json({ success: true });
}
