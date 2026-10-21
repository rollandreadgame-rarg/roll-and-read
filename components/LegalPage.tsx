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
    <div style={{ minHeight: "100dvh", background: "var(--color-bg-primary)", color: "var(--color-text-secondary)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px" }}>
        <Link
          href="/"
          style={{ color: "var(--color-brand-secondary)", textDecoration: "none", fontSize: 15, fontWeight: 600 }}
          className="inline-flex items-center"
        >
          ← Back to Roll &amp; Read
        </Link>

        <h1
          style={{
            color: "var(--color-text-primary)",
            fontSize: 34,
            fontWeight: 800,
            margin: "20px 0 6px",
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: 14, marginBottom: 32 }}>
          Last updated: {lastUpdated}
        </p>

        <div
          style={{ fontSize: 16, lineHeight: 1.7, maxWidth: "68ch" }}
          className="legal-body"
        >
          {children}
        </div>
      </div>

      {/* Shared readable typography for the legal prose */}
      <style>{`
        .legal-body h2 { color: var(--color-text-primary); font-size: 20px; font-weight: 700; margin: 28px 0 10px; }
        .legal-body h3 { color: var(--color-text-primary); font-size: 16px; font-weight: 700; margin: 20px 0 8px; }
        .legal-body p { margin: 0 0 14px; }
        .legal-body ul { margin: 0 0 14px; padding-left: 22px; }
        .legal-body li { margin: 0 0 8px; }
        .legal-body a { color: var(--color-brand-secondary); text-decoration: underline; }
        .legal-body strong { color: var(--color-text-primary); }
      `}</style>
    </div>
  );
}
