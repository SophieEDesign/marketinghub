"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface BlockHeaderProps {
  title?: string | null
  description?: string | null
  actions?: ReactNode
  className?: string
}

export default function BlockHeader({
  title,
  description,
  actions,
  className,
}: BlockHeaderProps) {
  const hasTitle = typeof title === "string" && title.trim().length > 0
  const hasDescription = typeof description === "string" && description.trim().length > 0
  if (!hasTitle && !hasDescription && !actions) return null

  return (
    <div className={cn("flex min-h-8 items-center justify-between gap-2 border-b border-border pb-1 mb-1.5", className)}>
      <div className="min-w-0 flex-1">
        {hasTitle && <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>}
        {hasDescription && <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  )
}
