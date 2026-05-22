"use client"

import type { ReactNode } from "react"
import { useUIMode } from "@/contexts/UIModeContext"
import { cn } from "@/lib/utils"

export interface EditableDashboardRegionProps {
  id: string
  label: string
  children: ReactNode
  className?: string
}

/**
 * Bespoke marketing dashboards: same UI in view and edit; optional hover chrome in edit mode.
 */
export function EditableDashboardRegion({
  id,
  label,
  children,
  className,
}: EditableDashboardRegionProps) {
  const { isEdit } = useUIMode()
  const editMode = isEdit()

  if (!editMode) {
    return <div className={className} data-dashboard-region={id}>{children}</div>
  }

  return (
    <div
      className={cn(
        "relative rounded-lg transition-shadow",
        "ring-1 ring-transparent hover:ring-border/60",
        className
      )}
      data-dashboard-region={id}
    >
      <span className="absolute -top-2 left-2 z-[2] rounded bg-muted/90 px-1.5 py-px text-[10px] font-medium text-muted-foreground opacity-0 hover:opacity-100 group-hover:opacity-100 pointer-events-none">
        {label}
      </span>
      {children}
    </div>
  )
}

export function DashboardEditChromeProvider({ children }: { children: ReactNode }) {
  return <div className="group min-h-0 min-w-0 flex flex-col flex-1">{children}</div>
}
