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
    // #region agent log
    try {
      fetch('http://127.0.0.1:7242/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f14c63'},body:JSON.stringify({sessionId:'f14c63',location:'pages/[pageId]/error.tsx',message:'Route error boundary rendered',data:{errorMessage:error?.message,errorName:error?.name},hypothesisId:'B',timestamp:Date.now()})}).catch(()=>{});
    } catch (_) {}
    // #endregion
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
