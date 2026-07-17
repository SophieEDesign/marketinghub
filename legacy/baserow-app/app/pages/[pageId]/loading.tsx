import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

export default function InterfacePageLoading() {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LoadingSpinner size="lg" />
      <p className="text-sm text-muted-foreground">Loading page…</p>
    </div>
  )
}
