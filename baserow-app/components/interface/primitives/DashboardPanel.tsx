"use client"

import type { ReactNode } from "react"
import type { SurfaceDensity } from "@/lib/interface/spacing-tokens"
import type { AccentEdgePosition } from "@/lib/interface/accent-styles"
import PanelShell from "@/components/interface/primitives/PanelShell"

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
  elevated = false,
  ...props
}: DashboardPanelProps) {
  return (
    <PanelShell
      variant={elevated ? "elevated" : "primary"}
      {...props}
    />
  )
}
