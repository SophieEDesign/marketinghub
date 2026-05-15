"use client"

import { cn } from "@/lib/utils"
import { TEXT_EMPTY } from "@/lib/interface/typography-tokens"

export type DashboardEmptyVariant = "default" | "compact" | "inline"

export interface DashboardEmptyProps {
  title: string
  description?: string
  variant?: DashboardEmptyVariant
  className?: string
}

export default function DashboardEmpty({
  title,
  description,
  variant = "inline",
  className,
}: DashboardEmptyProps) {
  if (variant === "inline") {
    return <p className={cn(TEXT_EMPTY, className)}>{title}</p>
  }

  if (variant === "compact") {
    return (
      <div className={cn("py-4 px-3 text-center", className)}>
        <p className="text-sm text-muted-foreground/90">{title}</p>
        {description ? (
          <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-card border border-dashed border-border/50 bg-muted/15 px-4 py-5 text-center",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">{title}</p>
      {description ? (
        <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>
      ) : null}
    </div>
  )
}
