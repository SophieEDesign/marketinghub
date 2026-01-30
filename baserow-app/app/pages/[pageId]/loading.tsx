import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

/**
 * Shown while the page segment is loading (during navigation to /pages/[pageId]).
 * Gives immediate feedback that a page transfer is in progress.
 */
export default function PageLoading() {
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background/95">
      <LoadingSpinner size="lg" text="Loading page…" />
      <p className="mt-3 text-sm text-muted-foreground">
        Page transfer in progress
      </p>
    </div>
  )
}
