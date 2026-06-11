import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center gap-5 p-4"
      style={{ background: "var(--color-bg-primary)" }}
    >
      <SignUp
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

      {/* Parent/teacher consent notice — accounts are adult-managed. */}
      <p className="max-w-sm text-center text-xs leading-relaxed text-slate-400">
        By creating an account you confirm that you are at least 18 years old and the
        parent, legal guardian, or teacher of any child profiles you create, and you agree
        to our{" "}
        <Link href="/terms" className="text-indigo-400 underline">Terms of Service</Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-indigo-400 underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}
