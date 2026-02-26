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
        <div className="flex flex-col items-center justify-center flex-1 gap-6 p-8 text-center">
          <div className="text-6xl">😵</div>
          <h2
            className="text-2xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Something went wrong
          </h2>
          <p style={{ color: "var(--color-text-muted)" }}>
            An unexpected error occurred. Your progress has been saved.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-6 py-3 rounded-xl font-bold text-white cursor-pointer"
            style={{
              background:
                "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-secondary) 100%)",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
