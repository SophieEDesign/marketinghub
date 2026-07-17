"use client"

import type { ReactNode } from "react"
import type { SurfaceDensity } from "@/lib/interface/spacing-tokens"
import {
  APP_PANEL_RADIUS,
  densityPanelHeader,
  MARKETING_PANEL_SECONDARY,
} from "@/lib/interface/spacing-tokens"
import {
  accentEdgeProps,
  accentTintClassName,
  type AccentEdgePosition,
} from "@/lib/interface/accent-styles"
import { TEXT_META, TEXT_SECTION_TITLE } from "@/lib/interface/typography-tokens"
import { cn } from "@/lib/utils"

export type PanelShellVariant = "primary" | "secondary" | "elevated"

export interface PanelShellProps {
  variant?: PanelShellVariant
  title?: string
  subtitle?: string
  label?: string
  actions?: ReactNode
  accentColor?: string | null
  accentPosition?: AccentEdgePosition
  density?: SurfaceDensity
  scrollBody?: boolean
  maxBodyHeight?: string
  className?: string
  bodyClassName?: string
  children: ReactNode
}

export default function PanelShell({
  variant = "primary",
  title,
  subtitle,
  label,
  actions,
  accentColor,
  accentPosition = "none",
  density = "compact",
  scrollBody = false,
  maxBodyHeight,
  className,
  bodyClassName,
  children,
}: PanelShellProps) {
  const { className: accentClass, style: accentStyle } = accentEdgeProps(
    accentColor,
    accentPosition
  )
  const hasHeader = Boolean(title || subtitle || label || actions)

  const surfaceClass =
    variant === "elevated"
      ? "surface-elevated rounded-card-lg"
      : variant === "secondary"
        ? MARKETING_PANEL_SECONDARY
        : cn("panel-shell", APP_PANEL_RADIUS, "ring-1 ring-border/20")

  const secondaryTitleOnly =
    variant === "secondary" && title && !subtitle && !label && !actions

  return (
    <section
      className={cn(
        surfaceClass,
        "flex flex-col min-h-0 min-w-0",
        accentClass,
        accentColor && accentPosition === "top" && accentTintClassName(true),
        className
      )}
      style={accentStyle}
    >
      {hasHeader ? (
        secondaryTitleOnly ? (
          <h3 className="text-[11px] font-medium text-muted-foreground px-2.5 pt-2 pb-1 shrink-0">
            {title}
          </h3>
        ) : (
          <div
            className={cn(
              "flex items-start justify-between gap-2 border-b border-border/40 shrink-0",
              densityPanelHeader(density)
            )}
          >
            <PanelShellHeaderText label={label} title={title} subtitle={subtitle} />
            {actions ? (
              <div className="shrink-0 flex items-center gap-1.5">{actions}</div>
            ) : null}
          </div>
        )
      ) : null}
      <PanelShellBody scrollBody={scrollBody} maxBodyHeight={maxBodyHeight} bodyClassName={bodyClassName}>
        {children}
      </PanelShellBody>
    </section>
  )
}

function PanelShellHeaderText({
  label,
  title,
  subtitle,
}: {
  label?: string
  title?: string
  subtitle?: string
}) {
  return (
    <div className="min-w-0 flex-1">
      {label ? <p className={TEXT_META}>{label}</p> : null}
      {title ? <h2 className={cn(TEXT_SECTION_TITLE, label && "mt-0.5")}>{title}</h2> : null}
      {subtitle ? <p className="text-meta mt-0.5 leading-snug">{subtitle}</p> : null}
    </div>
  )
}

function PanelShellBody({
  scrollBody,
  maxBodyHeight,
  bodyClassName,
  children,
}: {
  scrollBody: boolean
  maxBodyHeight?: string
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        scrollBody && "flex-1 min-h-0 overflow-y-auto overscroll-contain app-scrollable",
        maxBodyHeight,
        bodyClassName
      )}
    >
      {children}
    </div>
  )
}
