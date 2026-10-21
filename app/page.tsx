import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import MiniDie from "@/components/game/MiniDie";
import { LEVEL_SEQUENCE, LEVEL_SKILLS } from "@/lib/levels";

const TURN_STEPS = [
  { face: 1, title: "Roll the die", body: "The row with the same number of dots lights up." },
  { face: 2, title: "Listen", body: "A friendly voice says one of the words in that row." },
  { face: 3, title: "Tap the word", body: "Get it right and the word flies into your word bank." },
];

const READER_SUPPORT = [
  {
    title: "Letters children are taught",
    body: "Words are printed in Andika, with the single-storey a and g from early handwriting. Switch to OpenDyslexic any time.",
  },
  {
    title: "Silly words for real decoding",
    body: "Made-up words like “zib” can't be guessed from memory, so children have to sound them out. They're marked with an alien.",
  },
  {
    title: "Every word read aloud",
    body: "More than 1,500 words, each with its own clear recording. Tap the button or press space to hear it again.",
  },
  {
    title: "Rewards that keep them rolling",
    body: "Coins for every word, a growing word bank, and nearly 600 stickers to collect across 10 categories.",
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["Level 1 (all sub-levels)", "2 themes", "Basic word bank", "1 reader profile"],
    cta: "Start free",
    href: "/sign-up",
    highlight: false,
  },
  {
    name: "Individual",
    price: "$7.99",
    period: "per month",
    features: ["All 25 sub-levels (1A–5B)", "Full word library", "All 5 themes", "1 reader profile", "Parent dashboard"],
    cta: "Choose Individual",
    href: "/billing",
    highlight: false,
  },
  {
    name: "Family",
    price: "$14.99",
    period: "per month",
    features: ["Everything in Individual", "Up to 5 reader profiles", "Best for siblings"],
    cta: "Choose Family",
    href: "/billing",
    highlight: true,
  },
  {
    name: "Classroom",
    price: "$49",
    period: "per month",
    features: ["Everything in Individual", "Up to 30 student profiles", "Teacher dashboard", "Class progress reports"],
    cta: "Choose Classroom",
    href: "/billing",
    highlight: false,
  },
];

// Example board for the hero illustration
const DEMO_ROWS: { face: number; words: { w: string; silly?: boolean }[]; active?: boolean }[] = [
  { face: 2, words: [{ w: "shop" }, { w: "chin" }, { w: "moth" }, { w: "whip" }] },
  { face: 3, active: true, words: [{ w: "frog" }, { w: "ship" }, { w: "zib", silly: true }, { w: "bell" }] },
  { face: 5, words: [{ w: "clap" }, { w: "drum" }, { w: "plum", }, { w: "glob", silly: true }] },
];

const LEVEL_GROUPS = [1, 2, 3, 4, 5].map((n) => ({
  n,
  levels: LEVEL_SEQUENCE.filter((l) => l.startsWith(String(n))),
}));

// Don't let a line break split "-dge" or "-que," away from its hyphen
function keepSuffixesWhole(text: string) {
  return text.split(" ").map((part, i) => (
    <span key={i}>
      {i > 0 && " "}
      {part.includes("-") ? <span className="whitespace-nowrap">{part}</span> : part}
    </span>
  ));
}

const IS_E2E = process.env.NEXT_PUBLIC_E2E_MODE === "true";

function DemoCard({ w, silly, active }: { w: string; silly?: boolean; active?: boolean }) {
  if (!active) {
    return (
      <span
        className="flex-1 min-w-0 rounded-[12px] border px-2 py-2 text-center font-bold text-base sm:text-lg"
        style={{
          fontFamily: "var(--font-word)",
          background: "var(--color-surface-2)",
          color: "var(--color-text-muted)",
          borderColor: silly ? "var(--card-silly-edge)" : "var(--color-line)",
          borderStyle: silly ? "dashed" : "solid",
        }}
      >
        {w}
      </span>
    );
  }
  return (
    <span
      className="relative flex-1 min-w-0 rounded-[12px] border-2 px-2 py-2.5 text-center font-bold text-lg sm:text-2xl"
      style={{
        fontFamily: "var(--font-word)",
        background: silly ? "var(--card-silly)" : "var(--card-paper)",
        color: silly ? "var(--card-silly-ink)" : "var(--card-ink)",
        borderColor: silly ? "var(--card-silly-edge)" : "transparent",
        borderStyle: silly ? "dashed" : "solid",
        boxShadow: `0 4px 0 ${silly ? "#B9A6F2" : "var(--card-edge)"}, 0 10px 18px -8px rgba(0,0,0,0.5)`,
      }}
    >
      {w}
      {silly && (
        <span
          className="absolute -top-2.5 -left-2.5 flex size-6 items-center justify-center rounded-full text-sm"
          style={{ background: "var(--card-silly-edge)", boxShadow: "0 0 0 2px var(--card-paper)" }}
        >
          👽
        </span>
      )}
    </span>
  );
}

export default async function LandingPage() {
  if (!IS_E2E) {
    const { userId } = await auth();
    if (userId) redirect("/play");
  }

  return (
    <div className="min-h-dvh" style={{ background: "var(--color-bg-primary)", color: "var(--color-text-primary)" }}>
      {/* Nav */}
      <header
        className="sticky top-0 z-10 border-b"
        style={{
          borderColor: "var(--color-line)",
          backdropFilter: "blur(12px)",
          background: "color-mix(in srgb, var(--color-bg-primary) 90%, transparent)",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-extrabold" aria-label="Roll & Read home">
            <MiniDie face={5} className="size-8 -rotate-6" />
            <span>Roll &amp; Read</span>
          </Link>
          <nav aria-label="Account" className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/sign-in"
              className="flex items-center rounded-xl px-3 font-semibold hover:bg-[var(--color-hover)]"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Sign in
            </Link>
            <Link href="/sign-up" className="btn-primary flex items-center px-4 text-[15px]">
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="table-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24 lg:pt-20">
            <div className="text-center lg:text-left">
              <h1 className="text-[clamp(2.4rem,6vw,4.25rem)] font-extrabold leading-[1.05]">
                Roll the dice. Read the words. Collect your story.
              </h1>
              <p
                className="mx-auto mt-6 max-w-[34rem] text-lg leading-relaxed lg:mx-0"
                style={{ color: "var(--color-text-secondary)" }}
              >
                A phonics game built on the science of reading, for every child who learns
                differently — including dyslexic readers, English language learners, and early
                readers ages 4–14.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link href="/sign-up" className="btn-primary flex items-center px-7 py-4 text-lg">
                  Start free
                </Link>
                <a
                  href="#levels"
                  className="flex items-center rounded-2xl border px-6 py-4 font-semibold hover:bg-[var(--color-hover)]"
                  style={{ borderColor: "var(--color-line-strong)", color: "var(--color-text-primary)" }}
                >
                  See all 25 levels
                </a>
              </div>
              <p className="mt-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
                Level 1 is free forever. No card needed.
              </p>
            </div>

            {/* Example board */}
            <figure
              className="panel relative mx-auto w-full max-w-[34rem] p-4 sm:p-6"
              style={{ boxShadow: "0 30px 60px -30px rgba(0,0,0,0.6)" }}
            >
              <figcaption className="sr-only">
                An example game board: the die shows three, so the row marked with three dots is lit and
                the child taps the word they hear — frog, ship, zib or bell.
              </figcaption>
              <div aria-hidden="true">
                <div className="mb-4 flex items-center gap-4 sm:mb-5">
                  <div
                    className="relative size-[72px] shrink-0 rotate-[-8deg] rounded-[18px] sm:size-20"
                    style={{
                      background: "radial-gradient(120% 120% at 30% 25%, #FFFFFF 0%, #F6F0E2 55%, #E6DCC5 100%)",
                      boxShadow: "0 6px 0 #CDBF9F, 0 16px 24px -10px rgba(0,0,0,0.6)",
                    }}
                  >
                    {[["24%", "24%"], ["50%", "50%"], ["76%", "76%"]].map(([t, l]) => (
                      <span
                        key={t}
                        className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{ top: t, left: l, background: "#17202E", boxShadow: "inset 0 2px 2px rgba(0,0,0,.45)" }}
                      />
                    ))}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold">You rolled a 3</p>
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                      🔊 “ship” — tap the word you hear
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  {DEMO_ROWS.map((row) => (
                    <div
                      key={row.face}
                      className={`flex items-center gap-2 rounded-2xl p-2 sm:gap-2.5 ${row.active ? "row-active-pulse" : ""}`}
                      style={{
                        color: "var(--color-text-muted)",
                        background: row.active
                          ? "color-mix(in srgb, var(--color-highlight) 10%, var(--color-bg-surface))"
                          : undefined,
                      }}
                    >
                      <MiniDie face={row.face} tone={row.active ? "lit" : "dim"} className={row.active ? "size-9" : "size-7"} />
                      {row.words.map((w) => (
                        <DemoCard key={w.w} w={w.w} silly={w.silly} active={row.active} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </figure>
          </div>
        </section>

        {/* How a turn works */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20" aria-labelledby="turn-heading">
          <h2 id="turn-heading" className="text-3xl font-extrabold sm:text-4xl">
            How a turn works
          </h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {TURN_STEPS.map((s) => (
              <li key={s.face} className="flex gap-4 sm:flex-col">
                <MiniDie face={s.face} className="size-12 shrink-0" />
                <div>
                  <h3 className="text-xl font-bold">
                    <span className="sr-only">Step {s.face}: </span>
                    {s.title}
                  </h3>
                  <p className="mt-1.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-10 max-w-2xl leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            Clear all six rows to finish a board. After seven boards with steady accuracy, your
            reader moves up to the next skill.
          </p>
        </section>

        {/* Built for every reader */}
        <section
          className="border-y"
          style={{ borderColor: "var(--color-line)", background: "var(--color-bg-surface)" }}
          aria-labelledby="support-heading"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 id="support-heading" className="max-w-xl text-3xl font-extrabold sm:text-4xl">
              Built for children who learn differently
            </h2>
            <div className="mt-10 grid gap-x-12 gap-y-10 sm:grid-cols-2">
              {READER_SUPPORT.map((f) => (
                <div key={f.title} className="border-l-4 pl-5" style={{ borderColor: "var(--color-brand-secondary)" }}>
                  <h3 className="text-lg font-bold">{f.title}</h3>
                  <p className="mt-1.5 max-w-prose leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Curriculum */}
        <section id="levels" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-20" aria-labelledby="levels-heading">
          <h2 id="levels-heading" className="text-3xl font-extrabold sm:text-4xl">
            A full structured phonics curriculum
          </h2>
          <p className="mt-3 max-w-2xl text-lg" style={{ color: "var(--color-text-muted)" }}>
            Five levels and 25 sub-levels, each with real words and silly words, in the order
            structured literacy programs teach them.
          </p>
          <div className="mt-10 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
            {LEVEL_GROUPS.map((g) => (
              <div key={g.n}>
                <h3 className="flex items-center gap-2 border-b pb-2 text-lg font-bold" style={{ borderColor: "var(--color-line-strong)" }}>
                  Level {g.n}
                  {g.n === 1 && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ background: "var(--color-brand)", color: "var(--color-on-brand)" }}
                    >
                      Free
                    </span>
                  )}
                </h3>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {g.levels.map((l) => (
                    <li key={l} className="flex gap-3 text-[15px] leading-snug">
                      <span className="w-7 shrink-0 font-bold tabular-nums" style={{ color: "var(--color-brand-secondary)" }}>
                        {l}
                      </span>
                      <span style={{ color: "var(--color-text-secondary)" }}>{keepSuffixesWhole(LEVEL_SKILLS[l])}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section
          className="border-t"
          style={{ borderColor: "var(--color-line)" }}
          aria-labelledby="pricing-heading"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 id="pricing-heading" className="text-3xl font-extrabold sm:text-4xl">
              Simple, honest pricing
            </h2>
            <p className="mt-3 text-lg" style={{ color: "var(--color-text-muted)" }}>
              Start free. Upgrade when your reader is ready for Level 2.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PRICING.map(({ name, price, period, features, cta, href, highlight }) => (
                <div
                  key={name}
                  className="relative flex flex-col rounded-[22px] p-6"
                  style={{
                    background: highlight
                      ? "color-mix(in srgb, var(--color-brand) 16%, var(--color-bg-surface))"
                      : "var(--color-bg-surface)",
                    border: highlight ? "2px solid var(--color-brand-secondary)" : "1px solid var(--color-line)",
                  }}
                >
                  {highlight && (
                    <p
                      className="absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-bold"
                      style={{ background: "var(--color-brand-secondary)", color: "#06262B" }}
                    >
                      Most popular
                    </p>
                  )}
                  <h3 className="text-xl font-bold">{name}</h3>
                  <p className="mt-2">
                    <span className="text-4xl font-extrabold tabular-nums">{price}</span>
                    <span className="text-sm" style={{ color: "var(--color-text-muted)" }}> / {period}</span>
                  </p>
                  <ul className="mt-5 mb-6 flex flex-1 flex-col gap-2.5">
                    {features.map((f) => (
                      <li key={f} className="flex gap-2 text-[15px]" style={{ color: "var(--color-text-secondary)" }}>
                        <span aria-hidden="true" style={{ color: "var(--color-success-text)" }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={href}
                    className={
                      highlight
                        ? "btn-primary flex items-center justify-center py-3"
                        : "flex items-center justify-center rounded-2xl border py-3 font-bold hover:bg-[var(--color-hover)]"
                    }
                    style={highlight ? undefined : { borderColor: "var(--color-line-strong)", color: "var(--color-text-primary)" }}
                  >
                    {cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: "var(--color-line)" }}>
        <div
          className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-sm sm:flex-row sm:justify-between sm:px-6"
          style={{ color: "var(--color-text-muted)" }}
        >
          <p className="flex items-center gap-2">
            <MiniDie face={5} className="size-5" />
            <span>
              © 2026 <strong style={{ color: "var(--color-text-primary)" }}>Roll &amp; Read</strong>
            </span>
          </p>
          <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-2">
            {[
              ["/sign-in", "Sign in"],
              ["/sign-up", "Sign up"],
              ["/privacy", "Privacy policy"],
              ["/terms", "Terms"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="flex items-center rounded-lg px-2 hover:underline">
                {label}
              </Link>
            ))}
            <a href="mailto:support@rollandreadgame.com" className="flex items-center rounded-lg px-2 hover:underline">
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
