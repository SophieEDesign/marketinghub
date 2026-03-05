"use client"

import type { PageBlock } from "@/lib/interface/types"
import { Code } from "lucide-react"

interface HtmlBlockProps {
  block: PageBlock
  isEditing?: boolean
  onUpdate?: (updates: Partial<PageBlock["config"]>) => void
}

export default function HtmlBlock({ block, isEditing = false }: HtmlBlockProps) {
  const html = block.config?.html || ""

  if (!html) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-400 min-h-[100px]">
        <div className="text-center">
          <Code className="h-8 w-8 mx-auto mb-2" />
          <p className="text-xs">No HTML content. Add HTML in the settings panel.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full min-h-0 overflow-auto">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
