"use client"

import { ErrorBoundary } from "@/components/interface/ErrorBoundary"

export function ViewErrorBoundary({
  children,
  resetKeys,
  label = "View",
}: {
  children: React.ReactNode
  resetKeys?: unknown[]
  label?: string
}) {
  return (
    <ErrorBoundary
      resetKeys={resetKeys}
      fallback={
        <div className="h-full min-h-[200px] flex items-center justify-center p-4 border border-red-200 bg-red-50 rounded-lg">
          <div className="text-center">
            <p className="text-sm font-medium text-red-800 mb-1">{label} error</p>
            <p className="text-xs text-red-600">
              Something went wrong loading this view. Refresh the page or try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 px-3 py-1.5 text-xs font-medium text-red-800 bg-red-100 rounded hover:bg-red-200"
            >
              Refresh
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
