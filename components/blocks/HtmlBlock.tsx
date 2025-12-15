'use client'

import type { ViewBlock } from '@/types/database'

interface HtmlBlockProps {
  block: ViewBlock
}

export default function HtmlBlock({ block }: HtmlBlockProps) {
  const html = block.settings?.html || ''

  return (
    <div className="w-full h-full">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
