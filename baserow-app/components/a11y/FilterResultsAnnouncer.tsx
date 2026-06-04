"use client"

interface FilterResultsAnnouncerProps {
  count: number
  /** e.g. "campaigns", "tasks", "resources" */
  noun?: string
  className?: string
}

function resultPhrase(count: number, noun: string): string {
  const label = count === 1 ? noun.replace(/s$/, "") || noun : noun
  return `${count} ${label}`
}

/**
 * Screen-reader announcement when marketing block filters/search change result counts.
 */
export function FilterResultsAnnouncer({
  count,
  noun = "results",
  className = "sr-only",
}: FilterResultsAnnouncerProps) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={className}>
      {resultPhrase(count, noun)}
    </div>
  )
}
