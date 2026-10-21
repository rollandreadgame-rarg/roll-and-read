import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import MiniDie from "@/components/game/MiniDie";

// Auth pages are always Ocean. Clerk needs concrete colours, so these are the
// Ocean token values from app/globals.css.
const OCEAN_APPEARANCE = {
  variables: {
    colorPrimary: "#0E7C8C",
    colorPrimaryForeground: "#FFFFFF",
    colorBackground: "#123049",
    colorForeground: "#F2F7FA",
    colorMutedForeground: "#A8C3D3",
    colorMuted: "#1A3F5E",
    colorInput: "#1A3F5E",
    colorInputForeground: "#F2F7FA",
    colorBorder: "rgba(168, 205, 226, 0.32)",
    colorNeutral: "#CFE0EA",
    colorDanger: "#EA8589",
    colorSuccess: "#2FB873",
    colorWarning: "#F28C28",
    colorRing: "#FFD45C",
    colorShadow: "rgba(0, 0, 0, 0.45)",
    colorModalBackdrop: "rgba(11, 34, 51, 0.8)",
    fontFamily: "var(--font-ui)",
    borderRadius: "14px",
  },
  elements: {
    card: "border border-[rgba(168,205,226,0.16)]",
    // Object styles: Clerk's own link colour outranks utility classes
    footerAction: { display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" },
    footerActionLink: { color: "#4FD1DD", fontWeight: 700, "&:hover": { color: "#F2F7FA" } },
  },
};

export default function SignInPage() {
  return (
    <div
      data-theme="ocean"
      className="min-h-dvh flex flex-col items-center justify-center gap-6 px-4 py-8"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, var(--table-glow), transparent 70%), var(--color-bg-primary)",
        color: "var(--color-text-primary)",
      }}
    >
      <Link
        href="/"
        className="flex items-center gap-2 rounded-2xl px-2 text-xl font-extrabold"
        style={{ color: "var(--color-text-primary)" }}
      >
        <MiniDie face={5} className="w-8 h-8" />
        Roll &amp; Read
      </Link>

      <SignIn appearance={OCEAN_APPEARANCE} />
    </div>
  );
}
