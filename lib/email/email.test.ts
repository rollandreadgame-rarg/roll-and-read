import { test } from "vitest";
import assert from "node:assert/strict";
import { sendEmail } from "./send";
import { paymentFailedEmail, welcomeEmail } from "./templates";

test("welcome email has html and plain text with the play link", () => {
  const e = welcomeEmail();
  assert.equal(e.subject, "Welcome to Roll & Read");
  assert.match(e.html, /<html lang="en">/);
  assert.match(e.html, /https:\/\/rollandreadgame\.com\/play/);
  assert.match(e.text, /https:\/\/rollandreadgame\.com\/play/);
  assert.doesNotMatch(e.text, /<[a-z]/i);
});

test("payment failed email names the plan, amount and invoice link", () => {
  const e = paymentFailedEmail({ planName: "Family", amount: "$14.99", payUrl: "https://invoice.stripe.com/i/x" });
  assert.match(e.html, /Family plan \(\$14\.99\)/);
  assert.match(e.html, /\/billing/);
  assert.match(e.text, /https:\/\/invoice\.stripe\.com\/i\/x/);
});

test("payment failed email reads cleanly without optional details", () => {
  const e = paymentFailedEmail({});
  assert.match(e.text, /your Roll & Read subscription\. This/);
  assert.doesNotMatch(e.text, /pay this invoice/);
  assert.doesNotMatch(e.html, /undefined|null/);
});

test("plan names are escaped in html", () => {
  const e = paymentFailedEmail({ planName: "<b>x</b>" });
  assert.match(e.html, /&lt;b&gt;x&lt;\/b&gt; plan/);
});

test("sendEmail is a no-op without RESEND_API_KEY", async () => {
  delete process.env.RESEND_API_KEY;
  const r = await sendEmail({ to: "a@example.com", subject: "s", html: "h", text: "t", idempotencyKey: "k" });
  assert.deepEqual(r, { sent: false, reason: "RESEND_API_KEY not set" });
});

test("sendEmail posts to Resend with the idempotency key and reply-to", async () => {
  process.env.RESEND_API_KEY = "re_test";
  const realFetch = globalThis.fetch;
  let call: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    call = { url, init };
    return new Response(JSON.stringify({ id: "1" }), { status: 200 });
  }) as typeof fetch;
  try {
    const r = await sendEmail({ to: "a@example.com", subject: "s", html: "h", text: "t", idempotencyKey: "welcome/u1" });
    assert.deepEqual(r, { sent: true });
    assert.equal(call?.url, "https://api.resend.com/emails");
    const headers = call?.init.headers as Record<string, string>;
    assert.equal(headers["Idempotency-Key"], "welcome/u1");
    assert.equal(headers.Authorization, "Bearer re_test");
    const body = JSON.parse(String(call?.init.body));
    assert.deepEqual(body.to, ["a@example.com"]);
    assert.equal(body.reply_to, "support@rollandreadgame.com");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
  }
});

test("sendEmail reports a Resend error without throwing", async () => {
  process.env.RESEND_API_KEY = "re_test";
  const realFetch = globalThis.fetch;
  const realError = console.error;
  globalThis.fetch = (async () => new Response("bad domain", { status: 403 })) as typeof fetch;
  console.error = () => {};
  try {
    const r = await sendEmail({ to: "a@example.com", subject: "s", html: "h", text: "t", idempotencyKey: "k" });
    assert.deepEqual(r, { sent: false, reason: "resend 403" });
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
    delete process.env.RESEND_API_KEY;
  }
});
