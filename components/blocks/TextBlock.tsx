'use client'

import type { ViewBlock } from '@/types/database'

interface TextBlockProps {
  block: ViewBlock
}

export default function TextBlock({ block }: TextBlockProps) {
  const content = block.settings?.content || ''

  return (
    <div className="w-full h-full">
      <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  )
}
