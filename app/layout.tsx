import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/providers/ConvexClientProvider";
import "./globals.css";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" data-theme="ocean">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap"
          />
        </head>
        <body>
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
