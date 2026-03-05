"use client"

import { forwardRef } from "react"

export type CardDensity = "comfortable" | "compact" | "ultra"

export interface CardContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Density level: comfortable (title + 2 fields + tags), compact (title + 1 field), ultra (title only) */
  density?: CardDensity
  /** Optional inline styles (e.g. border color from color field) */
  styleOverrides?: React.CSSProperties
  /** When true, card is selected (e.g. ring highlight) */
  selected?: boolean
}

const baseClasses =
  "bg-white rounded-lg border border-gray-200 shadow-sm px-3 py-2 text-xs min-w-0 overflow-hidden max-w-[260px] hover:border-gray-300 hover:shadow-md transition-all"

const CardContainer = forwardRef<HTMLDivElement, CardContainerProps>(
  (
    {
      density = "compact",
      styleOverrides,
      selected = false,
      className = "",
      children,
      ...rest
    },
    ref
  ) => {
    const selectedClasses = selected ? "ring-1 ring-blue-400/40 bg-blue-50/30" : ""
    return (
      <div
        ref={ref}
        className={`${baseClasses} ${selectedClasses} ${className}`.trim()}
        style={styleOverrides}
        data-card-density={density}
        {...rest}
      >
        {children}
      </div>
    )
  }
)

CardContainer.displayName = "CardContainer"

export default CardContainer
