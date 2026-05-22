"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import AppHeader from "@/components/shell/AppHeader"
import {
  APP_BAR_PADDING_Y,
  APP_PAGE_PADDING_X,
  MARKETING_FILTER_STRIP,
  MARKETING_INSIGHT_CARD,
} from "@/lib/interface/spacing-tokens"
import PanelShell from "@/components/interface/primitives/PanelShell"

export const PANEL_DESKTOP_WIDTH = 360
export const BLOCK_EMBED_CLASSNAME = "w-full min-w-0 min-h-0 max-w-full"
export const CANVAS_SURFACE_CLASSNAME = "flex flex-1 min-h-0 min-w-0 w-full max-w-full overflow-hidden"

export function AppShell({
  sidebar,
  canvas,
  rightPanel,
  className,
}: {
  sidebar: React.ReactNode
  canvas: React.ReactNode
  rightPanel?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-1 min-h-0 min-w-0 overflow-hidden", className)}>
      {sidebar}
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <div className={CANVAS_SURFACE_CLASSNAME}>
          {canvas}
        </div>
        {rightPanel}
      </div>
    </div>
  )
}

export function CanvasContainer({
  children,
  className,
  fullBleed = false,
  scrollOwner = "parent",
}: {
  children: React.ReactNode
  className?: string
  fullBleed?: boolean
  scrollOwner?: "parent" | "self"
}) {
  return (
    <div
      className={cn(
        BLOCK_EMBED_CLASSNAME,
        "mx-auto flex flex-col flex-1",
        scrollOwner === "self" ? "overflow-y-auto overscroll-contain app-scrollable" : "overflow-visible",
        fullBleed ? "max-w-none px-0" : "max-w-7xl px-4 md:px-6 py-6 md:py-8 gap-6",
        className
      )}
    >
      {children}
    </div>
  )
}

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "panel-shell rounded-card text-card-foreground",
        "flex flex-col min-h-0 min-w-0",
        className
      )}
    >
      {children}
    </section>
  )
}

export function PanelHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("border-b border-border/60 px-4 py-3", className)}>{children}</div>
}

export function PanelBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("p-4 min-h-0 min-w-0", className)}>{children}</div>
}

export function AppCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("surface-card rounded-card", className)}>{children}</div>
}

export function GridLayout({
  children,
  columns = 2,
  className,
}: {
  children: React.ReactNode
  columns?: 1 | 2
  className?: string
}) {
  return (
    <div className={cn("grid gap-4 md:gap-6", columns === 1 ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2", className)}>
      {children}
    </div>
  )
}

export function SplitLayout({
  left,
  right,
  className,
}: {
  left: React.ReactNode
  right: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 min-h-0 min-w-0", className)}>
      <div className="xl:col-span-2 min-h-0 min-w-0">{left}</div>
      <div className="xl:col-span-1 min-h-0 min-w-0">{right}</div>
    </div>
  )
}

export function MarketingPanelPrimary({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <PanelShell variant="primary" className={className}>
      {children}
    </PanelShell>
  )
}

export function MarketingPanelSecondary({
  title,
  children,
  className,
  bodyClassName,
}: {
  title: string
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <PanelShell
      variant="secondary"
      title={title}
      className={className}
      scrollBody
      bodyClassName={cn("px-2 pb-2", bodyClassName)}
    >
      {children}
    </PanelShell>
  )
}

export function MarketingInsightCard({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn(MARKETING_INSIGHT_CARD, "px-2.5 py-2 min-w-0", className)}>
      {title ? (
        <p className="text-[11px] font-medium text-muted-foreground mb-1.5">{title}</p>
      ) : null}
      {children}
    </div>
  )
}

export function MarketingFilterStrip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn(MARKETING_FILTER_STRIP, className)}>{children}</div>
}

export function AppPageHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex-shrink-0 flex flex-col", className)}>
      <AppHeader
        showSearch
        leftSlot={
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0 text-base font-semibold tracking-tight text-foreground md:text-lg">
              {title}
            </div>
            {meta ? <div className="hidden sm:block text-xs text-muted-foreground shrink-0">{meta}</div> : null}
          </div>
        }
      />
      {actions ? (
        <div
          className={cn(
            "flex items-center justify-end gap-2 border-b border-hub-border bg-white/80 px-4 py-1.5 md:px-6",
            APP_PAGE_PADDING_X
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  )
}
