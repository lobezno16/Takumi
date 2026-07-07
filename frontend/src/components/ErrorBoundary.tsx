/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("TakumiRoute Uncaught error:", error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div id="error-boundary-screen" className="min-h-screen bg-ink text-paper flex flex-col items-center justify-center p-8 select-none font-sans text-center">
          <div className="max-w-md w-full bg-[#161B22] border border-accent/20 rounded-lg p-6 space-y-4 shadow-2xl relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-accent" />
            
            <AlertCircle className="w-10 h-10 text-accent mx-auto animate-bounce" />
            
            <div className="space-y-1">
              <h2 className="font-display font-medium text-base text-paper">
                Something went wrong
              </h2>
              <span className="text-[10px] text-muted leading-tight block">
                エラーが発生しました / システム安全停止
              </span>
            </div>

            <p className="text-[11px] text-muted leading-relaxed">
              We encountered an unexpected rendering error on this page. This could be due to network connectivity gaps, localized WebGL container bounds, or stale parameters.
            </p>

            {this.state.error && (
              <pre className="p-3 bg-[#0D1117] rounded text-[9px] font-mono text-accent overflow-x-auto max-h-32 text-left">
                {this.state.error.message}
                {this.state.error.stack?.split("\n").slice(0, 3).join("\n")}
              </pre>
            )}

            <button
              id="reset-error-boundary-btn"
              onClick={this.handleReset}
              className="w-full py-2 bg-accent hover:bg-accent-muted text-paper text-xs font-semibold rounded flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reload Applet Core / 再読込
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
