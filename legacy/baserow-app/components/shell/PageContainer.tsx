"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface PageContainerProps {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export default function PageContainer({
  title,
  subtitle,
  actions,
  children,
  className,
  contentClassName,
}: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8", className)}>
      {(title || subtitle || actions) && (
        <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      )}
      <div className={contentClassName}>{children}</div>
    </div>
  )
}
