'use client'

import type { ViewBlock } from '@/types/database'

interface StatBlockProps {
  block: ViewBlock
}

export default function StatBlock({ block }: StatBlockProps) {
  const label = block.settings?.label || 'Stat'
  const value = block.settings?.value || 0

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div className="text-sm text-muted-foreground mb-2">{label}</div>
      <div className="text-3xl font-bold">{value.toLocaleString()}</div>
    </div>
  )
}
