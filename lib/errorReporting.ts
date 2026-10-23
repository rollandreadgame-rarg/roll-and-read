// Client crash reporting. ErrorReporter (mounted in the signed-in app shell)
// installs the sink; anything can call reportError, including the class-based
// ErrorBoundary which can't use hooks.

type Sink = (e: { message: string; stack?: string }) => void;
let sink: Sink | null = null;
const seen = new Set<string>();

export function setErrorSink(next: Sink | null) {
  sink = next;
}

export function reportError(err: unknown) {
  // No sink yet (e.g. an ErrorBoundary catch before ErrorReporter's effect ran):
  // don't mark the error as seen, or its later occurrences would be dropped too.
  if (!sink) return;
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "Unknown error");
  const key = `${e.message}|${e.stack?.split("\n")[1] ?? ""}`;
  if (seen.has(key)) return; // once per page load
  seen.add(key);
  try {
    sink?.({ message: e.message || "Unknown error", stack: e.stack });
  } catch {
    // Reporting must never throw.
  }
}
