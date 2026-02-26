import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ThemeProvider } from "@/providers/ThemeProvider";
import TopNav from "@/components/navigation/TopNav";
import ErrorBoundary from "@/components/ErrorBoundary";

const IS_E2E = process.env.NEXT_PUBLIC_E2E_MODE === "true";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!IS_E2E) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");
  }

  return (
    <ThemeProvider>
      <div className="min-h-dvh flex flex-col" style={{ background: "var(--color-bg-primary)" }}>
        <TopNav />
        <main className="flex-1 flex flex-col">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </ThemeProvider>
  );
}
