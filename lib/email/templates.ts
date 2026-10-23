import { SUPPORT_EMAIL } from "@/lib/contact";

// Plain, readable emails: real text (no images of text), one column, large
// type and high contrast, so they work in any mail app and with screen readers.
// Every email has a plain-text twin.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://rollandreadgame.com").replace(/\/$/, "");

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div role="main" style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.6;color:#1a1a1a;">
<p style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1a4fd6;">Roll &amp; Read</p>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;">${escape(title)}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #d0d0d0;margin:32px 0 16px;">
<p style="margin:0;font-size:14px;color:#4a4a4a;">Questions? Reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#1a4fd6;">${SUPPORT_EMAIL}</a>. Answers to common questions: <a href="${APP_URL}/help" style="color:#1a4fd6;">${APP_URL.replace(/^https?:\/\//, "")}/help</a></p>
</div>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:#1a4fd6;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;">${escape(label)}</a></p>`;
}

const footerText = `\n\nQuestions? Reply to this email or write to ${SUPPORT_EMAIL}.\nCommon questions: ${APP_URL}/help`;

export function welcomeEmail() {
  const subject = "Welcome to Roll & Read";
  const html = layout(
    subject,
    `<p style="margin:0 0 16px;">Thanks for joining Roll &amp; Read, the phonics dice game for early readers.</p>
<p style="margin:0 0 8px;">Three steps to get started:</p>
<ol style="margin:0 0 16px;padding-left:22px;">
<li style="margin-bottom:8px;"><strong>Add a reader.</strong> Give them a name and choose a starting level. Not sure which? Start at 1A; the game moves them up once they read 80% of words right the first time.</li>
<li style="margin-bottom:8px;"><strong>Set a grown-up PIN</strong> in Settings, so Settings, Billing and the Teacher dashboard stay grown-ups only.</li>
<li><strong>Play a board together.</strong> Roll the die, hear the word, tap it. The short tutorial reads every step aloud.</li>
</ol>
${button(`${APP_URL}/play`, "Start playing")}
<p style="margin:0;">Each reader's level and accuracy are on the Progress page whenever you want to check in.</p>`
  );
  const text = `Thanks for joining Roll & Read, the phonics dice game for early readers.

Three steps to get started:
1. Add a reader. Give them a name and choose a starting level. Not sure which? Start at 1A; the game moves them up once they read 80% of words right the first time.
2. Set a grown-up PIN in Settings, so Settings, Billing and the Teacher dashboard stay grown-ups only.
3. Play a board together. Roll the die, hear the word, tap it. The short tutorial reads every step aloud.

Start playing: ${APP_URL}/play

Each reader's level and accuracy are on the Progress page whenever you want to check in.${footerText}`;
  return { subject, html, text };
}

export function paymentFailedEmail(opts: { planName?: string; amount?: string; payUrl?: string | null }) {
  const plan = opts.planName ? `${opts.planName} plan` : "subscription";
  const subject = "Your Roll & Read payment didn't go through";
  const updateUrl = `${APP_URL}/billing`;
  const html = layout(
    subject,
    `<p style="margin:0 0 16px;">We couldn't charge your card for your Roll &amp; Read ${escape(plan)}${opts.amount ? ` (${escape(opts.amount)})` : ""}. This usually means the card expired or the bank declined it.</p>
<p style="margin:0 0 16px;">Your readers can keep playing for now. We'll try the card again over the next few days. To fix it now, update your card on the Billing page.</p>
${button(updateUrl, "Update payment method")}
${opts.payUrl ? `<p style="margin:0 0 16px;">Or pay this invoice directly: <a href="${opts.payUrl}" style="color:#1a4fd6;">pay invoice</a>.</p>` : ""}
<p style="margin:0;">If the payment can't be collected, the account goes back to the free plan. Your readers' progress is kept.</p>`
  );
  const text = `We couldn't charge your card for your Roll & Read ${plan}${opts.amount ? ` (${opts.amount})` : ""}. This usually means the card expired or the bank declined it.

Your readers can keep playing for now. We'll try the card again over the next few days. To fix it now, update your card on the Billing page:
${updateUrl}
${opts.payUrl ? `\nOr pay this invoice directly: ${opts.payUrl}\n` : ""}
If the payment can't be collected, the account goes back to the free plan. Your readers' progress is kept.${footerText}`;
  return { subject, html, text };
}
