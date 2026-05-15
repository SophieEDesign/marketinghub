"use client"

import type { ReactNode } from "react"
import type { SurfaceDensity } from "@/lib/interface/spacing-tokens"
import {
  densityPanelHeader,
  APP_PANEL_RADIUS,
} from "@/lib/interface/spacing-tokens"
import {
  accentEdgeProps,
  accentTintClassName,
  type AccentEdgePosition,
} from "@/lib/interface/accent-styles"
import { TEXT_SECTION_TITLE, TEXT_META } from "@/lib/interface/typography-tokens"
import { cn } from "@/lib/utils"

export interface DashboardPanelProps {
  title?: string
  subtitle?: string
  label?: string
  actions?: ReactNode
  accentColor?: string | null
  accentPosition?: AccentEdgePosition
  elevated?: boolean
  density?: SurfaceDensity
  scrollBody?: boolean
  maxBodyHeight?: string
  className?: string
  bodyClassName?: string
  children: ReactNode
}

export default function DashboardPanel({
  title,
  subtitle,
  label,
  actions,
  accentColor,
  accentPosition = "none",
  elevated = false,
  density = "compact",
  scrollBody = false,
  maxBodyHeight,
  className,
  bodyClassName,
  children,
}: DashboardPanelProps) {
  const { className: accentClass, style: accentStyle } = accentEdgeProps(
    accentColor,
    accentPosition
  )
  const hasHeader = title || subtitle || label || actions

  return (
    <section
      className={cn(
        elevated ? "surface-elevated" : "panel-shell",
        APP_PANEL_RADIUS,
        "flex flex-col min-h-0 min-w-0",
        accentClass,
        accentColor && accentPosition === "top" && accentTintClassName(true),
        className
      )}
      style={accentStyle}
    >
      {hasHeader ? (
        <div
          className={cn(
            "flex items-start justify-between gap-2 border-b border-border/40 shrink-0",
            densityPanelHeader(density)
          )}
        >
          <div className="min-w-0 flex-1">
            {label ? <p className={TEXT_META}>{label}</p> : null}
            {title ? <h2 className={cn(TEXT_SECTION_TITLE, label && "mt-0.5")}>{title}</h2> : null}
            {subtitle ? <p className="text-meta mt-0.5 leading-snug">{subtitle}</p> : null}
          </div>
          {actions ? <div className="shrink-0 flex items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
      <div
        className={cn(
          scrollBody && "flex-1 min-h-0 overflow-y-auto overscroll-contain",
          maxBodyHeight,
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  )
}
