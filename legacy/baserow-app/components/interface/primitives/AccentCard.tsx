"use client"

import { forwardRef, type ReactNode } from "react"
import type { SurfaceDensity } from "@/lib/interface/spacing-tokens"
import { densityCardPadding } from "@/lib/interface/spacing-tokens"
import {
  accentEdgeProps,
  accentTintClassName,
  type AccentEdgePosition,
} from "@/lib/interface/accent-styles"
import { cn } from "@/lib/utils"

export interface AccentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: SurfaceDensity
  accentColor?: string | null
  accentPosition?: AccentEdgePosition
  /** Level 3 hero emphasis */
  elevated?: boolean
  interactive?: boolean
  selected?: boolean
  tintWash?: boolean
  children: ReactNode
}

const AccentCard = forwardRef<HTMLDivElement, AccentCardProps>(
  (
    {
      density = "compact",
      accentColor,
      accentPosition = "none",
      elevated = false,
      interactive = false,
      selected = false,
      tintWash = false,
      className,
      children,
      style,
      ...rest
    },
    ref
  ) => {
    const { className: accentClass, style: accentStyle } = accentEdgeProps(
      accentColor,
      accentPosition
    )

    return (
      <div
        ref={ref}
        className={cn(
          elevated ? "surface-elevated rounded-card-lg" : "surface-card rounded-card",
          interactive && "surface-card-interactive cursor-pointer",
          selected && "ring-1 ring-accent-link/30 border-border/65",
          interactive && !selected && "hover:shadow-card-hover",
          densityCardPadding(density),
          accentClass,
          tintWash && accentTintClassName(!!accentColor),
          "min-w-0 overflow-hidden",
          className
        )}
        style={{ ...accentStyle, ...style }}
        {...rest}
      >
        {children}
      </div>
    )
  }
)

AccentCard.displayName = "AccentCard"

export default AccentCard
