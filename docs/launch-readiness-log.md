# Launch readiness log

Started 2026-10-22. Every item from the "is it ready for customers?" review, with its status.
Status values: TODO, IN PROGRESS, DONE (verified how), NEEDS OWNER (what is needed from the owner).

## Learning and gameplay

| # | Item | Status | Notes / verification |
|---|------|--------|----------------------|
| L1 | Grown-ups can choose a reader's starting level and change it later | DONE (local) | `profiles.setLevel` + `startingLevel` on create (server checks plan). Picker in Settings (new "Reading level" section) and in the first "New reader" form. Browser: saved 1A→1D, status message shown, count reset to 0. |
| L1b | Settings only ever edited the FIRST reader (no way to pick another) | DONE (local) | Found while building L1. Added "Change settings for" reader picker when there are 2+ readers. |
| L2 | Review words from earlier levels mixed into every board | DONE (local) | 6 per board: from the 2 previous sublevels plus 3 older ones that rotate every 3 boards (`wordLists.getReviewPool`). Unit tests pass. Browser: 1D board had exactly 6 words from 1A–1C. |
| L3 | Missed words come back on later boards until read first try | DONE (local) | Up to 4 per board (`wordBank.getPracticeWords`). 3+ misses (hint shown) or a skip marks a word for practice; reading it first try clears it. Browser: missed "glob" 3 times → listed on Practice page → on 3/3 new boards → read first try on a full board → Practice page "All caught up". |
| L4 | Level-up bar raised from 70% to 80% first-try accuracy | DONE | `LEVEL_UP_ACCURACY = 0.8`; unit tests cover 0.75 (no) / 0.8 (yes). Landing, settings, help copy updated. |

## Grown-up experience

| # | Item | Status | Notes / verification |
|---|------|--------|----------------------|
| G1 | Teacher/parent dashboard welcome tour + "?" metric explainers | DONE (local) | driver.js 1.8.0, loaded only when the tour starts. Browser: auto-starts once, 8 steps, focus on Next each step, "Step N of 8" announced, focus returns to "How this works"; no repeat after reload; Escape closes; works at 390px. "Avg accuracy" green threshold now 80%. |
| G2 | Help / FAQ page | DONE (local) | `/help`, public, ~40 questions in 6 sections. axe clean in 5 themes at 390px. Linked from landing footer, legal pages, and a Help icon in the app menu. |
| G3 | Kids' tutorial modal visually verified | DONE (local) | Viewed all 5 steps at 390px. Improved: every step is now read aloud (Jessica voice, 5 new MP3s in public/audio/tutorial, wording checked by Whisper) with a "Hear it" replay button, because most players can't read yet. "Press the space bar" replaced (iPads have none). |
| G4 | Past-due payment warning shown in the app | DONE (local) | Billing page shows an alert + "Update payment method" when Stripe status is past_due/unpaid; raw status words replaced with plain labels. |

## Devices, speed, accessibility

| # | Item | Status | Notes / verification |
|---|------|--------|----------------------|
| D1 | Word audio works on iPhone/iPad | DONE (local) | CONFIRMED BUG on live site with iOS 18.4 Safari: word MP3 rejected `NotAllowedError`, robot-voice fallback. Fix: one shared audio element unlocked on first touch. Same test on local build: MP3 played OK, no fallback. |
| D2 | Test on iOS simulator Safari | PARTIAL | iOS 18.4 simulator + safaridriver works for page checks and audio policy. Its synthetic taps never fire `click` (even on a plain test button), so full tap-through on a real iPhone/iPad is still worth doing once. |
| D5 | Animations follow the device's "reduce motion" setting | DONE (local) | Framer Motion wrapped in `MotionConfig reducedMotion="user"` (CSS animations already respected it). |
| D6 | Phone taps: no double-tap zoom delay, long-press doesn't select button text | DONE (local) | `touch-action: manipulation` + `user-select: none` on buttons. |
| D3 | Speed audit (Lighthouse) and fixes | DONE (local), re-measure on live after deploy | Live baseline (mobile): Performance 82, Accessibility 100, Best practices 100, SEO 100; LCP 4.6s caused by a 1.9s server response because the landing page was rendered per request. Removed the redundant session check (middleware already redirects signed-in users) → landing is now static (CDN). |
| D4 | Accessibility re-scan of every page; keyboard pass | DONE (local) | axe WCAG 2.2 A/AA on 13 pages × Ocean + Classic at 390px: all clean after fixing one issue (Progress page's sideways-scrolling session table wasn't keyboard-reachable → now a focusable labelled region). No sideways page scroll anywhere. |

## Operations

| # | Item | Status | Notes / verification |
|---|------|--------|----------------------|
| O1 | Error reporting | DONE (local) | `client_errors` table; signed-in browsers report uncaught errors + ErrorBoundary crashes (message, path, browser only; 5/min/user cap). Read with `clientErrors:recent` + maintenance key. |
| O2 | Usage analytics (privacy-safe, no child data) | DONE (local) | Vercel Web Analytics + Speed Insights (both were already enabled on the Vercel project but never added to the site). Cookieless; query strings stripped (sign-in links carry one-time tokens). Privacy policy updated (Oct 22, 2026). |
| O3 | Emails: welcome, payment failed | TODO | |
| O4 | Sign-in emails say "Roll & Read", not "My Application" | DONE (already) | Checked Clerk's live environment endpoint for prod and dev: application name is "Roll & Read". |
| O5 | Children's privacy (COPPA) policy reviewed by a lawyer | TODO | |
| O6 | Project notes (CLAUDE.md) brought up to date | TODO | |
