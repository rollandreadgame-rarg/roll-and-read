import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div
      className="min-h-dvh flex items-center justify-center"
      style={{ background: "var(--color-bg-primary)" }}
    >
      <div className="text-center mb-8">
        <SignIn
          appearance={{
            elements: {
              card: "bg-slate-800 border border-slate-700 shadow-2xl",
              headerTitle: "text-white",
              headerSubtitle: "text-slate-400",
              formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700",
              footerActionLink: "text-indigo-400 hover:text-indigo-300",
            },
          }}
        />
      </div>
    </div>
  );
}
