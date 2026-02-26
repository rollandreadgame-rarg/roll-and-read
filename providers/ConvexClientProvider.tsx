"use client";

import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const IS_E2E = process.env.NEXT_PUBLIC_E2E_MODE === "true";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (IS_E2E) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
  }
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
