"use client"

import { cn } from "@/lib/utils"

export function EventAvatarStack({
  labels,
  max = 4,
  className,
}: {
  labels: string[]
  max?: number
  className?: string
}) {
  const visible = labels.slice(0, max)
  const extra = labels.length - visible.length

  if (visible.length === 0) return null

  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {visible.map((label, i) => (
        <span
          key={`${label}-${i}`}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-background bg-muted text-[9px] font-semibold text-muted-foreground"
          title={label}
        >
          {initials(label)}
        </span>
      ))}
      {extra > 0 ? (
        <span className="inline-flex h-5 min-w-[1.25rem] px-0.5 items-center justify-center rounded-full border border-background bg-muted/80 text-[9px] font-medium text-muted-foreground">
          +{extra}
        </span>
      ) : null}
    </div>
  )
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return label.slice(0, 2).toUpperCase()
}
