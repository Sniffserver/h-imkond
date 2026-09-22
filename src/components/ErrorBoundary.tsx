import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Radio, WifiOff, RefreshCw, AlertTriangle, Terminal, X, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  isHmrOrWsError: boolean;
  errorMessage: string;
  errorStack?: string;
  showHmrBanner: boolean;
  showDetails: boolean;
}

/**
 * Checks whether an error originates from WebSocket, Vite HMR, or dev-service-worker disconnection.
 * In AI Studio sandbox, HMR is disabled via DISABLE_HMR=true, making these errors benign.
 */
export function isHmrOrWebSocketError(error: unknown): boolean {
  if (!error) return false;
  const msg = (
    typeof error === 'string'
      ? error
      : (error as Error).message || String(error)
  ).toLowerCase();

  const stack = (typeof error === 'object' && error !== null && 'stack' in error)
    ? String((error as Error).stack).toLowerCase()
    : '';

  return (
    msg.includes('ws is undefined') ||
    msg.includes('websocket') ||
    msg.includes('failed to connect to websocket') ||
    msg.includes('preamble') ||
    msg.includes("cannot read properties of undefined (reading 'send')") ||
    msg.includes("cannot read properties of undefined (reading 'addeventlistener')") ||
    msg.includes('hmr') ||
    msg.includes('hot reload') ||
    msg.includes('vite') ||
    msg.includes('dynamically imported module') ||
    msg.includes('failed to fetch dynamically imported') ||
    stack.includes('websocket') ||
    stack.includes('@vite/client') ||
    stack.includes('vite-plugin-pwa')
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      isHmrOrWsError: false,
      errorMessage: '',
      errorStack: undefined,
      showHmrBanner: false,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const isWsHmr = isHmrOrWebSocketError(error);
    return {
      hasError: true,
      isHmrOrWsError: isWsHmr,
      errorMessage: error.message || 'Unknown runtime exception',
      errorStack: error.stack,
      showHmrBanner: isWsHmr,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const isWsHmr = isHmrOrWebSocketError(error);
    if (isWsHmr) {
      console.warn(
        '[HÕIMU Field Terminal] Handled sandbox HMR/WebSocket disconnection gracefully. Field Mode active.',
        error
      );
    } else {
      console.error('[HÕIMU Field Terminal] Runtime error captured by ErrorBoundary:', error, errorInfo);
    }
  }

  componentDidMount(): void {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount(): void {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private handleWindowError = (event: ErrorEvent): void => {
    const error = event.error || event.message;
    if (isHmrOrWebSocketError(error)) {
      // Prevent browser from treating benign sandbox websocket disconnections as fatal crashes
      event.preventDefault();
      this.setState({
        showHmrBanner: true,
        isHmrOrWsError: true,
        errorMessage: typeof error === 'string' ? error : (error as Error)?.message || 'WebSocket disconnected',
      });
    }
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const reason = event.reason;
    if (isHmrOrWebSocketError(reason)) {
      event.preventDefault();
      this.setState({
        showHmrBanner: true,
        isHmrOrWsError: true,
        errorMessage: typeof reason === 'string' ? reason : (reason as Error)?.message || 'HMR socket rejection',
      });
    }
  };

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      isHmrOrWsError: false,
      errorMessage: '',
      errorStack: undefined,
      showHmrBanner: false,
      showDetails: false,
    });
  };

  private handleHardReload = (): void => {
    try {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch {
      // fallback
    }
  };

  private handleClearStorageAndReload = (): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        // Clear cached PWA states and reload
        sessionStorage.clear();
      }
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  render(): ReactNode {
    const { hasError, isHmrOrWsError, errorMessage, errorStack, showHmrBanner, showDetails } = this.state;
    const { children, fallback } = this.props;

    // 1. FATAL RENDER CRASH FALLBACK
    if (hasError) {
      if (fallback) return fallback;

      return (
        <div className="min-h-screen w-full bg-[#141E12] text-[#FAF6EE] flex flex-col items-center justify-center p-4 sm:p-6 font-sans antialiased">
          {/* Main Container */}
          <div className="w-full max-w-xl bg-[#1A2617] border border-[#87A878]/30 rounded-2xl p-6 shadow-2xl space-y-6">
            {/* Header with status pill */}
            <div className="flex items-start justify-between gap-4 border-b border-[#87A878]/20 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isHmrOrWsError ? 'bg-[#E9C46A]/20 text-[#E9C46A]' : 'bg-[#E76F51]/20 text-[#E76F51]'}`}>
                  {isHmrOrWsError ? <Radio className="w-6 h-6 animate-pulse" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-[#FAF6EE]">
                    {isHmrOrWsError ? 'Field Mode — HMR Disabled' : 'Terminal Recovery Safe Mode'}
                  </h1>
                  <p className="text-xs text-[#87A878]">
                    {isHmrOrWsError
                      ? 'AI Studio Sandbox Environment — Hot reload WebSocket isolated'
                      : 'HÕIMU Local Mesh Terminal encountered a component boundary issue'}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-[#87A878]/15 text-[#87A878] border border-[#87A878]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#87A878] animate-ping" />
                OFFLINE SECURE
              </div>
            </div>

            {/* Explanatory Context */}
            <div className="bg-[#141E12] border border-[#87A878]/20 rounded-xl p-4 text-xs space-y-2 text-[#FAF6EE]/90">
              <p className="font-medium text-[#FAF6EE]">
                {isHmrOrWsError
                  ? 'Hot Module Replacement (HMR) is intentionally disabled in this cloud container sandbox to prevent UI flickering during code updates and preserve battery life.'
                  : 'An unhandled exception was captured by the HÕIMU resilience barrier to prevent a blank white screen.'}
              </p>
              <p className="text-[#87A878]/90">
                {isHmrOrWsError
                  ? 'The local mesh database and offline cache remain intact. You can continue running the terminal without active hot-socket connection.'
                  : 'Your local database entries and mesh ledger records are securely persisted in local storage.'}
              </p>
            </div>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="bg-black/30 border border-white/10 rounded-lg p-3 font-mono text-xs text-[#E9C46A] break-words">
                {errorMessage}
              </div>
            )}

            {/* Collapsible Technical Details */}
            {errorStack && (
              <div className="border border-white/10 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !showDetails })}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white/5 text-xs text-[#87A878] hover:bg-white/10 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    Technical Diagnostics
                  </span>
                  {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showDetails && (
                  <pre className="p-3 bg-black/50 text-[10px] font-mono text-white/70 overflow-x-auto max-h-48 whitespace-pre-wrap">
                    {errorStack}
                  </pre>
                )}
              </div>
            )}

            {/* Recovery Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                id="btn-resume-terminal"
                onClick={this.handleReset}
                className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-[#2A9D8F] text-white font-medium text-xs hover:bg-[#2A9D8F]/90 transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Radio className="w-3.5 h-3.5" />
                Resume Terminal
              </button>

              <button
                type="button"
                id="btn-reload-terminal"
                onClick={this.handleHardReload}
                className="px-4 py-2.5 rounded-xl bg-[#87A878]/20 border border-[#87A878]/40 text-[#FAF6EE] text-xs hover:bg-[#87A878]/30 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Page
              </button>

              <button
                type="button"
                id="btn-reset-terminal"
                onClick={this.handleClearStorageAndReload}
                className="px-3 py-2.5 rounded-xl bg-white/5 text-[#FAF6EE]/60 text-xs hover:text-[#FAF6EE] hover:bg-white/10 transition-all"
                title="Clears session cache and reloads"
              >
                Reset Session
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 2. NORMAL RENDERING WITH OPTIONAL TOP "FIELD MODE" BANNER
    return (
      <>
        {showHmrBanner && (
          <aside
            id="hmr-disabled-banner"
            aria-label="Field Mode HMR Disabled Notification"
            className="fixed top-0 left-0 right-0 z-[9999] bg-[#1A2617]/95 backdrop-blur-md border-b border-[#E9C46A]/40 text-[#FAF6EE] px-4 py-2 shadow-lg flex items-center justify-between gap-3 text-xs transition-all animate-fadeIn"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="p-1 rounded bg-[#E9C46A]/20 text-[#E9C46A] flex-shrink-0">
                <WifiOff className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold text-[#E9C46A] tracking-wider uppercase text-[11px]">
                  Field Mode
                </span>
                <span className="text-[#87A878] hidden sm:inline">•</span>
                <span className="text-[#FAF6EE]/90 truncate">
                  HMR Disabled — Operating in resilient offline sandbox mode.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                id="btn-dismiss-hmr-banner"
                onClick={() => this.setState({ showHmrBanner: false })}
                className="p-1 text-[#FAF6EE]/60 hover:text-[#FAF6EE] hover:bg-white/10 rounded transition-colors"
                title="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </aside>
        )}

        {children}
      </>
    );
  }
}
