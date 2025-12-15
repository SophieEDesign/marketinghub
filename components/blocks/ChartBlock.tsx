'use client'

import type { ViewBlock } from '@/types/database'

interface ChartBlockProps {
  block: ViewBlock
}

export default function ChartBlock({ block }: ChartBlockProps) {
  const chartType = block.settings?.chartType || 'bar'
  const data = block.settings?.data || []

  return (
    <div className="w-full h-full">
      <div className="text-sm text-muted-foreground mb-2">Chart: {chartType}</div>
      <div className="bg-muted rounded p-4 text-center">
        Chart visualization will be implemented here
        <div className="text-xs mt-2">Data points: {data.length}</div>
      </div>
    </div>
  )
}
