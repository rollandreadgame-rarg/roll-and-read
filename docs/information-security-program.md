# Written Information Security Program — Roll & Read

Operator: NMT Direct INC, doing business as Roll & Read (rollandreadgame.com).
Required by the COPPA Rule, 16 CFR 312.8(b) (as amended 2025). Adopted October 25, 2026.
Next annual review due: **October 25, 2027.**

## 1. Coordinator (312.8(b)(1))

The owner of NMT Direct INC coordinates this program. Contact: support@rollandreadgame.com.
The coordinator approves changes to production systems and service providers, keeps this
document current, and runs the annual review.

## 2. What we protect

| Data | Where | Sensitivity |
|---|---|---|
| Reader (child) first name/nickname, avatar, level, theme | Convex `profiles` | Child data (COPPA) |
| Game progress: word bank, practice words, stickers, sessions, streaks | Convex `word_bank`, `profile_stickers`, `game_sessions`, `profiles` | Child data (COPPA) |
| Device IP / browser type in request logs | Vercel, Cloudflare (R2 images), Convex | Persistent identifier (COPPA), used only for internal operations |
| Grown-up email, sign-in factors, sessions | Clerk (email copy in Convex `users`) | Adult personal data |
| Grown-up PIN | Convex `users.parentPinHash` (salted SHA-256) | Credential |
| Billing | Stripe (we keep customer/subscription ids, plan, status) | Adult financial |
| Crash reports | Convex `client_errors` (message, path, browser, Clerk id) | Operational |

Children never provide last names, contact details, photos, voice, location or IDs.

## 3. Risk assessment (312.8(b)(2)) — at least annually

Risks identified October 2026 and the safeguard for each:

| Risk | Safeguard |
|---|---|
| One family reading or changing another family's data | Every Convex function checks the signed-in Clerk identity owns the reader (`convex/authHelpers.ts`); `convex/visibility.test.ts` pins the public API; ownership tests in `convex/*.test.ts` |
| Server-only actions called from a browser (billing sync, PIN reset, account deletion) | Require the sync secret (SHA-256 checked in code; prod and dev secrets differ and the dev one is accepted only by the dev deployment) |
| Child changes grown-up settings / PIN | Grown-up PIN gate; PIN lockout doubles to 1 hour; PIN reset needs Clerk reverification (password or emailed code within 10 min) checked on the server |
| Faked game rewards | Coins, board completion, sticker picks and level-ups decided by the server (`convex/wordBank.ts`, `convex/profiles.ts`, `convex/stickersDb.ts`) |
| Stolen secrets | Secrets only in Vercel env vars (sensitive) and the operator's local `.env.local` (gitignored); never in the repo or logs |
| Webhook forgery | Stripe and Clerk webhooks verify signatures |
| Child data kept too long | Retention policy (`docs/data-retention-policy.md`) enforced by daily jobs in `convex/crons.ts` |
| Third parties receiving child data | No ads, trackers or third-party scripts in the app; fonts and audio self-hosted; only the providers in section 5 |
| Lost data / outage | Managed providers with their own redundancy; error reports reviewed |

## 4. Safeguards in place (312.8(b)(3))

- HTTPS everywhere (Vercel, Convex, Clerk, Stripe, Cloudflare); providers encrypt data at rest.
- Least privilege: only the coordinator holds production credentials (Convex deploy keys, Vercel,
  Stripe, Clerk, Namecheap). Admin-only Convex functions are `internalMutation`s or need the
  maintenance key.
- Sign-in by Clerk (passwords never handled by us; new-device email codes).
- Data minimization: first name or nickname only; no free-text fields for children.
- Deletion: reader delete in Settings; account delete (Clerk) cascades through the Clerk
  `user.deleted` webhook to `dataLifecycle.deleteAccount` and cancels any subscription.

## 5. Service providers (312.8(c))

Each is chosen for its security practices and bound by written terms (data processing
agreement and terms of service, published on each provider's legal pages) to keep information confidential and secure and use it only to
provide its service to us:

- Clerk — sign-in
- Convex — database and backend
- Vercel — hosting, cookieless analytics
- Cloudflare — sticker image delivery
- Stripe — payments, adults only

Before adding any provider that would receive children's information, the coordinator checks its
security and gets written assurances first, and updates the Privacy Policy.

## 6. Testing and monitoring (312.8(b)(4))

- `npm test` (vitest, ~800 tests) covers access control, secrets, deletion and retention;
  `npm run test:e2e` (Playwright) exercises the app in a browser. Run before every deploy.
- Crash reports (`clientErrors:recent`) reviewed regularly (at least monthly).
- Stripe and Clerk webhook delivery failures reviewed in their dashboards.

## 7. Incident response

1. Contain: rotate the affected secret/key, disable the affected function or deploy a fix.
2. Assess what data and which families were affected.
3. Notify affected account holders without unreasonable delay, and regulators where required
   (state breach laws; the FTC for children's data where applicable).
4. Record what happened and update this program.

## 8. Annual evaluation (312.8(b)(5))

Each year (and after any incident or major change): redo section 3, check every provider in
section 5 is still needed and still bound by written terms, confirm the retention jobs ran
(Convex dashboard → Schedules/Logs), re-run both test suites, and update this document's dates.

| Date | Reviewer | Notes |
|---|---|---|
| 2026-10-25 | Program adopted | Initial assessment above |
