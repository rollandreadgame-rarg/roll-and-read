"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { reportError, setErrorSink } from "@/lib/errorReporting";

// Sends uncaught errors from signed-in pages to Convex (clientErrors.report).
export default function ErrorReporter() {
  const report = useMutation(api.clientErrors.report);

  useEffect(() => {
    setErrorSink(({ message, stack }) => {
      report({
        message,
        stack,
        path: window.location.pathname,
        userAgent: navigator.userAgent,
      }).catch(() => {});
    });
    const onError = (e: ErrorEvent) => reportError(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      setErrorSink(null);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [report]);

  return null;
}
