'use client'

import type { ViewBlock } from '@/types/database'

interface DividerBlockProps {
  block: ViewBlock
}

export default function DividerBlock({ block }: DividerBlockProps) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-full border-t" />
    </div>
  )
}
