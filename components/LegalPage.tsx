// components/LegalPage.tsx
// Shared shell for the public Privacy/Terms pages — readable, dark-themed,
// with a back-to-home link. Server component (no client JS needed).
import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div style={{ minHeight: "100dvh", background: "#0B1220", color: "#CBD5E1" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px" }}>
        <Link
          href="/"
          style={{ color: "#818CF8", textDecoration: "none", fontSize: 14, fontWeight: 600 }}
        >
          ← Back to Roll &amp; Read
        </Link>

        <h1
          style={{
            color: "#F8FAFC",
            fontSize: 34,
            fontWeight: 800,
            margin: "20px 0 6px",
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>
        <p style={{ color: "#64748B", fontSize: 14, marginBottom: 32 }}>
          Last updated: {lastUpdated}
        </p>

        <div
          style={{ fontSize: 15, lineHeight: 1.7 }}
          className="legal-body"
        >
          {children}
        </div>
      </div>

      {/* Shared readable typography for the legal prose */}
      <style>{`
        .legal-body h2 { color: #F1F5F9; font-size: 20px; font-weight: 700; margin: 28px 0 10px; }
        .legal-body h3 { color: #E2E8F0; font-size: 16px; font-weight: 700; margin: 20px 0 8px; }
        .legal-body p { margin: 0 0 14px; }
        .legal-body ul { margin: 0 0 14px; padding-left: 22px; }
        .legal-body li { margin: 0 0 8px; }
        .legal-body a { color: #818CF8; }
        .legal-body strong { color: #F1F5F9; }
      `}</style>
    </div>
  );
}
