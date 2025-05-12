// components/ErrorBoundary.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <GlobalErrorFallback />;
    }

    return this.props.children;
  }
}

// 👇 Separated fallback UI so we can use hooks here
function GlobalErrorFallback() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-gray-800 px-4">
      <h1 className="text-3xl font-bold mb-4">Something went wrong</h1>
      <p className="text-lg mb-6 text-center max-w-md">
        An unexpected error occurred. Please try again or return to the homepage.
      </p>
      <button
        onClick={() => navigate("/")}
        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        Go Home
      </button>
    </div>
  );
}

export default ErrorBoundary;
