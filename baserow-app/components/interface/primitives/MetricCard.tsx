"use client"

import { cn } from "@/lib/utils"
import { metricAccentClass } from "@/lib/interface/accent-styles"
import { TEXT_LABEL } from "@/lib/interface/typography-tokens"

export interface MetricCardProps {
  label: string
  value: string | number
  hint?: string
  /** Index into preset accent palette */
  accentIndex?: number
  className?: string
}

export default function MetricCard({
  label,
  value,
  hint,
  accentIndex =  0,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "surface-card rounded-card p-3 flex flex-col justify-between min-h-[76px]",
        metricAccentClass(accentIndex),
        className
      )}
    >
      <p className={TEXT_LABEL}>{label}</p>
      <p className="text-xl font-semibold tabular-nums text-foreground mt-1 leading-tight">
        {value}
      </p>
      {hint ? (
        <p className="text-[11px] text-muted-foreground/90 mt-1 leading-snug">{hint}</p>
      ) : null}
    </div>
  )
}
