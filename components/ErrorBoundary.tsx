"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex flex-col items-center justify-center flex-1 gap-4 px-4 py-10 text-center">
          <div className="panel w-full max-w-sm px-7 py-8 flex flex-col items-center gap-4">
            <div className="text-6xl" aria-hidden="true">😵</div>
            <h2
              className="text-2xl font-extrabold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Something went wrong
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              An unexpected error occurred. Your progress has been saved.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="btn-primary w-full px-6 py-3 cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
