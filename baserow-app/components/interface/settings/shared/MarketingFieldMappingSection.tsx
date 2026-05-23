"use client"

import type { ReactNode } from "react"

interface MarketingFieldMappingSectionProps {
  title?: string
  children: ReactNode
  defaultOpen?: boolean
}

export default function MarketingFieldMappingSection({
  title = "Field mapping",
  children,
  defaultOpen = false,
}: MarketingFieldMappingSectionProps) {
  return (
    <details
      className="rounded-lg border border-border/40 group"
      open={defaultOpen || undefined}
    >
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground list-none flex items-center justify-between">
        <span>{title}</span>
        <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
        <span className="text-xs text-muted-foreground hidden group-open:inline">Hide</span>
      </summary>
      <div className="space-y-3 border-t border-border/40 p-3">{children}</div>
    </details>
  )
}
