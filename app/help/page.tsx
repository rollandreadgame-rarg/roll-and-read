import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import LegalPage from "@/components/LegalPage";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { LEVEL_SEQUENCE, LEVEL_SKILLS } from "@/lib/levels";
import { PROFILE_LIMITS } from "@/convex/subscriptionConfig";

export const metadata: Metadata = {
  title: "Help and FAQ — Roll & Read",
  description:
    "Answers for parents and teachers: setting up readers, how a turn works, levels and progress, accessibility settings, the grown-up PIN, privacy and billing.",
};

// Prices mirror app/(app)/billing/page.tsx and the pricing section of
// app/page.tsx. Profile limits come straight from the plan rules.
const readers = (n: number) => `${n} ${n === 1 ? "reader" : "readers"}`;
const PLANS = [
  { name: "Free", price: "$0", summary: `${readers(PROFILE_LIMITS.free)}, Level 1 (1A to 1H), Ocean adventure and Classic classroom themes` },
  { name: "Individual", price: "$7.99 a month", summary: `${readers(PROFILE_LIMITS.individual)}, all 25 sublevels, all 5 themes` },
  { name: "Family", price: "$14.99 a month", summary: `up to ${readers(PROFILE_LIMITS.family)}, all 25 sublevels, all 5 themes` },
  { name: "Classroom", price: "$49 a month", summary: `up to ${readers(PROFILE_LIMITS.classroom)}, all 25 sublevels, all 5 themes and the Teacher dashboard` },
];

// Coins per word, by level (coinValue in convex/wordData).
const COINS_BY_LEVEL = [5, 8, 12, 18, 25];

const SECTIONS = [
  { id: "getting-started", title: "Getting started" },
  { id: "playing", title: "Playing" },
  { id: "progress-and-levels", title: "Progress and levels" },
  { id: "accessibility", title: "Accessibility" },
  { id: "grown-ups-and-privacy", title: "Grown-ups and privacy" },
  { id: "billing", title: "Billing" },
  { id: "contact", title: "Still need help?" },
] as const;

const LEVEL_GROUPS = [1, 2, 3, 4, 5].map((n) => ({
  level: n,
  sublevels: LEVEL_SEQUENCE.filter((s) => s.startsWith(String(n))),
}));

function Section({ id, children }: { id: (typeof SECTIONS)[number]["id"]; children: ReactNode }) {
  const title = SECTIONS.find((s) => s.id === id)!.title;
  return (
    <section aria-labelledby={id} className="help-section">
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

export default function HelpPage() {
  const email = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

  return (
    <LegalPage title="Help and FAQ" lastUpdated="October 22, 2026">
      <p>
        Answers for parents and teachers. If you can’t find what you need, email us at {email}.
      </p>

      <nav aria-labelledby="help-topics" className="help-toc panel">
        <h2 id="help-topics">On this page</h2>
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="getting-started">
        <h3>What is Roll &amp; Read?</h3>
        <p>
          A phonics game for early readers. Your child rolls a die, hears a word and taps the card
          that shows it. The words follow a structured-literacy order, from short vowels to silent
          letters, in 25 small steps called sublevels. Every word has its own clear recording.
        </p>

        <h3>Who sets up the account?</h3>
        <p>
          A grown-up: a parent, guardian or teacher. Children don’t sign up, don’t need an email
          address and never see payment screens. You create a reader profile for each child, and
          they just play.
        </p>

        <h3>How do I get started?</h3>
        <p>
          <Link href="/sign-up">Sign up</Link> with your email. The free plan needs no card. Then add a
          reader in Settings with a first name or nickname and an avatar. Family and Classroom plans
          let you add more readers.
        </p>

        <h3>Which level should my child start at?</h3>
        <p>
          Most children start at 1A, which teaches short a and i. If your child already reads
          simple short-vowel words with ease, you can place them higher in Settings. You can see what
          every sublevel teaches under <a href="#progress-and-levels">Progress and levels</a>.
        </p>

        <h3>What do we need to play?</h3>
        <p>
          A web browser. There’s nothing to install. Keep the sound on, because the game reads every
          word aloud. Headphones help in a busy room.
        </p>

        <h3>Can I use Roll &amp; Read with a class?</h3>
        <p>
          Yes. The Classroom plan holds up to {PROFILE_LIMITS.classroom} student profiles and includes
          the Teacher dashboard, where you can see every reader’s progress and print a report.
        </p>
      </Section>

      <Section id="playing">
        <h3>How does a turn work?</h3>
        <p>
          Your child taps Roll. The row with that many dots lights up, and they hear a word from it.
          They tap the card with that word. A right answer earns coins and the word goes into their
          Word Bank. To hear the word again, they can tap “Hear it again” or press the space bar.
        </p>
        <p>
          A board has 6 rows of 5 words. When five rows are done, the last row starts on its own.
          Clearing all six rows finishes the board.
        </p>

        <h3>What happens when my child taps the wrong word?</h3>
        <ul>
          <li>The word plays again, a little slower.</li>
          <li>After 3 misses, the right card is highlighted for a moment.</li>
          <li>After 5 misses, the right card stays highlighted.</li>
          <li>After 7 misses, the game moves on and saves the word for practice.</li>
        </ul>

        <h3>What are silly words?</h3>
        <p>
          Made-up words like “zib”. Because a child can’t know them from memory, they have to sound
          them out, which is a good check of real decoding. Silly words sit on lavender cards with a
          little alien badge, and the game explains them the first time one appears.
        </p>

        <h3>Can I choose real words or silly words?</h3>
        <p>
          Yes. In Settings, under Word mode, pick Real words, Silly words, or Mixed. Mixed is the
          default and the one we recommend. Each reader has their own word mode.
        </p>

        <h3>How do coins and stickers work?</h3>
        <p>
          Every word read correctly earns coins: {COINS_BY_LEVEL[0]} at Level 1, {COINS_BY_LEVEL[1]} at
          Level 2, {COINS_BY_LEVEL[2]} at Level 3, {COINS_BY_LEVEL[3]} at Level 4 and{" "}
          {COINS_BY_LEVEL[4]} at Level 5.
        </p>
        <p>
          There are nearly 600 stickers in 10 categories. Your child earns a sticker for their first
          board, every fifth board, a perfect board, a 3, 7 or 30 day streak, and moving up a level.
          They pick a category and reveal what they got. They can also spend coins in the Shop on
          sticker packs: 50 coins for 1 sticker, 150 for 3 from one category, or 500 for 5 with better
          odds of rare ones. Their collection lives in the Sticker book.
        </p>

        <h3>What is the Word Bank?</h3>
        <p>
          Every word your child reads correctly is saved there. You can filter it by level and by
          real or silly words, or search for a word.
        </p>

        <h3>What is the Practice page?</h3>
        <p>
          It holds the words your child found hard. Words appear one at a time and are read aloud,
          with a button to hear them again. If your child reads it, tap “Got it” to earn 3 coins and
          take it off the list. If not, tap “Still hard” and it stays for next time. When nothing is
          left, the page says you’re all caught up.
        </p>
      </Section>

      <Section id="progress-and-levels">
        <h3>What does each sublevel teach?</h3>
        <p>
          There are 5 levels split into 25 sublevels. Each sublevel focuses on one group of
          spelling patterns.
        </p>
        <table className="help-table">
          <caption>The 25 sublevels and the skill each one teaches</caption>
          <thead>
            <tr>
              <th scope="col">Sublevel</th>
              <th scope="col">What it teaches</th>
            </tr>
          </thead>
          {LEVEL_GROUPS.map(({ level, sublevels }) => (
            <tbody key={level}>
              <tr>
                <th scope="rowgroup" colSpan={2} className="help-table-group">
                  Level {level}
                  {level === 1 ? " (included in the free plan)" : ""}
                </th>
              </tr>
              {sublevels.map((s) => (
                <tr key={s}>
                  <th scope="row">{s}</th>
                  <td>{LEVEL_SKILLS[s]}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>

        <h3>How does my child move up a level?</h3>
        <p>
          After at least 7 boards at a sublevel, the game looks at the last 3 boards. If, on
          average, your child read 80% or more of the words right on the first try, they move up to
          the next sublevel and earn a sticker.
        </p>

        <h3>Why are there words from other levels on the board?</h3>
        <p>
          Two reasons. Each board mixes in some words from earlier levels, so skills stay fresh. And
          after 4 boards at a sublevel, a reader who is doing well starts to see some words from the
          next sublevel, so the step up feels smaller.
        </p>

        <h3>What happens to words my child missed?</h3>
        <p>
          They come back on later boards until your child reads them on the first try. You can also
          go over them on the Practice page.
        </p>

        <h3>Can I change my child’s level?</h3>
        <p>
          Yes. In Settings, which sits behind the grown-up PIN, you can move a reader up or down to
          any level your plan includes. Their progress toward the next level then starts again from
          zero. The free plan includes Level 1 only.
        </p>

        <h3>Where can I see how my child is doing?</h3>
        <p>
          The Progress page shows boards cleared, current level, day streak and coins, plus accuracy
          over recent sessions, a map of the levels, a list of recent sessions and the words to
          practise. A day streak counts the days in a row on which your child finished at least one
          board.
        </p>

        <h3>What is the Teacher dashboard?</h3>
        <p>
          One page that shows every reader on your account: how many boards they’ve cleared, average
          accuracy, level progress, an accuracy trend, recent sessions and the words each reader
          needs to practise. There’s a button to print a report. It’s part of the Classroom plan and
          sits behind the grown-up PIN.
        </p>
      </Section>

      <Section id="accessibility">
        <h3>What font are the words in?</h3>
        <p>
          Words are printed in Andika, which uses the single-storey a and g that children learn to
          write. If OpenDyslexic suits your child better, choose it in Settings under Font.
        </p>

        <h3>Can I make the words bigger?</h3>
        <p>
          Yes. The Word size slider in Settings goes from 20 to 32 pixels, with a preview as you move
          it.
        </p>

        <h3>Can I change the colours?</h3>
        <p>
          There are 5 themes: Ocean adventure, Space explorer and Enchanted forest are dark; Candy
          land and Classic classroom are light. The free plan includes Ocean adventure and Classic
          classroom, and paid plans include all five. Each reader keeps their own theme.
        </p>

        <h3>Can I turn the sound down or off?</h3>
        <p>
          Yes. Settings has a Volume slider and a Mute all sound switch. Muting also silences the
          words, and the game depends on hearing them, so it’s best for quiet moments away from play.
        </p>

        <h3>Do these settings follow my child to another device?</h3>
        <p>
          The theme is saved with each reader, so it follows them. Font, word size and sound are
          saved in the browser you set them in, so set them again on a new device.
        </p>
      </Section>

      <Section id="grown-ups-and-privacy">
        <h3>What is the grown-up PIN?</h3>
        <p>
          An optional 4-digit PIN that locks Settings, Billing and the Teacher dashboard, so children
          can’t change things by accident. They can still play and use every other page. Set it up in
          Settings under Grown-up PIN, where you can also change or remove it.
        </p>

        <h3>How long does it stay unlocked?</h3>
        <p>
          It locks again after 3 minutes without activity. You can lock it straight away with the
          lock button at the top of the screen.
        </p>

        <h3>I forgot the PIN. What do I do?</h3>
        <p>
          On the PIN screen, choose “Forgot PIN?”. We’ll email a code to the address on your account.
          Enter the code, then choose a new PIN.
        </p>

        <h3>What if someone keeps guessing?</h3>
        <p>After 5 wrong tries, the PIN screen asks you to wait a minute. Each wrong try after that doubles the wait, up to an hour. A correct PIN, or choosing “Forgot PIN?”, clears it.</p>

        <h3>What do you collect about my child?</h3>
        <p>
          Only what you enter, a first name or nickname and an avatar, plus their progress in the
          game. There are no ads, we don’t sell or rent personal information, and we don’t use
          advertising trackers. The <Link href="/privacy">privacy policy</Link> has the details.
        </p>

        <h3>Can teachers use it with students?</h3>
        <p>
          Yes. Teachers can agree to its use for educational purposes on parents’ behalf, and
          schools look after their own notices to parents. See the{" "}
          <Link href="/privacy">privacy policy</Link> for more.
        </p>

        <h3>How do I delete a reader or my account?</h3>
        <p>
          To delete a reader, open Settings and use the delete button next to their name. This removes their
          progress, word bank, stickers and session history, and it can’t be undone. To delete your
          whole account and its data, email {email}.
        </p>
      </Section>

      <Section id="billing">
        <h3>What does each plan cost?</h3>
        <ul>
          {PLANS.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong>, {p.price}: {p.summary}.
            </li>
          ))}
        </ul>
        <p>The free plan stays free, with no card needed.</p>

        <h3>What happens when a free reader finishes Level 1?</h3>
        <p>
          Level 2 and above need a paid plan. The game lets you know when your reader is ready, and
          you can upgrade then.
        </p>

        <h3>How do I upgrade?</h3>
        <p>
          Open Billing (behind the grown-up PIN) and choose a plan. Payment happens on Stripe’s secure
          checkout page, where you can also enter a promotion code if you have one.
        </p>

        <h3>How do I switch plans or cancel?</h3>
        <p>
          On the Billing page, choose Manage subscription. This opens Stripe’s billing portal, where
          you can change or cancel your plan. If you cancel, your plan keeps working until the end of
          the period you’ve paid for. Payments are non-refundable except where the law says
          otherwise. The <Link href="/terms">terms</Link> have the full details.
        </p>

        <h3>What happens after my plan ends?</h3>
        <p>
          Your account goes back to the free plan. Your readers and their progress stay in your
          account, and Level 2 and above unlock again if you pick a paid plan later.
        </p>

        <h3>Is my payment information safe?</h3>
        <p>
          Payments are handled by Stripe. We don’t store your full card number, only a Stripe
          reference and your plan.
        </p>
      </Section>

      <Section id="contact">
        <p>
          Email us at {email}. We’re happy to help with setup, levels, billing or anything else.
        </p>
      </Section>

      <style>{`
        .help-section { scroll-margin-top: 24px; border-top: 1px solid var(--color-line); margin-top: 36px; padding-top: 4px; }
        .legal-body .help-section h2 { font-size: 24px; margin: 24px 0 4px; scroll-margin-top: 24px; }
        .legal-body .help-section h3 { font-size: 18px; margin: 24px 0 8px; }
        .legal-body .help-toc { margin: 24px 0 8px; padding: 16px 20px 20px; }
        .legal-body .help-toc h2 { font-size: 18px; margin: 0 0 12px; }
        .legal-body .help-toc ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
        .legal-body .help-toc li { margin: 0; }
        .legal-body .help-toc a {
          display: inline-flex; align-items: center; padding: 0 14px; border-radius: 999px;
          background: var(--color-surface-2); border: 1px solid var(--color-line);
          color: var(--color-text-primary); text-decoration: none; font-weight: 600;
        }
        .legal-body .help-toc a:hover { border-color: var(--color-line-strong); text-decoration: underline; }
        .help-table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
        .help-table caption { text-align: left; color: var(--color-text-muted); padding-bottom: 8px; }
        .help-table th, .help-table td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--color-line); }
        .help-table thead th { color: var(--color-text-primary); font-weight: 700; border-bottom-color: var(--color-line-strong); }
        .help-table tbody th[scope="row"] { color: var(--color-text-primary); font-weight: 700; white-space: nowrap; width: 1%; font-variant-numeric: tabular-nums; }
        .help-table .help-table-group { color: var(--color-brand-secondary); font-weight: 700; padding-top: 18px; background: transparent; }
      `}</style>
    </LegalPage>
  );
}
