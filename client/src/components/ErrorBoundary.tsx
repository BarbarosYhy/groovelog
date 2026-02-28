import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-vinyl-bg">
          <div className="max-w-md rounded-xl border border-red-800 bg-red-900/20 p-8 text-center">
            <p className="text-2xl mb-2">⚠️</p>
            <p className="font-semibold text-red-300 mb-2">Something went wrong</p>
            <p className="text-sm text-vinyl-muted mb-4">{this.state.error.message}</p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
              className="rounded-lg bg-vinyl-amber px-4 py-2 text-sm font-semibold text-black hover:bg-vinyl-amber-light"
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
