import React from 'react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Unexpected runtime error' };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#04070D] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full jarvis-glass border border-rose-500/30 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-rose-300">JARVIS Interface Recovery</h2>
            <p className="text-sm text-slate-300 font-mono break-words">{this.state.errorMessage}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors"
            >
              Reset View
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
