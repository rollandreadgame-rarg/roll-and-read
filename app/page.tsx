import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const FEATURES = [
  {
    icon: "🎲",
    title: "Structured Phonics Levels",
    desc: "5 levels with lettered sub-levels covering the full science of reading curriculum — from basic consonants to advanced word endings.",
  },
  {
    icon: "📚",
    title: "Build Your Word Bank",
    desc: "Every word you read gets added to your personal Word Bank with a coin value. Watch your collection grow with each session!",
  },
  {
    icon: "🎴",
    title: "Earn Stickers & Rewards",
    desc: "Roll the dice, read the words, earn coins, and spend them on 200+ collectible stickers across 8 exciting categories.",
  },
];

const LEVELS = [
  { level: "1A", name: "Short Vowels a, i", color: "#10B981" },
  { level: "1B", name: "Short Vowels o, u, e", color: "#10B981" },
  { level: "1C", name: "Digraphs & Floss Rule", color: "#10B981" },
  { level: "1D", name: "Beginning Blends", color: "#10B981" },
  { level: "2A", name: "Open Syllables", color: "#3B82F6" },
  { level: "2B", name: "Vowel Teams ai, ay", color: "#3B82F6" },
  { level: "3A", name: "Vowel Teams oi, oy", color: "#A855F7" },
  { level: "4A", name: "Consonant-le Syllable", color: "#F59E0B" },
  { level: "5A", name: "Silent Letters", color: "#EF4444" },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "Level 1 (all sub-levels)",
      "2 themes",
      "Basic word bank",
      "1 reader profile",
    ],
    cta: "Start Free",
    href: "/sign-up",
    highlight: false,
  },
  {
    name: "Individual",
    price: "$7.99",
    period: "per month",
    features: [
      "All 25 sub-levels (1A–5B)",
      "Full word library",
      "All 5 themes",
      "1 reader profile",
      "Parent dashboard",
    ],
    cta: "Choose Individual",
    href: "/billing",
    highlight: false,
  },
  {
    name: "Family",
    price: "$14.99",
    period: "per month",
    features: [
      "Everything in Individual",
      "Up to 5 reader profiles",
      "Best for siblings",
    ],
    cta: "Choose Family",
    href: "/billing",
    highlight: true,
  },
  {
    name: "Classroom",
    price: "$49",
    period: "per month",
    features: [
      "Everything in Individual",
      "Up to 30 student profiles",
      "Teacher dashboard",
      "Class progress reports",
    ],
    cta: "Choose Classroom",
    href: "/billing",
    highlight: false,
  },
];

const IS_E2E = process.env.NEXT_PUBLIC_E2E_MODE === "true";

export default async function LandingPage() {
  if (!IS_E2E) {
    const { userId } = await auth();
    if (userId) redirect("/play");
  }

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #0C1B33 0%, #0C2340 50%, #0C1B33 100%)",
        fontFamily: "'Nunito', sans-serif",
        color: "#F8FAFC",
        minHeight: "100dvh",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(12,27,51,0.9)",
        }}
      >
        <div style={{ fontSize: "20px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
          <span>🎲</span> Roll &amp; Read
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Link
            href="/sign-in"
            style={{ color: "#94A3B8", fontWeight: 600, textDecoration: "none", fontSize: "15px" }}
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            style={{
              background: "linear-gradient(135deg, #0891B2, #06B6D4)",
              color: "white",
              padding: "8px 20px",
              borderRadius: "12px",
              fontWeight: 700,
              textDecoration: "none",
              fontSize: "15px",
            }}
          >
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "80px 24px 60px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "rgba(8,145,178,0.2)",
            border: "1px solid rgba(8,145,178,0.4)",
            borderRadius: "100px",
            padding: "6px 16px",
            fontSize: "13px",
            fontWeight: 700,
            color: "#06B6D4",
            marginBottom: "24px",
            letterSpacing: "0.05em",
          }}
        >
          ✨ Built on the Science of Reading
        </div>

        <h1
          style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: "24px",
          }}
        >
          Roll the Dice.{" "}
          <span style={{ color: "#06B6D4" }}>Read the Words.</span>{" "}
          Collect Your Story.
        </h1>

        <p
          style={{
            fontSize: "18px",
            color: "#94A3B8",
            maxWidth: "560px",
            margin: "0 auto 40px",
            lineHeight: 1.6,
          }}
        >
          A phonics-based learning game built on the science of reading — for every child who
          learns differently, including dyslexic readers, English language learners, and early
          readers ages 4–14.
        </p>

        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/sign-up"
            style={{
              background: "linear-gradient(135deg, #0891B2, #06B6D4)",
              color: "white",
              padding: "16px 32px",
              borderRadius: "16px",
              fontWeight: 800,
              textDecoration: "none",
              fontSize: "18px",
              boxShadow: "0 8px 32px rgba(8,145,178,0.4)",
              display: "inline-block",
            }}
          >
            🎲 Start for Free
          </Link>
        </div>

        {/* Animated Dice */}
        <div
          style={{
            marginTop: "60px",
            fontSize: "80px",
            animation: "bounce 2s ease-in-out infinite",
          }}
        >
          🎲
        </div>
        <style>{`
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-16px); }
          }
        `}</style>
      </section>

      {/* Features */}
      <section style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: "32px", fontWeight: 800, marginBottom: "40px" }}>
          Why Children Love Roll &amp; Read
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          {FEATURES.map(({ icon, title, desc }) => (
            <div
              key={title}
              style={{
                background: "rgba(30,41,59,0.8)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "20px",
                padding: "28px",
              }}
            >
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>{icon}</div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>{title}</h3>
              <p style={{ color: "#94A3B8", lineHeight: 1.6, fontSize: "15px" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Level Preview */}
      <section style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: "32px", fontWeight: 800, marginBottom: "12px" }}>
          A Full Structured Phonics Curriculum
        </h2>
        <p
          style={{
            textAlign: "center",
            color: "#94A3B8",
            marginBottom: "32px",
            fontSize: "16px",
          }}
        >
          5 levels · 29 sub-levels · Hundreds of real and nonsense words
        </p>
        <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px" }}>
          {LEVELS.map(({ level, name, color }) => (
            <div
              key={level}
              style={{
                background: "rgba(30,41,59,0.8)",
                border: `1px solid ${color}44`,
                borderRadius: "16px",
                padding: "16px 20px",
                minWidth: "160px",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  background: color,
                  color: "white",
                  borderRadius: "8px",
                  padding: "2px 10px",
                  fontSize: "13px",
                  fontWeight: 700,
                  marginBottom: "8px",
                }}
              >
                Level {level}
              </div>
              <div style={{ fontSize: "14px", color: "#94A3B8" }}>{name}</div>
            </div>
          ))}
          <div
            style={{
              background: "rgba(30,41,59,0.4)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "16px",
              padding: "16px 20px",
              minWidth: "160px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94A3B8",
              fontSize: "14px",
            }}
          >
            + 20 more levels →
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ maxWidth: "1000px", margin: "0 auto", padding: "60px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: "32px", fontWeight: 800, marginBottom: "40px" }}>
          Simple, Honest Pricing
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "24px",
          }}
        >
          {PRICING.map(({ name, price, period, features, cta, href, highlight }) => (
            <div
              key={name}
              style={{
                background: highlight ? "rgba(8,145,178,0.15)" : "rgba(30,41,59,0.8)",
                border: highlight ? "2px solid #0891B2" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: "24px",
                padding: "32px",
                position: "relative",
              }}
            >
              {highlight && (
                <div
                  style={{
                    position: "absolute",
                    top: "-12px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#0891B2",
                    color: "white",
                    padding: "4px 16px",
                    borderRadius: "100px",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  Most Popular
                </div>
              )}
              <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>{name}</h3>
              <div style={{ marginBottom: "20px" }}>
                <span style={{ fontSize: "36px", fontWeight: 800, color: "#06B6D4" }}>{price}</span>
                <span style={{ color: "#94A3B8", fontSize: "14px" }}> / {period}</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, marginBottom: "24px" }}>
                {features.map((f) => (
                  <li key={f} style={{ display: "flex", gap: "8px", marginBottom: "8px", fontSize: "14px", color: "#CBD5E1" }}>
                    <span style={{ color: "#10B981" }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href={href}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "12px",
                  borderRadius: "12px",
                  fontWeight: 700,
                  textDecoration: "none",
                  background: highlight ? "linear-gradient(135deg, #0891B2, #06B6D4)" : "rgba(255,255,255,0.08)",
                  color: "white",
                  fontSize: "15px",
                }}
              >
                {cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          padding: "32px 24px",
          textAlign: "center",
          color: "#94A3B8",
          fontSize: "14px",
        }}
      >
        <div style={{ marginBottom: "12px" }}>
          <strong style={{ color: "#F8FAFC" }}>🎲 Roll &amp; Read</strong> — Phonics-based learning built on the science of reading.
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "24px", flexWrap: "wrap" }}>
          <Link href="/sign-in" style={{ color: "#94A3B8", textDecoration: "none" }}>Sign In</Link>
          <Link href="/sign-up" style={{ color: "#94A3B8", textDecoration: "none" }}>Sign Up</Link>
          <span style={{ color: "#475569" }}>Privacy Policy</span>
          <span style={{ color: "#475569" }}>Contact</span>
        </div>
        <div style={{ marginTop: "16px", fontSize: "12px", color: "#475569" }}>
          © 2026 Roll and Read. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
