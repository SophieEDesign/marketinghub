"use client"

import type { ViewBlock } from "@/types/database"

interface KpiBlockProps {
  block: ViewBlock
}

export default function KpiBlock({ block }: KpiBlockProps) {
  const label = block.config?.label || "KPI"
  const value = block.config?.value || 0
  const format = block.config?.format || "number"

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div className="text-sm text-muted-foreground mb-2">{label}</div>
      <div className="text-3xl font-bold">
        {format === "currency" ? `$${value.toLocaleString()}` : value.toLocaleString()}
      </div>
    </div>
  )
}
