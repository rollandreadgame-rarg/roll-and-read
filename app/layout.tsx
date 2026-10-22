import type { Metadata, Viewport } from "next";
import { Andika, Lexend } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/providers/ConvexClientProvider";
import MotionPreferences from "@/components/system/MotionPreferences";
import SiteAnalytics from "@/components/system/SiteAnalytics";
import "./globals.css";

// Interface text: Lexend was designed around reading-fluency research.
const lexend = Lexend({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-lexend",
});

// Words the child reads: Andika (SIL) uses the single-storey "a" and "g"
// that early readers are taught to write.
const andika = Andika({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-andika",
});

export const metadata: Metadata = {
  title: "Roll and Read — Structured Phonics Game",
  description:
    "A phonics-based learning game built on the science of reading — for every child who learns differently.",
  keywords: ["phonics", "reading", "structured phonics", "science of reading", "dyslexia"],
  openGraph: {
    title: "Roll and Read",
    description: "Roll the dice. Read the words. Collect your story.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B2233",
};

const IS_E2E =process.env.NEXT_PUBLIC_E2E_MODE === "true";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const inner = (
    <html lang="en" data-theme="ocean" className={`${lexend.variable} ${andika.variable}`}>
      <body>
        <ConvexClientProvider>
          <MotionPreferences>{children}</MotionPreferences>
        </ConvexClientProvider>
        <SiteAnalytics />
      </body>
    </html>
  );

  if (IS_E2E) return inner;

  return (
    <ClerkProvider signInFallbackRedirectUrl="/play" signUpFallbackRedirectUrl="/play">
      {inner}
    </ClerkProvider>
  );
}
