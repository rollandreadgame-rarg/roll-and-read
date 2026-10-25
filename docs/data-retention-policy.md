# Data Retention Policy — Roll & Read

Operator: NMT Direct INC, doing business as Roll & Read. Required by the COPPA Rule,
16 CFR 312.10 (as amended 2025). Adopted October 25, 2026. The public version is section 8 of
the Privacy Policy (`app/privacy/page.tsx`); keep both in step.

| Information | Why we collect it | Why we keep it | When it is deleted | How |
|---|---|---|---|---|
| Reader first name/nickname, avatar, level, theme, word setting | To run the game for that child | So the child can keep playing at their level | Immediately when the grown-up deletes the reader or the account; automatically after **730 days (2 years)** with no play (counted from creation if never played), unless the account is on an active paid plan (active, trialing, past due, or comped) | Settings → delete reader (`profiles.remove`); Clerk account deletion → `dataLifecycle.deleteAccount`; daily `dataLifecycle.purgeInactiveReaders` (`convex/crons.ts`) |
| Game progress: word bank, practice words, stickers, sessions, streaks, coins | To teach at the right level, revisit missed words, reward progress, and show grown-ups progress | Progress builds over months of play | With the reader (same rules as above) | Same; `deleteProfileData` removes `word_bank`, `profile_stickers`, `game_sessions` and the profile |
| Board in progress, sticker picks waiting | So a reload doesn't lose the child's place or rewards | Until the board is finished or the pick is claimed | Board: when finished or after 12 hours (browser); picks: when claimed, or with the reader | `lib/game/savedBoard.ts`; `profiles.pendingRewards` |
| Crash reports | To find and fix bugs | Long enough to spot patterns | After **90 days** | Daily `dataLifecycle.purgeOldErrorReports`; also deleted with the account |
| Request logs (IP address, browser) | To deliver the site and protect it | Security and troubleshooting | By the hosting providers after short periods (days; never more than 30) | Provider log retention (Vercel, Cloudflare, Convex) |
| Grown-up account (email, plan, PIN hash) | To run the account and subscription | While the account exists | When the account is deleted | Clerk deletion → webhook → `dataLifecycle.deleteAccount` |
| Billing records | Payment and tax law | As required by tax/accounting law | Per Stripe's retention | Stripe (no child data) |

Deletion uses the providers' delete operations; deleted records may persist in the providers'
encrypted backups for a short period and are not restored or used.

Review this policy with the annual security review (`docs/information-security-program.md`).
