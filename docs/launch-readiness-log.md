# Launch readiness log

Started 2026-10-22. Every item from the "is it ready for customers?" review, with its status.
Status values: TODO, IN PROGRESS, DONE (verified how), NEEDS OWNER (what is needed from the owner).

## Learning and gameplay

| # | Item | Status | Notes / verification |
|---|------|--------|----------------------|
| L1 | Grown-ups can choose a reader's starting level and change it later | DONE | `profiles.setLevel` + `startingLevel` on create (server checks plan). Picker in Settings (new "Reading level" section) and in the first "New reader" form. Browser: saved 1A→1D, status message shown, count reset to 0. |
| L1b | Settings only ever edited the FIRST reader (no way to pick another) | DONE | Found while building L1. Added "Change settings for" reader picker when there are 2+ readers. |
| L2 | Review words from earlier levels mixed into every board | DONE | 6 per board: from the 2 previous sublevels plus 3 older ones that rotate every 3 boards (`wordLists.getReviewPool`). Unit tests pass. Browser: 1D board had exactly 6 words from 1A–1C. |
| L3 | Missed words come back on later boards until read first try | DONE | Up to 4 per board (`wordBank.getPracticeWords`). 3+ misses (hint shown) or a skip marks a word for practice; reading it first try clears it. Browser: missed "glob" 3 times → listed on Practice page → on 3/3 new boards → read first try on a full board → Practice page "All caught up". |
| L4 | Level-up bar raised from 70% to 80% first-try accuracy | DONE | `LEVEL_UP_ACCURACY = 0.8`; unit tests cover 0.75 (no) / 0.8 (yes). Landing, settings, help copy updated. |

## Grown-up experience

| # | Item | Status | Notes / verification |
|---|------|--------|----------------------|
| G1 | Teacher/parent dashboard welcome tour + "?" metric explainers | DONE | driver.js 1.8.0, loaded only when the tour starts. Browser: auto-starts once, 8 steps, focus on Next each step, "Step N of 8" announced, focus returns to "How this works"; no repeat after reload; Escape closes; works at 390px. "Avg accuracy" green threshold now 80%. |
| G2 | Help / FAQ page | DONE | `/help`, public, ~40 questions in 6 sections. axe clean in 5 themes at 390px. Linked from landing footer, legal pages, and a Help icon in the app menu. |
| G3 | Kids' tutorial modal visually verified | DONE | Viewed all 5 steps at 390px. Improved: every step is now read aloud (Jessica voice, 5 new MP3s in public/audio/tutorial, wording checked by Whisper) with a "Hear it" replay button, because most players can't read yet. "Press the space bar" replaced (iPads have none). |
| G4 | Past-due payment warning shown in the app | DONE | Billing page shows an alert + "Update payment method" when Stripe status is past_due/unpaid; raw status words replaced with plain labels. |

## Devices, speed, accessibility

| # | Item | Status | Notes / verification |
|---|------|--------|----------------------|
| D1 | Word audio works on iPhone/iPad | DONE | CONFIRMED BUG on live site with iOS 18.4 Safari: word MP3 rejected `NotAllowedError`, robot-voice fallback. Fix: one shared audio element unlocked on first touch. Same test on local build: MP3 played OK, no fallback. |
| D2 | iPad / iPhone | DONE on simulators (2026-10-25), real device optional | iPad Air 11 sim (iOS 18.4): layout both orientations, MP3 words, coins, reload all pass. Fixed: focus ring on first card after taps (looked like a hint), "Press space" tips on iPad, board long-press selection / double-tap zoom, invalid silent unlock clip, small level picker. Only a real device can check finger taps, Howler sound effects (Web Audio) and the silent switch. |
| D5 | Animations follow the device's "reduce motion" setting | DONE | Framer Motion wrapped in `MotionConfig reducedMotion="user"` (CSS animations already respected it). |
| D6 | Phone taps: no double-tap zoom delay, long-press doesn't select button text | DONE | `touch-action: manipulation` + `user-select: none` on buttons. |
| D3 | Speed audit (Lighthouse) and fixes | DONE | 2026-10-23 re-run: Performance 96, LCP 2.6s, TBT 70ms. Remaining weight is Clerk's sign-in script (~350 KB) on the landing page; removing it means moving the auth provider out of the root layout, judged not worth the risk. Live baseline (mobile): Performance 82, Accessibility 100, Best practices 100, SEO 100; LCP 4.6s caused by a 1.9s server response because the landing page was rendered per request. Removed the redundant session check (middleware already redirects signed-in users) → landing is now static (CDN). |
| D7 | Keyboard and screen-reader play-through of a full row and a Practice round | DONE (2026-10-23) | Found: focus fell to the page top after picking a reader, while the die rolled, after every correct card, and on every Practice answer; nothing told screen readers which row was rolled or whether a tap was right (the only live text was hidden on phones). Fixed: focus stays on the Roll / next card / results heading; a status line says "Row 4. Listen, then tap the word.", "Yes! slug.", "Not that one. Listen again.", "Hint: the word is plug."; coins read as "coins". Verified on a local build with keyboard only; mouse users get no focus outline; axe clean on Play and Practice at 390px. |
| D4 | Accessibility re-scan of every page; keyboard pass | DONE | axe WCAG 2.2 A/AA on 13 pages × Ocean + Classic at 390px: all clean after fixing one issue (Progress page's sideways-scrolling session table wasn't keyboard-reachable → now a focusable labelled region). No sideways page scroll anywhere. |

## Operations

| # | Item | Status | Notes / verification |
|---|------|--------|----------------------|
| O1 | Error reporting | DONE | `client_errors` table; signed-in browsers report uncaught errors + ErrorBoundary crashes (message, path, browser only; 5/min/user cap). Read with `clientErrors:recent` + maintenance key. 2026-10-23: zero real reports since launch; a test error thrown on the live site with the QA account reached the prod table in seconds (row "qa-probe: error reporter check 2026-10-23"). |
| O2 | Usage analytics (privacy-safe, no child data) | DONE | Vercel Web Analytics + Speed Insights (both were already enabled on the Vercel project but never added to the site). Cookieless; query strings stripped (sign-in links carry one-time tokens). Privacy policy updated (Oct 22, 2026). |
| O3 | Emails: welcome, payment failed, receipts | DONE (Stripe) / welcome NEEDS OWNER | 2026-10-25, Stripe account acct_…jJoT (the Roll & Read one; the login also has a second "NMT Direct INC" account for 9x12 Postcard ads): turned on receipts for successful payments and refunds, and Billing emails for expiring cards, failed card payments and failed bank debits; verified after reload. The site's own payment-failed email was removed (Stripe sends it). Welcome email code is live but dormant until `RESEND_API_KEY` is set on Vercel. 2026-10-25 (owner OK): public business name is now "Roll & Read" (legal name stays NMT Direct INC; statement descriptor "ROLL AND READ GAME"), website rollandreadgame.com, support/privacy/terms links set to /help, /privacy, /terms; card updates from Stripe emails go to Stripe's hosted page. Support email in Stripe left blank until the support@ forward exists. Support phone hidden on receipts (owner OK); Stripe has no toggle for the support address, which still shows (owner home address) until replaced with a business mailing address. |
| O7 | support@rollandreadgame.com receives mail | DONE (2026-10-25) | Namecheap forward support@ → rollandreadgame@gmail.com (owner confirmed the address), set by API and read back; MX = Namecheap eforward, SPF includes it. Also set as the support email in Stripe. A direct test send from this Mac failed (ISP blocks port 25); the owner's own test email is the delivery check. Later: Google Workspace mailbox if replies should come from support@. |
| O4 | Sign-in emails say "Roll & Read", not "My Application" | DONE (already) | Checked Clerk's live environment endpoint for prod and dev: application name is "Roll & Read". |
| O5 | Children's privacy (COPPA) | DONE (2026-10-25), owner decision pending | No lawyer available, so reviewed against the rule text (16 CFR 312, 2025 amendments, compliance date April 22, 2026). Rewrote the Privacy Policy to include every §312.4(d) element, the §312.10 written retention policy, §312.6 review/delete rights, separate consent for any third-party sharing, school use. Enforced it in code: daily deletion of readers unplayed 2 years (non-paying) and crash reports after 90 days; Clerk account deletion cancels billing and deletes all readers (webhook subscribed to user.deleted, verified via Svix API); OpenDyslexic self-hosted; first-name-or-nickname prompt + privacy link where readers are added. Written security program + retention policy in docs/. **Gap:** §312.4(d)(1) requires the operator's mailing address and phone number in the policy; owner to choose (P.O. box / virtual mailbox, Google Voice) and set `OPERATOR` in lib/contact.ts. |
| O6 | Project notes (CLAUDE.md) brought up to date | DONE | Board generation, practice rules, 80% rule, iOS audio rule, ops pointers. (CLAUDE.md is gitignored.) |

## Extra fixes found along the way

| # | Item | Status | Notes / verification |
|---|------|--------|----------------------|
| X1 | Unclaimed sticker picks were lost if the page reloaded before picking | DONE | Saved per device (`rr:pendingRewards:<profileId>`); browser: finished a board, reloaded, pick screen returned, sticker granted, saved copy cleared, board kept. |
| X2 | Phone menu wrapped to three rows after adding Help | DONE | Wordmark hidden (still read by screen readers) below 640px; two rows at 360/390/430px. |
| X3 | Help page facts | DONE | Teacher dashboard isn't actually limited to the Classroom plan in code (copy says it's part of Classroom). Left as is: generous, not broken. |

## Automated tests (2026-10-23)

`npm test` (vitest): backend functions against an in-memory Convex (convex-test), API routes, middleware and lib code. `npm run test:e2e` (Playwright): the real app on the LOCAL dev server with the dev account (never production; global setup refuses non-dev keys). Run e2e one test at a time; a full run takes about 9 minutes and leaves a few coins/stickers on the dev reader.

| # | Bug found by the tests | Status | Fix |
|---|------|--------|-----|
| T1 | `spendCoins` accepted negative amounts (free coins) | FIXED | Rejects negative / non-finite. |
| T2 | `wordBank.addWord` trusted the browser's word, level and coin value | FIXED | Read from the `word_lists` row. |
| T3 | Practice list capped before filtering (could return too few words) | FIXED | Cap after filtering. |
| T4 | `users.updateEmailFromClerk` callable by anyone | FIXED | Needs the webhook sync secret. |
| T5 | `canAccessLevel` answered for any profile | FIXED | Owner only. |
| T6 | Shop charged coins when no stickers were left | FIXED | Throws `NO_STICKERS_AVAILABLE` before charging. |
| T7 | `grantSticker` accepted unknown stickers / duplicates | FIXED | Rejects both. |
| T8 | A late Stripe event for an old subscription could downgrade a paid account | FIXED | Ignored while the stored subscription is paid. |
| T9 | Game session stats accepted impossible numbers | FIXED | Clamped (non-negative, correct ≤ attempted, first-try ≤ correct). |
| T10 | Parent PIN lockout was a flat 1 minute forever | FIXED | Doubles each lock, up to an hour; message says how long. |
| T11 | Exactly 80% accuracy could miss the level-up (floating point) | FIXED | Epsilon compare. |
| T12 | Crashes when the browser has no speech synthesis | FIXED | Guarded. |
| T13 | E2E bypass could be switched on in a production build | FIXED | Also requires NODE_ENV ≠ production. |
| T14 | Reload or leaving /play threw away a half-played board | FIXED | Board, active row and session saved per reader on the device (`rr:board:<profileId>`, 12h, same level/word mode). Reader taps "Hear the word again" (iPad audio needs a tap). |
| T15 | Settings showed the device's theme, not the reader's saved theme | FIXED | Settings applies and highlights the selected reader's theme. |
| T16 | Teacher tour closed mid-animation dropped focus to the page top | FIXED | Close handled in `onDestroyStarted` (driver.js skips `onDestroyed` mid-transition). |

| T17 | Parent PIN reset had no server proof (any signed-in browser could replace the PIN) | FIXED (2026-10-25) | Reset goes through `/api/parent-pin/reset`, which requires Clerk reverification ("strict": password or emailed code within 10 min; the browser's `useReverification` shows Clerk's prompt). Convex `resetParentPin` only accepts the sync secret. |
| T18 | Coins, sticker picks and level-ups were decided in the browser | FIXED (2026-10-25) | Server pays coins in `wordBank.addWord` (curriculum value, word within reach, 400ms human-pace floor, 30 per board) and `markPracticed` (3 for a practice word, once). `completedBoard` needs 28+ counted answers, computes accuracy, milestones and level-up itself and stores the picks (`pendingRewards`); `awardStickerFromCategory` spends one (old profiles get 3 legacy claims); `advanceLevel` re-checks the level-up rule. `awardCoins` is a no-op for old browsers; `grantSticker`/`awardMilestoneSticker` are internal. Picks now follow the reader across devices. |
| T19 | Browser fallback `createUser` stored the email the browser sent | FIXED (2026-10-25) | Email comes from the verified Clerk token (or blank until the webhook fills it); the webhook's email wins. |
| T20 | Reader names had no length limit | FIXED (2026-10-23) | 1–30 characters, trimmed; avatar and theme checked too. |
| T21 | Old roll-and-read.vercel.app address (still in Stripe settings) can't sign in | FIXED (2026-10-25) | Redirects to rollandreadgame.com (API routes excluded so webhooks still work). |

Still open:
- Stripe checkout can't be tested locally: the Stripe test key in `.env.local` has expired (owner would need to create a new sandbox key).
- What a child taps is still reported by the browser (which word was right, how many misses). Fully preventing a scripted "perfect" board needs the server to choose and check each word; not worth it for a kids' game whose rewards are stickers and coins.

## Live verification (2026-10-23, deploy f5fac3a)

- Keyboard-only on rollandreadgame.com with the QA account: picking a reader lands focus on "Roll the dice"; Space rolls, focus stays on the button (now "Hear the word again"); screen readers hear "Row 2. Listen, then tap the word."; reader button reads "Sam, Level 1A, 280 coins".
- Email code deployed dormant (no RESEND_API_KEY on Vercel yet).

## Live verification (after deploy 29a742c, 2026-10-22)

- Convex prod (giddy-lapwing-388) deployed first; new indexes built.
- Vercel deployment dpl_9vBCcczzfA1jsNkSHgm5hCiVYqdY READY.
- iPhone (iOS 18.4 simulator Safari) on rollandreadgame.com: word MP3 plays (was NotAllowedError this morning).
- Lighthouse mobile, live home page: Performance 82 → 91–93; Accessibility, Best practices, SEO 100.
- Signed-in QA account on live: Settings "Reading level" present, teacher tour auto-starts, /help loads, 30-card board, analytics scripts load, no page errors.
