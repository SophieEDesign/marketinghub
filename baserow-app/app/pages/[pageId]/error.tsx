"use client"

import { useEffect } from "react"

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Page error:", error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 bg-slate-50">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-lg font-semibold text-slate-800">
          Page error
        </h1>
        <p className="text-sm text-slate-600">
          This page encountered an error. Please try again or navigate to another page.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-700"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300"
          >
            Go home
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
