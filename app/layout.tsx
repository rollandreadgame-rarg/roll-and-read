import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/providers/ConvexClientProvider";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  variable: "--font-nunito",
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

const IS_E2E = process.env.NEXT_PUBLIC_E2E_MODE === "true";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const inner = (
    <html lang="en" data-theme="ocean" className={nunito.variable}>
      <body>
        <ConvexClientProvider>
          {children}
        </ConvexClientProvider>
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
