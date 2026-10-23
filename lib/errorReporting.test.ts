import { beforeEach, describe, expect, test, vi } from "vitest";

// errorReporting keeps module state (sink + seen set), so load a fresh copy per test.
let mod: typeof import("./errorReporting");
beforeEach(async () => {
  vi.resetModules();
  mod = await import("./errorReporting");
});

describe("reportError", () => {
  test("never throws without a sink", () => {
    expect(() => mod.reportError(new Error("boom"))).not.toThrow();
  });

  test("sends message and stack to the sink", () => {
    const sink = vi.fn();
    mod.setErrorSink(sink);
    const err = new Error("boom");
    mod.reportError(err);
    expect(sink).toHaveBeenCalledWith({ message: "boom", stack: err.stack });
  });

  test("the same error is reported once per page load", () => {
    const sink = vi.fn();
    mod.setErrorSink(sink);
    const err = new Error("boom");
    mod.reportError(err);
    mod.reportError(err);
    expect(sink).toHaveBeenCalledTimes(1);
  });

  test("different messages are reported separately", () => {
    const sink = vi.fn();
    mod.setErrorSink(sink);
    mod.reportError(new Error("a"));
    mod.reportError(new Error("b"));
    expect(sink).toHaveBeenCalledTimes(2);
  });

  test("string and non-Error values are reported with a readable message", () => {
    const sink = vi.fn();
    mod.setErrorSink(sink);
    mod.reportError("plain string");
    mod.reportError({ weird: true });
    mod.reportError(undefined);
    expect(sink.mock.calls.map(([e]) => e.message)).toEqual(["plain string", "Unknown error"]);
  });

  test("an Error with an empty message is reported as 'Unknown error'", () => {
    const sink = vi.fn();
    mod.setErrorSink(sink);
    mod.reportError(new Error(""));
    expect(sink.mock.calls[0][0].message).toBe("Unknown error");
  });

  test("a throwing sink never propagates", () => {
    mod.setErrorSink(() => {
      throw new Error("sink exploded");
    });
    expect(() => mod.reportError(new Error("boom"))).not.toThrow();
  });

  test("setErrorSink(null) stops reporting", () => {
    const sink = vi.fn();
    mod.setErrorSink(sink);
    mod.setErrorSink(null);
    mod.reportError(new Error("boom"));
    expect(sink).not.toHaveBeenCalled();
  });

  test("an error raised before the sink is installed is still reported once it is", () => {
    // ErrorBoundary.componentDidCatch can run before ErrorReporter's effect
    // installs the sink. That first occurrence must not be marked "seen" and
    // silently swallow every later occurrence.
    const err = new Error("early crash");
    mod.reportError(err);
    const sink = vi.fn();
    mod.setErrorSink(sink);
    mod.reportError(err);
    expect(sink).toHaveBeenCalledTimes(1);
  });
});
