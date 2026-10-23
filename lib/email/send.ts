import { SUPPORT_EMAIL } from "@/lib/contact";

// Transactional email through Resend's HTTP API (no SDK needed). Dormant until
// RESEND_API_KEY is set on Vercel: without it every send is a logged no-op, so
// webhooks keep working either way. Email failures never fail a webhook.
const FROM = process.env.EMAIL_FROM ?? "Roll & Read <hello@rollandreadgame.com>";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Same key = same email. Webhooks retry, and a retry must not send twice.
  idempotencyKey: string;
};

export type SendResult = { sent: boolean; reason?: string };

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "RESEND_API_KEY not set" };
  if (!msg.to) return { sent: false, reason: "no recipient" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": msg.idempotencyKey,
      },
      body: JSON.stringify({
        from: FROM,
        to: [msg.to],
        reply_to: SUPPORT_EMAIL,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend ${res.status}: ${body.slice(0, 300)}`);
      return { sent: false, reason: `resend ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] send failed:", err instanceof Error ? err.message : err);
    return { sent: false, reason: "network" };
  }
}
