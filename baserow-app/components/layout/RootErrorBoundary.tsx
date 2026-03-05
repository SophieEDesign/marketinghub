"use client"

import { usePathname } from "next/navigation"
import { ErrorBoundary } from "@/components/interface/ErrorBoundary"

// #region agent log
const DEBUG_LOG = (msg: string, data: Record<string, unknown>) => {
  fetch('http://127.0.0.1:7242/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fa3112'},body:JSON.stringify({sessionId:'fa3112',location:'RootErrorBoundary.tsx',message:msg,data,timestamp:Date.now(),hypothesisId:'root-error'})}).catch(()=>{});
};
// #endregion

/**
 * Root-level ErrorBoundary for the app layout.
 * Catches errors above block level that would otherwise crash the entire app.
 * Uses resetKeys so navigation can recover from errors.
 */
export default function RootErrorBoundary({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  return (
    <ErrorBoundary
      resetKeys={[pathname ?? ""]}
      onError={(error, errorInfo) => {
        DEBUG_LOG('RootErrorBoundary caught error', { errorMessage: error?.message, errorStack: error?.stack, componentStack: errorInfo?.componentStack?.slice(0, 500) })
      }}
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-semibold text-slate-800">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-600">
              An unexpected error occurred. Please refresh the page or try
              navigating to another section.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-700"
            >
              Refresh page
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
