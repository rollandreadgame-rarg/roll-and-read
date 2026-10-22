// components/LegalPage.tsx
// Shared shell for the public Help, Privacy and Terms pages: readable prose on
// the theme tokens, a back-to-home link and a small footer. Server component
// (no client JS needed).
import Link from "next/link";
import type { ReactNode } from "react";
import { SUPPORT_EMAIL } from "@/lib/contact";

const FOOTER_LINKS: [href: string, label: string][] = [
  ["/", "Home"],
  ["/help", "Help"],
  ["/privacy", "Privacy policy"],
  ["/terms", "Terms"],
];

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
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 56px" }}>
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
      </main>

      <footer style={{ borderTop: "1px solid var(--color-line)" }}>
        <nav
          aria-label="Footer"
          style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 40px", color: "var(--color-text-secondary)", fontSize: 16 }}
        >
          <ul className="flex flex-wrap" style={{ listStyle: "none", margin: 0, padding: 0, columnGap: 8 }}>
            {FOOTER_LINKS.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="flex items-center rounded-lg px-2 hover:underline">
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center rounded-lg px-2 hover:underline">
                Contact
              </a>
            </li>
          </ul>
        </nav>
      </footer>

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
