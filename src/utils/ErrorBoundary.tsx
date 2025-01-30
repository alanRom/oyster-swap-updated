/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from "react";

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{fallback: React.Component}>, {hasError: boolean}, any> {
    state: Readonly<{ hasError: boolean; }>;
    constructor(props: React.PropsWithChildren<{ fallback: React.Component; }>) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
      // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: { componentStack: any; }) {
      // Example "componentStack":
      //   in ComponentThatThrows (created by App)
      //   in ErrorBoundary (created by App)
      //   in div (created by App)
      //   in App
        console.error('ErrorBoundary:', error, info)
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return this.props.fallback;
        }
    
        return this.props.children;
    }
}