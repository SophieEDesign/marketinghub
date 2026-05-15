"use client"

import { forwardRef } from "react"
import AccentCard, { type AccentCardProps } from "@/components/interface/primitives/AccentCard"
import { cn } from "@/lib/utils"

export type CardDensity = "comfortable" | "compact" | "ultra"

export interface CardContainerProps extends Omit<AccentCardProps, "density"> {
  density?: CardDensity
  styleOverrides?: React.CSSProperties
}

const densityMap: Record<CardDensity, AccentCardProps["density"]> = {
  comfortable: "comfortable",
  compact: "compact",
  ultra: "tight",
}

const CardContainer = forwardRef<HTMLDivElement, CardContainerProps>(
  (
    {
      density = "compact",
      styleOverrides,
      selected = false,
      className = "",
      children,
      interactive = true,
      ...rest
    },
    ref
  ) => {
    return (
      <AccentCard
        ref={ref}
        density={densityMap[density]}
        selected={selected}
        interactive={interactive}
        className={cn("text-xs max-w-[260px]", className)}
        style={styleOverrides}
        {...rest}
      >
        {children}
      </AccentCard>
    )
  }
)

CardContainer.displayName = "CardContainer"

export default CardContainer
