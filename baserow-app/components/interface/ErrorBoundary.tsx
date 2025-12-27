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

