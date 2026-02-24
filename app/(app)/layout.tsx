import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexClientProvider } from "@/providers/ConvexClientProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import TopNav from "@/components/navigation/TopNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <ConvexClientProvider>
      <ThemeProvider>
        <div className="min-h-dvh flex flex-col" style={{ background: "var(--color-bg-primary)" }}>
          <TopNav />
          <main className="flex-1 flex flex-col">{children}</main>
        </div>
      </ThemeProvider>
    </ConvexClientProvider>
  );
}
