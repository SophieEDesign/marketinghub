"use client"

import { useEffect } from "react"

export default function ViewError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("View error:", error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-background">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-page-title text-foreground">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground">
          This view could not load. Try again or return to Marketing Home.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-inner hover:opacity-90"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-inner hover:bg-muted/50"
          >
            Marketing Home
          </button>
        </div>
        {process.env.NODE_ENV === "development" && (
          <details className="mt-4 text-left">
            <summary className="text-xs text-slate-500 cursor-pointer">
              Error details
            </summary>
            <pre className="mt-2 text-xs text-slate-700 overflow-auto p-2 bg-slate-100 rounded">
              {error.toString()}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
