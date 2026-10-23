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
| D2 | Test on iOS simulator Safari | PARTIAL | iOS 18.4 simulator + safaridriver works for page checks and audio policy. Its synthetic taps never fire `click` (even on a plain test button), so full tap-through on a real iPhone/iPad is still worth doing once. |
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
| O3 | Emails: welcome, payment failed | NEEDS OWNER | Code DONE and live but dormant (2026-10-23, `lib/email/`): welcome email on sign-up, payment-failed email on an invoice's first failed attempt, idempotent against webhook retries, 7 unit tests, axe-clean HTML. Switches on when `RESEND_API_KEY` is set on Vercel (then verify the rollandreadgame.com sending domain in Resend; DNS is on Namecheap and can be added by API). Stripe built-in emails: owner said yes on 2026-10-23, but no connected Brave profile is signed in to Stripe (admin@nmtdirect.com) and signing in needs the owner. |
| O7 | support@rollandreadgame.com receives mail | NEEDS OWNER | Found 2026-10-23: the domain uses Namecheap email forwarding, but NO forward exists, so mail to the address on Help, Privacy and Terms goes nowhere. Fix is one Namecheap API call; needs the owner's OK and which inbox to forward to. |
| O4 | Sign-in emails say "Roll & Read", not "My Application" | DONE (already) | Checked Clerk's live environment endpoint for prod and dev: application name is "Roll & Read". |
| O5 | Children's privacy (COPPA) policy reviewed by a lawyer | NEEDS OWNER | Privacy policy covers COPPA, adult-only accounts and the school exception; updated today for analytics and error reports. Needs a lawyer's read before marketing to schools. |
| O6 | Project notes (CLAUDE.md) brought up to date | DONE | Board generation, practice rules, 80% rule, iOS audio rule, ops pointers. (CLAUDE.md is gitignored.) |

## Extra fixes found along the way

| # | Item | Status | Notes / verification |
|---|------|--------|----------------------|
| X1 | Unclaimed sticker picks were lost if the page reloaded before picking | DONE | Saved per device (`rr:pendingRewards:<profileId>`); browser: finished a board, reloaded, pick screen returned, sticker granted, saved copy cleared, board kept. |
| X2 | Phone menu wrapped to three rows after adding Help | DONE | Wordmark hidden (still read by screen readers) below 640px; two rows at 360/390/430px. |
| X3 | Help page facts | DONE | Teacher dashboard isn't actually limited to the Classroom plan in code (copy says it's part of Classroom). Left as is: generous, not broken. |

## Live verification (2026-10-23, deploy f5fac3a)

- Keyboard-only on rollandreadgame.com with the QA account: picking a reader lands focus on "Roll the dice"; Space rolls, focus stays on the button (now "Hear the word again"); screen readers hear "Row 2. Listen, then tap the word."; reader button reads "Sam, Level 1A, 280 coins".
- Email code deployed dormant (no RESEND_API_KEY on Vercel yet).

## Live verification (after deploy 29a742c, 2026-10-22)

- Convex prod (giddy-lapwing-388) deployed first; new indexes built.
- Vercel deployment dpl_9vBCcczzfA1jsNkSHgm5hCiVYqdY READY.
- iPhone (iOS 18.4 simulator Safari) on rollandreadgame.com: word MP3 plays (was NotAllowedError this morning).
- Lighthouse mobile, live home page: Performance 82 → 91–93; Accessibility, Best practices, SEO 100.
- Signed-in QA account on live: Settings "Reading level" present, teacher tour auto-starts, /help loads, 30-card board, analytics scripts load, no page errors.
