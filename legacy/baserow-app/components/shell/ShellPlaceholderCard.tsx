"use client"

import { LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"

interface ShellPlaceholderCardProps {
  title?: string
  description?: string
  className?: string
}

export default function ShellPlaceholderCard({
  title = "Dashboard blocks will be added here",
  description = "Custom KPI cards, timelines, and content blocks will appear in this area once configured.",
  className,
}: ShellPlaceholderCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-hub-border bg-card px-8 py-16 text-center shadow-card",
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-hub-nav-active">
        <LayoutDashboard className="h-6 w-6 text-hub-primary" />
      </div>
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
