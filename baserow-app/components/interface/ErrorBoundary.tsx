"use client"

import React from "react"

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: `log_${Date.now()}_error_boundary`,
        timestamp: Date.now(),
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'ErrorBoundary.tsx:componentDidCatch',
        message: 'ErrorBoundary caught error (including componentStack)',
        data: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        },
      }),
    }).catch(() => {})
    // #endregion
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="h-full flex items-center justify-center p-4 border border-red-200 bg-red-50 rounded-lg">
          <div className="text-center">
            <p className="text-sm font-medium text-red-800 mb-1">
              Block Error
            </p>
            <p className="text-xs text-red-600">
              This block encountered an error. Please refresh the page or contact support.
            </p>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-2 text-left">
                <summary className="text-xs text-red-500 cursor-pointer">
                  Error details
                </summary>
                <pre className="text-xs text-red-700 mt-1 overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

